import { model, Schema } from 'mongoose';

const dnsProviderSchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true,
    },
    type: {
        type: String,
        required: true,
        default: 'manual'
    },
    enabled: {
        type: Boolean,
        default: true,
    },
    credentials: {
        type: Map,
        of: String,
    },
    description: {
        type: String,
    },
    dnsPropagationTime: {
        type: Number,
        default: 60,
        min: 0,
        max: 600
    }
}, {
    timestamps: true,
});

dnsProviderSchema.index({ enabled: 1 });

export const DnsProvider = model('DnsProvider', dnsProviderSchema);
