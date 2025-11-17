import archiver from 'archiver';
import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import * as fs from 'fs';
import * as path from 'path';
import { PostIssueScript } from '../models/postIssueScript.model';
import { ActivityLogService } from '../services/activityLog.service';
import { logger } from '../services/logger.service';

export class PostIssueScriptController {
    getAllScripts = asyncHandler(async (req: Request, res: Response) => {
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 0;
        const sortField = (req.query.sortField as string) || 'name';
        const sortOrder = parseInt(req.query.sortOrder as string) || 1;

        // Build filter query
        const filterQuery: any = {};

        // Process filters
        Object.keys(req.query).forEach(key => {
            if (key.startsWith('filters[') && key.endsWith(']')) {
                const field = key.substring(8, key.length - 1);
                const fieldFilterStr = req.query[key] as string;

                try {
                    const fieldFilter = JSON.parse(fieldFilterStr);

                    if (!fieldFilter.constraints || fieldFilter.constraints.length === 0) {
                        return;
                    }

                    const constraints = fieldFilter.constraints;
                    const operator = fieldFilter.operator || 'and';

                    if (constraints.length === 1) {
                        // Single constraint
                        filterQuery[field] = this.buildFilterQuery(field, constraints[0].value, constraints[0].matchMode);
                    } else {
                        // Multiple constraints - use operator (and/or)
                        const logicOp = operator === 'or' ? '$or' : '$and';
                        filterQuery[logicOp] = filterQuery[logicOp] || [];
                        constraints.forEach((constraint: any) => {
                            const condition: any = {};
                            condition[field] = this.buildFilterQuery(field, constraint.value, constraint.matchMode);
                            filterQuery[logicOp].push(condition);
                        });
                    }
                } catch (error) {
                    // Silent fail
                }
            }
        });

        // Get total count
        const totalRecords = await PostIssueScript.countDocuments(filterQuery);

        // Build sort object
        const sortObj: any = {};
        sortObj[sortField] = sortOrder;

        // Get paginated data
        const scripts = await PostIssueScript.find(filterQuery)
            .sort(sortObj)
            .skip(page * limit)
            .limit(limit);

        // Check for init.js existence for each script
        const scriptFolder = process.env.SCRIPTS_FOLDER || '.';
        const scriptsWithInitFlag = scripts.map((script: any) => {
            const scriptFolderPath = path.join(scriptFolder, script.path);
            const initPath = path.join(scriptFolderPath, 'init.js');
            const hasInit = fs.existsSync(initPath);

            return {
                ...script.toObject(),
                hasInit
            };
        });

        res.json({
            data: scriptsWithInitFlag,
            totalRecords
        });
    });

    private buildFilterQuery(field: string, value: any, matchMode: string): any {
        switch (matchMode) {
            case 'contains':
                return { $regex: value, $options: 'i' };
            case 'startsWith':
                return { $regex: `^${value}`, $options: 'i' };
            case 'equals':
                return value;
            default:
                return { $regex: value, $options: 'i' };
        }
    }

    getScriptById = asyncHandler(async (req: Request, res: Response) => {
        const script = await PostIssueScript.findById(req.params.id);
        if (!script) {
            res.status(404);
            throw new Error('Post-issue script not found');
        }
        res.json(script);
    });

    createScript = asyncHandler(async (req: Request, res: Response) => {
        // Validate unique keys within envVars
        if (req.body.envVars && Array.isArray(req.body.envVars)) {
            const keys = req.body.envVars.map((v: any) => v.key);
            const uniqueKeys = new Set(keys);
            if (keys.length !== uniqueKeys.size) {
                res.status(400);
                throw new Error('Environment variable keys must be unique within the script');
            }
        }

        const script = await PostIssueScript.create(req.body);

        // Log activity
        await ActivityLogService.log(
            'postScriptCreated',
            req,
            {
                resourceType: "script",
                scriptName: script.name, scriptPath: script.path
            }
        );

        res.status(201).json(script);
    });

