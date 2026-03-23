import { generateKeyPairSync } from 'crypto';
import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import * as sshpk from 'sshpk';
import { SshKey } from '../models/SshKey';
import { ActivityLogService } from '../services/activityLog.service';
import { Logger } from '../services/logger.service';
import { encrypt } from '../utils/encryption';

const logger = new Logger('SshKeyController');

export class SshKeyController {
    getAllKeys = asyncHandler(async (req: Request, res: Response) => {
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
        const totalRecords = await SshKey.countDocuments(filterQuery);

        // Build sort object
        const sortObj: any = {};
        sortObj[sortField] = sortOrder;

        // Get paginated data
        const keys = await SshKey.find(filterQuery)
            .sort(sortObj)
            .skip(page * limit)
            .limit(limit);

        res.json({
            data: keys,
            totalRecords
        });
    });

    private buildFilterQuery(_field: string, value: any, matchMode: string): any {
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

    // Get single SSH key (without private key)
    getKey = asyncHandler(async (req: Request, res: Response) => {
        const key = await SshKey.findById(req.params.id).select('-privateKey');

        if (!key) {
            res.status(404).json({ message: 'SSH_KEY_NOT_FOUND' });
            return;
        }

        res.json(key);
    });

    // Create new SSH key
    createKey = asyncHandler(async (req: Request, res: Response) => {
        const { name, description, privateKey, publicKey, keyType, keySize, username, port } = req.body;

        // Validate required fields
        if (!name || !privateKey || !publicKey || !keyType) {
            res.status(400).json({ message: 'NAME_PRIVATE_KEY_PUBLIC_KEY_KEYTYPE_REQUIRED' });
            return;
        }

        // Check if name already exists
        const existingKey = await SshKey.findOne({ name });
        if (existingKey) {
            res.status(409).json({ message: 'SSH_KEY_NAME_ALREADY_EXISTS' });
            return;
        }

        // Encrypt private key before storing
        const encryptedPrivateKey = encrypt(privateKey);

        const newKey = await SshKey.create({
            name,
            description: description || '',
            privateKey: encryptedPrivateKey,
            publicKey,
            keyType,
            keySize,
            username: username || 'root',
            port: port || 22
        });

        // Log activity
        await ActivityLogService.log(
            'sshKeyCreated',
            req,
            { resourceType: 'sshKey', resourceId: newKey._id.toString(), resourceName: name }
        );

        // Return without private key
        const keyResponse = await SshKey.findById(newKey._id).select('-privateKey');
        res.status(201).json(keyResponse);
    });

    // Update SSH key
    updateKey = asyncHandler(async (req: Request, res: Response) => {
        const { name, description, privateKey, publicKey, keyType, keySize, username, port } = req.body;

        const key = await SshKey.findById(req.params.id);

        if (!key) {
            res.status(404).json({ message: 'SSH_KEY_NOT_FOUND' });
            return;
        }

        // Check if new name conflicts with existing key
        if (name && name !== key.name) {
            const existingKey = await SshKey.findOne({ name });
            if (existingKey) {
                res.status(409).json({ message: 'SSH_KEY_NAME_ALREADY_EXISTS' });
                return;
            }
            key.name = name;
        }

        if (description !== undefined) key.description = description;
        if (keyType) key.keyType = keyType;
        if (keySize !== undefined) key.keySize = keySize;
        if (username) key.username = username;
        if (port) key.port = port;

        // Update keys if provided
        if (privateKey) {
            key.privateKey = encrypt(privateKey);
        }
        if (publicKey) {
            key.publicKey = publicKey;
        }

        await key.save();

        // Log activity
        await ActivityLogService.log(
            'sshKeyUpdated',
            req,
            { resourceType: 'sshKey', resourceId: key._id.toString(), resourceName: key.name }
        );

        // Return without private key
        const keyResponse = await SshKey.findById(key._id).select('-privateKey');
        res.json(keyResponse);
    });

    // Delete SSH key
    deleteKey = asyncHandler(async (req: Request, res: Response) => {
        const key = await SshKey.findById(req.params.id);

        if (!key) {
            res.status(404).json({ message: 'SSH_KEY_NOT_FOUND' });
            return;
        }

        const keyName = key.name;
        const keyId = key._id.toString();
        await SshKey.deleteOne({ _id: req.params.id });

        // Log activity
        await ActivityLogService.log(
            'sshKeyDeleted',
            req,
            { resourceType: 'sshKey', resourceId: keyId, resourceName: keyName }
        );

        res.json({ message: 'SSH_KEY_DELETED' });
    });

    // Generate SSH key pair
    generateKeyPair = asyncHandler(async (req: Request, res: Response) => {
        const { keyType = 'ed25519', bits } = req.body;

        try {
            let keyPairOptions: any;
            let keySize: number | undefined;
            const normalizedKeyType = keyType.toLowerCase();

            // Configure key generation based on type
            switch (normalizedKeyType) {
                // Classic algorithms
                case 'rsa':
                case 'rsa-pss':
                    keySize = bits || 4096;
                    keyPairOptions = {
                        modulusLength: keySize,
                        publicKeyEncoding: { type: 'spki', format: 'pem' },
                        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
                    };
                    break;

                case 'dsa':
                    keySize = bits || 2048;
                    keyPairOptions = {
                        modulusLength: keySize,
                        divisorLength: keySize === 3072 ? 256 : 224,
                        publicKeyEncoding: { type: 'spki', format: 'pem' },
                        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
                    };
                    break;

                case 'ec':
                    // Elliptic curve - supports multiple curves
                    const ecCurve = bits === 521 ? 'secp521r1' : bits === 384 ? 'secp384r1' : 'prime256v1';
                    keySize = bits || 256;
                    keyPairOptions = {
                        namedCurve: ecCurve,
                        publicKeyEncoding: { type: 'spki', format: 'pem' },
                        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
                    };
                    break;

                case 'dh':
                    // Diffie-Hellman
                    keySize = bits || 2048;
                    keyPairOptions = {
                        primeLength: keySize,
                        publicKeyEncoding: { type: 'spki', format: 'pem' },
                        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
                    };
                    break;

                // Edwards-curve algorithms (fixed size)
                case 'ed25519':
                case 'ed448':
                case 'x25519':
                case 'x448':
                    keyPairOptions = {
                        publicKeyEncoding: { type: 'spki', format: 'pem' },
                        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
                    };
                    keySize = undefined;
                    break;

                // Post-quantum ML-DSA (fixed sizes)
                case 'ml-dsa-44':
                case 'ml-dsa-65':
                case 'ml-dsa-87':
                    keyPairOptions = {
                        publicKeyEncoding: { type: 'spki', format: 'pem' },
                        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
                    };
                    keySize = undefined;
                    break;

                // Post-quantum ML-KEM (fixed sizes)
                case 'ml-kem-512':
                case 'ml-kem-768':
                case 'ml-kem-1024':
                    keyPairOptions = {
                        publicKeyEncoding: { type: 'spki', format: 'pem' },
                        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
                    };
                    keySize = undefined;
                    break;

                // Post-quantum SLH-DSA variants (fixed sizes)
                case 'slh-dsa-sha2-128f':
                case 'slh-dsa-sha2-128s':
                case 'slh-dsa-sha2-192f':
                case 'slh-dsa-sha2-192s':
                case 'slh-dsa-sha2-256f':
                case 'slh-dsa-sha2-256s':
                case 'slh-dsa-shake-128f':
                case 'slh-dsa-shake-128s':
                case 'slh-dsa-shake-192f':
                case 'slh-dsa-shake-192s':
                case 'slh-dsa-shake-256f':
                case 'slh-dsa-shake-256s':
                    keyPairOptions = {
                        publicKeyEncoding: { type: 'spki', format: 'pem' },
                        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
                    };
                    keySize = undefined;
                    break;

                default:
                    res.status(400).json({
                        message: 'INVALID_KEY_TYPE',
                        error: `Unsupported key type: ${keyType}`
                    });
                    return;
            }

            // Generate key pair
            const { publicKey, privateKey } = generateKeyPairSync(normalizedKeyType, keyPairOptions);

            // Convert PEM public key to SSH format using sshpk
            // Note: sshpk may not support all post-quantum algorithms yet
            let sshPublicKey: string;
            try {
                const key = sshpk.parseKey(publicKey, 'pem');
                key.comment = '';
                sshPublicKey = key.toString('ssh');
            } catch (parseError: any) {
                // If sshpk cannot parse (e.g., post-quantum algorithms), use PEM format
                logger.warn(`sshpk cannot parse ${normalizedKeyType}, using PEM format: ${parseError.message || parseError}`);
                sshPublicKey = publicKey;
            }

            res.json({
                privateKey,
                publicKey: sshPublicKey,
                keyType: normalizedKeyType,
                keySize
            });
        } catch (error: any) {
            logger.error('Failed to generate SSH key pair:', error);
            res.status(500).json({
                message: 'FAILED_TO_GENERATE_KEY_PAIR',
                error: error.message
            });
        }
    });
}

export const sshKeyController = new SshKeyController();
