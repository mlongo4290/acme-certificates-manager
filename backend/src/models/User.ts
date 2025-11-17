import bcrypt from 'bcryptjs';
import { model, Schema } from 'mongoose';

const UserSchema = new Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true
        },
        password: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: false,
            trim: true,
            lowercase: true
        },
        authProvider: {
            type: String,
            enum: ['local', 'ldap', 'oauth2', 'azure-ad', 'oidc', 'saml'],
            default: 'local',
            required: true
        },
        authProviderName: {
            type: String,
            required: false
        },
        role: {
            type: String,
            enum: ['ADMIN', 'CERT_MANAGER', 'READ_ONLY'],
            default: 'READ_ONLY',
            required: true
        },
        isActive: {
            type: Boolean,
            default: true,
            required: true
        },
        mfaEnabled: {
            type: Boolean,
            default: false,
            required: true
        },
        mfaSecret: {
            type: String,
            required: false
        },
        mfaTrustDuration: {
            type: Number,
            default: 30,
            required: false
        },
        resetPasswordToken: {
            type: String,
            required: false
        },
        resetPasswordExpires: {
            type: Date,
            required: false
        },
        notificationEvents: {
            type: [String],
            default: [],
            required: false
        },
        preferredLanguage: {
            type: String,
            enum: ['en', 'it'],
            default: 'en',
            required: false
        }
    },
    {
        timestamps: true
    }
);

// Hash password before saving
UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error: any) {
        next(error);
    }
});

export const comparePassword = async function (candidatePassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(candidatePassword, hashedPassword);
};

export const User = model('User', UserSchema);
