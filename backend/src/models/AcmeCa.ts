import { model, Schema } from 'mongoose';

const AcmeCaSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        server: {
            type: String,
            required: true,
            trim: true
        },
        enabled: {
            type: Boolean,
            default: true
        },
        isDefault: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
);

// Ensure only one CA can be default
AcmeCaSchema.pre('save', async function (next) {
    if (this.isDefault) {
        await model('AcmeCa').updateMany(
            { _id: { $ne: this._id } },
            { $set: { isDefault: false } }
        );
    }
    next();
});

export const AcmeCa = model('AcmeCa', AcmeCaSchema);
