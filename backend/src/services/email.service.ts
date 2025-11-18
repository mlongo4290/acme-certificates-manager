import * as fs from 'fs';
import mjml2html from 'mjml';
import nodemailer from 'nodemailer';
import * as path from 'path';
import { Logger } from './logger.service';

export class EmailService {
    private transporter: nodemailer.Transporter | null = null;
    private logger = new Logger('Email');
    private templatesPath: string;

    constructor() {
        this.templatesPath = path.join(__dirname, '..', 'templates', 'emails');
        this.initialize();
    }

    private initialize() {
        const smtpHost = process.env.SMTP_HOST;
        const smtpPort = process.env.SMTP_PORT;
        const smtpUser = process.env.SMTP_USER;
        const smtpPass = process.env.SMTP_PASS;
        const smtpSecure = process.env.SMTP_SECURE === 'true';

        if (!smtpHost || !smtpPort) {
            this.logger.warn('SMTP not configured. Email notifications will be disabled.');
            this.logger.warn('To enable emails, set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env');
            return;
        }

        try {
            const config = {
                host: smtpHost,
                port: parseInt(smtpPort),
                secure: smtpSecure
            }

            if (smtpUser && smtpPass) {
                Object.assign(config, {
                    auth: {
                        user: smtpUser,
                        pass: smtpPass
                    }
                });
            }

            this.transporter = nodemailer.createTransport(config);

            this.logger.info('Email service initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize email service:', error as Error);
        }
    }

    /**
     * Compile MJML to HTML with caching based on file modification time
     */
    private compileMjml(mjmlPath: string, htmlPath: string): string {
        const mjmlContent = fs.readFileSync(mjmlPath, 'utf-8');
        const mjmlStat = fs.statSync(mjmlPath);

        // Check if cached HTML exists and is newer than MJML source
        if (fs.existsSync(htmlPath)) {
            const htmlStat = fs.statSync(htmlPath);
            if (htmlStat.mtime >= mjmlStat.mtime) {
                // Use cached version
                return fs.readFileSync(htmlPath, 'utf-8');
            }
        }

        // Compile MJML
        this.logger.info(`Compiling MJML template: ${path.basename(mjmlPath)}`);
        const result = mjml2html(mjmlContent, {
            validationLevel: 'soft',
            minify: false
        });

        if (result.errors.length > 0) {
            this.logger.warn(`MJML compilation warnings: ${result.errors}`);
        }

        // Cache the compiled HTML
        fs.writeFileSync(htmlPath, result.html, 'utf-8');

        return result.html;
    }

    /**
     * Load and render a template with variables (supports both MJML and HTML)
     */
    private loadTemplate(templateName: string, language: string, variables: Record<string, any>): string {
        const mjmlFile = path.join(this.templatesPath, language, `${templateName}.mjml`);
        const htmlFile = path.join(this.templatesPath, language, `${templateName}.html`);

        let template: string;

        // Check for MJML template first
        if (fs.existsSync(mjmlFile)) {
            template = this.compileMjml(mjmlFile, htmlFile);
        } else if (fs.existsSync(htmlFile)) {
            template = fs.readFileSync(htmlFile, 'utf-8');
        } else {
            // Fallback to English
            const enMjmlFile = path.join(this.templatesPath, 'en', `${templateName}.mjml`);
            const enHtmlFile = path.join(this.templatesPath, 'en', `${templateName}.html`);

            if (fs.existsSync(enMjmlFile)) {
                template = this.compileMjml(enMjmlFile, enHtmlFile);
            } else if (fs.existsSync(enHtmlFile)) {
                template = fs.readFileSync(enHtmlFile, 'utf-8');
            } else {
                this.logger.error(`Template not found: ${templateName} (language: ${language})`);
                throw new Error(`Email template not found: ${templateName}`);
            }
        }

        // Replace all variables in the template
        Object.keys(variables).forEach(key => {
            const value = variables[key] !== undefined && variables[key] !== null ? String(variables[key]) : 'N/A';
            const regex = new RegExp(`{{${key}}}`, 'g');
            template = template.replace(regex, value);
        });

        return template;
    }

    /**
     * Send an email using a template
     */
    async sendEmail(
        to: string,
        subject: string,
        templateName: string,
        variables: Record<string, any>,
        language: string = 'en'
    ): Promise<boolean> {
        if (!this.transporter) {
            this.logger.info(`Email service not enabled. Templated email to ${to} not sent.`);
            return false;
        }

        const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@acme-certificates-manager.com';
        const fromName = process.env.SMTP_FROM_NAME || 'ACME Certificates Manager';

        try {
            const htmlBody = this.loadTemplate(templateName, language, variables);

            // Create plain text version by stripping HTML
            const textBody = htmlBody
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                .replace(/<[^>]+>/g, '')
                .replace(/\s+/g, ' ')
                .trim();

            await this.transporter.sendMail({
                from: `"${fromName}" <${fromEmail}>`,
                to: to,
                subject: subject,
                html: htmlBody,
                text: textBody
            });

            this.logger.info(`Templated email sent to ${to} (template: ${templateName}, language: ${language})`);
            return true;
        } catch (error) {
            this.logger.error('Failed to send templated email:', error as Error);
            return false;
        }
    }
}

// Singleton instance
export const emailService = new EmailService();
