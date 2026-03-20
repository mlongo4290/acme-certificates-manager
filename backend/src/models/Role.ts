import { model, Schema } from 'mongoose';

export type PermissionLevel = 'none' | 'read' | 'write';

export const PERMISSION_RESOURCES = [
    'certificates',
    'acmeCa',
    'acmeAccounts',
    'dnsProviders',
    'sshKeys',
    'scripts',
    'webhooks',
    'activityLogs',
    'settings',
    'jobs',
    'renewalCalendar'
] as const;

export type ResourceName = typeof PERMISSION_RESOURCES[number];

export type RolePermissions = {
    [K in ResourceName]: PermissionLevel;
};

const permissionField = {
    type: String,
    enum: ['none', 'read', 'write'],
    default: 'none',
    required: true
};

const RoleSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            unique: true
        },
        description: {
            type: String,
            required: false,
            trim: true
        },
        isAdmin: {
            type: Boolean,
            default: false,
            required: true
        },
        permissions: {
            certificates: { ...permissionField },
            acmeCa: { ...permissionField },
            acmeAccounts: { ...permissionField },
            dnsProviders: { ...permissionField },
            sshKeys: { ...permissionField },
            scripts: { ...permissionField },
            webhooks: { ...permissionField },
            activityLogs: { ...permissionField },
            settings: { ...permissionField },
            jobs: { ...permissionField },
            renewalCalendar: { ...permissionField }
        }
    },
    {
        timestamps: true
    }
);

export const Role = model('Role', RoleSchema);
