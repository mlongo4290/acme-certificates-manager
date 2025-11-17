import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { model, Schema } from 'mongoose';

const ApiTokenSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        tokenHash: {
            type: String,
            required: true,
            unique: true
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        expiresAt: {
            type: Date,
            required: false
        },
        lastUsedAt: {
            type: Date,
            required: false
        },
        isActive: {
            type: Boolean,
            default: true,
            required: true
        }
    },
    {
        timestamps: true
    }
);

// Hash token before saving
ApiTokenSchema.pre('save', async function (next) {
    if (!this.isModified('tokenHash')) {
        return next();
    }

    try {
        const salt = await bcrypt.genSalt(10);
        this.tokenHash = await bcrypt.hash(this.tokenHash, salt);
        next();
    } catch (error: any) {
        next(error);
    }
});

// Method to compare token
export const compareToken = async function (candidateToken: string, tokenHash: string): Promise<boolean> {
    return bcrypt.compare(candidateToken, tokenHash);
};

// Generate a secure random token (called before save)
export const generateApiToken = (): string => {
    return crypto.randomBytes(32).toString('hex'); // 64 character hex string
};

export const ApiToken = model('ApiToken', ApiTokenSchema);
