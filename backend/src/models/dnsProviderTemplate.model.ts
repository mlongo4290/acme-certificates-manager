import { model, Schema } from 'mongoose';

const dnsProviderTemplateSchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true,
    },
    identifier: {
        type: String,
        required: true,
        unique: true,
    },
    description: {
        type: String,
    },
    documentationUrl: {
        type: String,
    },
    // Field definitions for this provider type
    fields: [{
        key: {
            type: String,
            required: true,
        },
        label: {
            type: String,
            required: true,
        },
        type: {
            type: String,
            enum: ['text', 'password', 'textarea'],
            required: true,
        },
        required: {
            type: Boolean,
            default: false,
        },
        placeholder: String,
        hint: String,
    }],
    icon: String,
    enabled: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: true,
});

dnsProviderTemplateSchema.index({ identifier: 1 });
dnsProviderTemplateSchema.index({ enabled: 1 });

export const DnsProviderTemplate = model('DnsProviderTemplate', dnsProviderTemplateSchema);
