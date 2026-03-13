import { model, Schema } from 'mongoose';

const notificationLogSchema = new Schema({
    alertType: {
        type: String,
        required: true,
        enum: [
            'certificate_renewed_success',
            'certificate_renewed_failed',
            'certificate_issued_success',
            'certificate_issued_failed',
            'post_script_success',
            'post_script_failed'
        ],
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: false,
    },
    webhookId: {
        type: Schema.Types.ObjectId,
        ref: 'Webhook',
        required: false,
    },
    channel: {
        type: String,
        enum: ['email', 'webhook'],
        default: 'email',
    },
    recipient: {
        type: String, // Email address or webhook URL
        required: true,
    },
    status: {
        type: String,
        enum: ['sent', 'failed', 'pending'],
        default: 'pending',
    },
    sentAt: {
        type: Date,
    },
    error: {
        type: String, // Error message if failed
    },
    metadata: {
        type: Object, // Certificate data, error details, etc.
        default: {},
    },
    retryCount: {
        type: Number,
        default: 0,
    },
}, {
    timestamps: true,
});

notificationLogSchema.index({ alertType: 1, createdAt: -1 });
notificationLogSchema.index({ userId: 1, createdAt: -1 });
notificationLogSchema.index({ status: 1 });
notificationLogSchema.index({ sentAt: 1 });

export const NotificationLog = model('NotificationLog', notificationLogSchema);
