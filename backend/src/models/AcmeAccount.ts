import { model, Schema } from 'mongoose';

const AcmeAccountSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        email: {
            type: String,
            required: true,
            trim: true
        },
        caId: {
            type: Schema.Types.ObjectId,
            ref: 'AcmeCa',
            required: true
        },
        eabKeyId: {
            type: String,
            trim: true
        },
        eabHmacKey: {
            type: String,
            trim: true
        },
        accountKeyJwk: {
            type: String,
            select: false
        },
        accountUrl: {
            type: String,
            trim: true
        },
        registeredAt: {
            type: Date
        }
    },
    {
        timestamps: true
    }
);

// Index for faster queries
AcmeAccountSchema.index({ caId: 1, email: 1 }, { unique: true });

export const AcmeAccount = model('AcmeAccount', AcmeAccountSchema);