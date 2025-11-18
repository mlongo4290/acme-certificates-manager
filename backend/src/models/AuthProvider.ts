import { model, Schema } from 'mongoose';

const AuthProviderSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        slug: {
            type: String,
            unique: true,
            trim: true,
            lowercase: true
        },
        type: {
            type: String,
            required: true,
            enum: ['local', 'ldap', 'oauth2', 'azure-ad', 'oidc', 'saml']
        },
        enabled: {
            type: Boolean,
            default: false
        },
        priority: {
            type: Number,
            default: 0
        },
        settings: {
            type: Schema.Types.Mixed,
            default: {}
        }
    },
    {
        timestamps: true
    }
);

// Generate slug from name before saving
AuthProviderSchema.pre('save', function (next) {
    // Always generate slug if not present or if name was modified
    if (!this.slug || this.isModified('name')) {
        this.slug = this.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with -
            .replace(/^-+|-+$/g, '');     // Remove leading/trailing -
    }
    next();
});

export const AuthProvider = model('AuthProvider', AuthProviderSchema);