    updateScript = asyncHandler(async (req: Request, res: Response) => {
        // Validate unique keys within envVars
        if (req.body.envVars && Array.isArray(req.body.envVars)) {
            const keys = req.body.envVars.map((v: any) => v.key);
            const uniqueKeys = new Set(keys);
            if (keys.length !== uniqueKeys.size) {
                res.status(400);
                throw new Error('Environment variable keys must be unique within the script');
            }
        }

        const script = await PostIssueScript.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        if (!script) {
            res.status(404);
            throw new Error('Post-issue script not found');
        }

        // Log activity
        await ActivityLogService.log(
            'postScriptUpdated',
            req,
            {
                resourceType: "script",
                scriptName: script.name, scriptPath: script.path
            }
        );

        res.json(script);
    });

    deleteScript = asyncHandler(async (req: Request, res: Response) => {
        const script = await PostIssueScript.findByIdAndDelete(req.params.id);

        if (!script) {
            res.status(404);
            throw new Error('Post-issue script not found');
        }

        // Delete script folder from filesystem
        const scriptsFolder = process.env.SCRIPTS_FOLDER || '.';
        const scriptFolderPath = path.join(scriptsFolder, script.path);

        if (fs.existsSync(scriptFolderPath)) {
            try {
                fs.rmSync(scriptFolderPath, { recursive: true, force: true });
                logger.info(`Deleted script folder: ${scriptFolderPath}`);
            } catch (error: any) {
                logger.error(`Failed to delete script folder ${scriptFolderPath}: ${error.message}`);
                // Continue even if deletion fails
            }
        }

        // Log activity
        await ActivityLogService.log(
            'postScriptDeleted',
            req,
            {
                resourceType: "script",
                scriptName: script.name,
                scriptPath: script.path
            }
        );

        res.json({ message: 'Post-issue script deleted' });
    });

