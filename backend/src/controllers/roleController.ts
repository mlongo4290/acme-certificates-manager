import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Role, PERMISSION_RESOURCES, PermissionLevel } from '../models/Role';
import { User } from '../models/User';
import { Logger } from '../services/logger.service';

const logger = new Logger('RoleController');

// Get all roles (paginated)
export const getRoles = async (req: AuthRequest, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 0;
        const sortField = (req.query.sortField as string) || 'name';
        const sortOrder = parseInt(req.query.sortOrder as string) || 1;

        const filterQuery: any = {};

        const totalRecords = await Role.countDocuments(filterQuery);

        const sortObj: any = {};
        sortObj[sortField] = sortOrder;

        let query = Role.find(filterQuery).sort(sortObj);
        if (limit > 0) {
            query = query.skip(page * limit).limit(limit);
        }

        const roles = await query;

        res.json({ data: roles, totalRecords });
    } catch (error) {
        logger.error('Error fetching roles:', error as Error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get role by ID
export const getRoleById = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const role = await Role.findById(id);

        if (!role) {
            return res.status(404).json({ message: 'Role not found' });
        }

        res.json(role);
    } catch (error) {
        logger.error('Error fetching role:', error as Error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Build a valid permissions object from raw input, filling in defaults
const buildPermissions = (rawPerms: any): Record<string, PermissionLevel> => {
    const validLevels: PermissionLevel[] = ['none', 'read', 'write'];
    const permissions: Record<string, PermissionLevel> = {};
    for (const resource of PERMISSION_RESOURCES) {
        const val = rawPerms?.[resource];
        permissions[resource] = validLevels.includes(val) ? val : 'none';
    }
    return permissions;
};

// Create role
export const createRole = async (req: AuthRequest, res: Response) => {
    try {
        const { name, description, isAdmin, permissions } = req.body;

        if (!name) {
            return res.status(400).json({ message: 'Role name is required' });
        }

        const existing = await Role.findOne({ name });
        if (existing) {
            return res.status(400).json({ message: 'A role with this name already exists' });
        }

        const role = new Role({
            name,
            description: description || '',
            isAdmin: isAdmin === true,
            permissions: buildPermissions(permissions)
        });

        await role.save();

        res.status(201).json(role);
    } catch (error) {
        logger.error('Error creating role:', error as Error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Update role
export const updateRole = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { name, description, isAdmin, permissions } = req.body;

        const role = await Role.findById(id);
        if (!role) {
            return res.status(404).json({ message: 'Role not found' });
        }

        if (name !== undefined) {
            // Check uniqueness if name changed
            if (name !== role.name) {
                const existing = await Role.findOne({ name, _id: { $ne: id } });
                if (existing) {
                    return res.status(400).json({ message: 'A role with this name already exists' });
                }
            }
            role.name = name;
        }

        if (description !== undefined) {
            role.description = description;
        }

        if (isAdmin !== undefined) {
            (role as any).isAdmin = isAdmin === true;
        }

        if (permissions !== undefined) {
            const built = buildPermissions(permissions);
            for (const resource of PERMISSION_RESOURCES) {
                (role as any).permissions[resource] = built[resource];
            }
        }

        await role.save();

        res.json(role);
    } catch (error) {
        logger.error('Error updating role:', error as Error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Delete role
export const deleteRole = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const role = await Role.findById(id);
        if (!role) {
            return res.status(404).json({ message: 'Role not found' });
        }

        if ((role as any).isAdmin) {
            return res.status(400).json({ message: 'Cannot delete the administrator role' });
        }

        // Check if any users are assigned to this role
        const usersInRole = await User.countDocuments({ role: id });
        if (usersInRole > 0) {
            return res.status(400).json({
                message: `Cannot delete role: ${usersInRole} user(s) are assigned to this role`
            });
        }

        await Role.findByIdAndDelete(id);

        res.json({ message: 'Role deleted successfully' });
    } catch (error) {
        logger.error('Error deleting role:', error as Error);
        res.status(500).json({ message: 'Server error' });
    }
};
