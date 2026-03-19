import { model, Schema } from 'mongoose';

const messageSchema = new Schema({
    level: { type: String, enum: ['info', 'warn', 'error', 'success'], default: 'info' },
    text: { type: String, required: true },
    ts: { type: Date, default: Date.now }
}, { _id: false });

const jobSchema = new Schema({
    certId: { type: Schema.Types.ObjectId, ref: 'Certificate', required: true },
    certDomain: { type: String, required: true },
    type: { type: String, enum: ['issue', 'renew', 'reissue', 'dry-run'], required: true },
    status: { type: String, enum: ['running', 'success', 'error'], default: 'running' },
    messages: { type: [messageSchema], default: [] },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date }
}, { timestamps: false, collection: 'certoperations' });

// Auto-delete completed jobs after 7 days
jobSchema.index(
    { completedAt: 1 },
    { expireAfterSeconds: 7 * 24 * 3600, partialFilterExpression: { status: { $ne: 'running' } } }
);

export const Job = model('CertOperation', jobSchema);