    exportScript = asyncHandler(async (req: Request, res: Response) => {
        const script: any = await PostIssueScript.findById(req.params.id);

        if (!script) {
            res.status(404);
            throw new Error('Post-issue script not found');
        }

        const scriptsFolder = process.env.SCRIPTS_FOLDER || '.';
        const scriptFolderPath = path.join(scriptsFolder, script.path);

        // Check if script folder exists
        if (!fs.existsSync(scriptFolderPath)) {
            res.status(404);
            throw new Error('Script folder not found on filesystem');
        }

        // Read .acmeignore if exists
        const ignoreFilePath = path.join(scriptFolderPath, '.acmeignore');
        const ignorePatterns = ['venv/', 'node_modules/', '__pycache__/', '.venv/', '*.pyc', '.git/']; // Default patterns

        if (fs.existsSync(ignoreFilePath)) {
            const ignoreContent = fs.readFileSync(ignoreFilePath, 'utf-8');
            ignoreContent.split('\n').forEach(line => {
                const pattern = line.trim();
                if (pattern && !pattern.startsWith('#')) {
                    ignorePatterns.push(pattern);
                }
            });
        }

        // Helper function to check if path should be ignored
        const shouldIgnore = (filePath: string): boolean => {
            const relativePath = path.relative(scriptFolderPath, filePath);
            return ignorePatterns.some(pattern => {
                if (pattern.endsWith('/')) {
                    // Directory pattern
                    return relativePath.startsWith(pattern.slice(0, -1)) ||
                        relativePath.includes(`/${pattern.slice(0, -1)}/`) ||
                        relativePath.includes(`\\${pattern.slice(0, -1)}\\`);
                } else if (pattern.includes('*')) {
                    // Wildcard pattern (simple implementation)
                    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                    return regex.test(relativePath);
                }
                return relativePath === pattern;
            });
        };

        // Create ZIP archive
        const archive = archiver('zip', { zlib: { level: 9 } });

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename=script-${script.name}.zip`);

        archive.pipe(res);

        // Add metadata JSON
        const metadata = {
            _id: script._id,
            name: script.name,
            path: script.path,
            entrypoint: script.entrypoint,
            description: script.description,
            envVars: script.envVars
        };
        archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });

        // Add all files from script folder, respecting .acmeignore
        const addFilesRecursively = (currentPath: string, basePath: string) => {
            const entries = fs.readdirSync(currentPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);

                if (shouldIgnore(fullPath)) {
                    continue;
                }

                if (entry.isDirectory()) {
                    addFilesRecursively(fullPath, basePath);
                } else {
                    const relativePath = path.relative(basePath, fullPath);
                    archive.file(fullPath, { name: relativePath });
                }
            }
        };

        addFilesRecursively(scriptFolderPath, scriptFolderPath);

        await archive.finalize();
    });

    importScript = asyncHandler(async (req: Request, res: Response) => {
        if (!req.file) {
            res.status(400);
            throw new Error('No file uploaded');
        }

        const AdmZip = require('adm-zip');
        const { execSync } = require('child_process');
        const zip = new AdmZip(req.file.buffer);
        const zipEntries = zip.getEntries();

        // Find metadata.json
        const metadataEntry = zipEntries.find((entry: any) => entry.entryName === 'metadata.json');
        if (!metadataEntry) {
            res.status(400);
            throw new Error('Invalid script package: metadata.json not found');
        }

        const metadata = JSON.parse(metadataEntry.getData().toString('utf8'));

        const scriptsFolder = process.env.SCRIPTS_FOLDER || '.';

        // Ensure scripts folder exists
        if (!fs.existsSync(scriptsFolder)) {
            fs.mkdirSync(scriptsFolder, { recursive: true });
        }

        // Create script folder
        const scriptFolderPath = path.join(scriptsFolder, metadata.path);

        // Remove existing folder if updating
        if (fs.existsSync(scriptFolderPath)) {
            fs.rmSync(scriptFolderPath, { recursive: true, force: true });
        }

        fs.mkdirSync(scriptFolderPath, { recursive: true });

        // Extract all files except metadata.json
        const initLog: string[] = [];
        let hasInitScript = false;

        for (const entry of zipEntries) {
            if (entry.entryName === 'metadata.json') {
                continue;
            }

            const entryPath = path.join(scriptFolderPath, entry.entryName);

            if (entry.isDirectory) {
                fs.mkdirSync(entryPath, { recursive: true });
            } else {
                // Ensure parent directory exists
                const entryDir = path.dirname(entryPath);
                if (!fs.existsSync(entryDir)) {
                    fs.mkdirSync(entryDir, { recursive: true });
                }

                // Write file
                fs.writeFileSync(entryPath, entry.getData());

                // Make executable if it's a script file
                if (entry.entryName.endsWith('.sh') || entry.entryName.endsWith('.py') ||
                    entry.entryName === metadata.entrypoint || entry.entryName === 'init.js') {
                    try {
                        fs.chmodSync(entryPath, '755');
                    } catch (error) {
                        // Ignore on Windows
                    }
                }

                // Check if init.js exists
                if (entry.entryName === 'init.js') {
                    hasInitScript = true;
                }
            }
        }

        // Run init.js if present
        if (hasInitScript) {
            const initPath = path.join(scriptFolderPath, 'init.js');

            try {
                initLog.push('Running init.js...');

                const output = execSync('node init.js', {
                    cwd: scriptFolderPath,
                    timeout: 300000, // 5 minutes
                    encoding: 'utf-8',
                    stdio: 'pipe'
                });

                initLog.push('Init completed successfully');
                if (output) {
                    initLog.push('Init output:', output);
                }
            } catch (error: any) {
                initLog.push('Init script failed:', error.message);
                if (error.stdout) initLog.push('stdout:', error.stdout);
                if (error.stderr) initLog.push('stderr:', error.stderr);

                // Log warning but don't fail the import
                logger.warn(`Init script failed for ${metadata.name}: ${error.message}`);
            }
        }

        // Upsert script in database using _id
        let script;
        if (metadata._id) {
            // Try to find by _id
            script = await PostIssueScript.findById(metadata._id);
            if (script) {
                // Update existing
                script.name = metadata.name;
                script.path = metadata.path;
                script.entrypoint = metadata.entrypoint || 'script.sh';
                script.description = metadata.description;
                script.envVars = metadata.envVars;
                await script.save();

                await ActivityLogService.log(
                    'postScriptUpdated',
                    req,
                    {
                        resourceType: "script",
                        scriptName: script.name,
                        scriptPath: script.path,
                        initLog: initLog.length > 0 ? initLog.join('\n') : undefined
                    }
                );
            } else {
                // Create new with provided _id
                script = await PostIssueScript.create({
                    ...metadata,
                    entrypoint: metadata.entrypoint || 'script.sh'
                });

                await ActivityLogService.log(
                    'postScriptCreated',
                    req,
                    {
                        resourceType: "script",
                        scriptName: script.name,
                        scriptPath: script.path,
                        initLog: initLog.length > 0 ? initLog.join('\n') : undefined
                    }
                );
            }
        } else {
            // No _id - create new
            script = await PostIssueScript.create({
                ...metadata,
                entrypoint: metadata.entrypoint || 'script.sh'
            });

            await ActivityLogService.log(
                'postScriptCreated',
                req,
                {
                    resourceType: "script",
                    scriptName: script.name,
                    scriptPath: script.path,
                    initLog: initLog.length > 0 ? initLog.join('\n') : undefined
                }
            );
        }

        res.status(201).json({
            script,
            initLog: initLog.length > 0 ? initLog : undefined
        });
    });

    getBasePath = asyncHandler(async (req: Request, res: Response) => {
        const basePath = process.env.SCRIPTS_FOLDER || '.';
        res.type('text/plain').send(basePath);
    });

    runInit = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;

        const script = await PostIssueScript.findById(id);
        if (!script) {
            res.status(404);
            throw new Error('Script not found');
        }

        const scriptFolder = process.env.SCRIPTS_FOLDER || '.';
        const scriptFolderPath = path.join(scriptFolder, script.path);
        const initPath = path.join(scriptFolderPath, 'init.js');

        // Check if init.js exists
        if (!fs.existsSync(initPath)) {
            res.status(404);
            throw new Error('init.js not found in script folder');
        }

        let success = false;
        let logReponse: string[] = [];
        try {
            logger.info(`Running init.js for script ${script.name}`);
            logger.info(`Working directory: ${scriptFolderPath}`);
            logger.info('---');

            const { execSync } = require('child_process');
            const output = execSync('node init.js', {
                cwd: scriptFolderPath,
                timeout: 300000, // 5 minutes
                encoding: 'utf-8',
                stdio: 'pipe'
            });

            success = true;
            logger.info('✓ Init completed successfully');
            if (output) {
                logger.info('');
                logger.info('Output:');
                logger.info(output);

                logReponse.push(output);
            }

            logger.info(`Init script executed successfully for ${script.name}`);
        } catch (error: any) {
            success = false;
            logger.info('✗ Init script failed');
            logger.info('');
            logger.info(`Error: ${error.message}`);
            if (error.stdout) {
                logger.info('');
                logger.info('stdout:');
                logger.info(error.stdout);

                logReponse.push(error.stdout);
            }
            if (error.stderr) {
                logger.info('');
                logger.info('stderr:');
                logger.info(error.stderr);

                logReponse.push(error.stderr);
            }

            logger.error(`Init script failed for ${script.name}: ${error.message}`);
        }

        res.status(success ? 200 : 500).json({
            success,
            log: logReponse.join('\n')
        });
    });
}
