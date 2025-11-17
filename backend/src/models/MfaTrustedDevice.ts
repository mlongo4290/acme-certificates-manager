import { model, Schema } from 'mongoose';

const MfaTrustedDeviceSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        deviceId: {
            type: String,
            required: true,
            unique: true
        },
        deviceName: {
            type: String,
            required: false
        },
        userAgent: {
            type: String,
            required: false
        },
        ipAddress: {
            type: String,
            required: false
        },
        expiresAt: {
            type: Date,
            required: true
        },
        lastUsedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

// Index for cleanup of expired devices
MfaTrustedDeviceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index for user queries
MfaTrustedDeviceSchema.index({ userId: 1, deviceId: 1 });

export const MfaTrustedDevice = model('MfaTrustedDevice', MfaTrustedDeviceSchema);
