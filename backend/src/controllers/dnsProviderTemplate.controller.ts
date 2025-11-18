import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { DnsProviderTemplate } from '../models/dnsProviderTemplate.model';
import { Logger } from '../services/logger.service';

const logger = new Logger('DnsProviderTemplateController');

export class DnsProviderTemplateController {
    // Get all provider templates
    async getAllTemplates(req: AuthRequest, res: Response) {
        try {
            const templates = await DnsProviderTemplate.find({ enabled: true })
                .select('-__v')
                .sort({ name: 1 });
            res.json(templates);
        } catch (error) {
            logger.error('Error fetching DNS provider templates:', error as Error);
            res.status(500).json({ message: 'Failed to fetch DNS provider templates' });
        }
    }

    // Get template by identifier
    async getTemplateByIdentifier(req: AuthRequest, res: Response) {
        try {
            const { identifier } = req.params;
            const template = await DnsProviderTemplate.findOne({ identifier, enabled: true });

            if (!template) {
                return res.status(404).json({ message: 'DNS provider template not found' });
            }

            res.json(template);
        } catch (error) {
            logger.error('Error fetching DNS provider template:', error as Error);
            res.status(500).json({ message: 'Failed to fetch DNS provider template' });
        }
    }

    // Create custom template (admin only)
    async createTemplate(req: AuthRequest, res: Response) {
        try {
            const template = new DnsProviderTemplate(req.body);
            await template.save();
            res.status(201).json(template);
        } catch (error: any) {
            logger.error('Error creating DNS provider template:', error);
            if (error.code === 11000) {
                return res.status(400).json({ message: 'Template with this identifier already exists' });
            }
            res.status(500).json({ message: 'Failed to create DNS provider template' });
        }
    }

    // Update template (admin only)
    async updateTemplate(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            const template = await DnsProviderTemplate.findByIdAndUpdate(
                id,
                req.body,
                { new: true, runValidators: true }
            );

            if (!template) {
                return res.status(404).json({ message: 'DNS provider template not found' });
            }

            res.json(template);
        } catch (error) {
            logger.error('Error updating DNS provider template:', error as Error);
            res.status(500).json({ message: 'Failed to update DNS provider template' });
        }
    }

    // Delete template (admin only)
    async deleteTemplate(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            const template = await DnsProviderTemplate.findByIdAndDelete(id);

            if (!template) {
                return res.status(404).json({ message: 'DNS provider template not found' });
            }

            res.json({ message: 'DNS provider template deleted successfully' });
        } catch (error) {
            logger.error('Error deleting DNS provider template:', error as Error);
            res.status(500).json({ message: 'Failed to delete DNS provider template' });
        }
    }
}
