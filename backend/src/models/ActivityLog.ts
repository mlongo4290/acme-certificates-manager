import { model, Schema } from 'mongoose';

const activityLogSchema = new Schema(
    {
        type: {
            type: String,
            required: true,
            enum: [
                'certificateIssued',
                'certificateRenewed',
                'certificateCreated',
                'certificateUpdated',
                'certificateDeleted',
                'certificateError',
                'dnsProviderAdded',
                'dnsProviderUpdated',
                'dnsProviderDeleted',
                'dnsProviderTestSuccess',
                'dnsProviderTestFailed',
                'caAdded',
                'caUpdated',
                'caDeleted',
                'caSetDefault',
                'acmeAccountCreated',
                'acmeAccountRegistered',
                'acmeAccountDeleted',
                'userCreated',
                'userUpdated',
                'userDeleted',
                'userLogin',
                'authProviderAdded',
                'authProviderUpdated',
                'authProviderDeleted',
                'configChanged',
                'systemError',
                'postScriptExecuted',
                'postScriptFailed',
                'postScriptCreated',
                'postScriptUpdated',
                'postScriptDeleted'
            ],
            index: true,
        },
        message: {
            type: String,
            required: false, // Made optional
        },
        timestamp: {
            type: Date,
            default: Date.now,
            index: true,
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            index: true,
        },
        username: {
            type: String,
        },
        metadata: {
            type: Schema.Types.Mixed,
            default: {},
        },
    },
    {
        timestamps: true,
    }
);

// Indice composto per query efficienti
activityLogSchema.index({ type: 1, timestamp: -1 });
activityLogSchema.index({ timestamp: -1 }); // Per housekeeping

export const ActivityLog = model('ActivityLog', activityLogSchema);
