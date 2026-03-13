import { model, Schema } from 'mongoose';

export type AlertType =
    | 'certificate_renewed_success'
    | 'certificate_renewed_failed'
    | 'certificate_issued_success'
    | 'certificate_issued_failed'
    | 'post_script_success'
    | 'post_script_failed';

const VALID_EVENTS: AlertType[] = [
    'certificate_renewed_success',
    'certificate_renewed_failed',
    'certificate_issued_success',
    'certificate_issued_failed',
    'post_script_success',
    'post_script_failed',
];

const webhookSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    url: {
        type: String,
        required: true,
        trim: true,
    },
    events: {
        type: [String],
        enum: VALID_EVENTS,
        default: [],
    },
    // Optional HMAC-SHA256 secret. If set, the payload is signed and
    // X-Webhook-Signature: sha256=<hex> is added to the request.
    secret: {
        type: String,
        default: null,
    },
    // Optional custom HTTP headers to include in every request
    headers: {
        type: Object,
        default: {},
    },
    enabled: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: true,
});

webhookSchema.index({ enabled: 1 });

export const Webhook = model('Webhook', webhookSchema);
export { VALID_EVENTS };
