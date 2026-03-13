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
        },
        supportsSAN: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

// Index for faster queries (name must be unique per CA, but same email can have multiple accounts)
AcmeAccountSchema.index({ caId: 1, name: 1 }, { unique: true });
AcmeAccountSchema.index({ caId: 1, email: 1 });

export const AcmeAccount = model('AcmeAccount', AcmeAccountSchema);