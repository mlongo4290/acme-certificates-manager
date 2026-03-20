import { model, Schema } from 'mongoose';

const certificateSchema = new Schema({
    domain: {
        type: String,
        required: true,
        unique: true,
    },
    // Additional domains (SAN - Subject Alternative Names)
    additionalDomains: {
        type: [String],
        default: [],
    },
    status: {
        type: String,
        enum: ['valid', 'expired', 'pending', 'error', 'revoked'],
        default: 'pending',
    },
    issueDate: {
        type: Date,
    },
    // Certificate data stored in MongoDB
    certificate: {
        type: String, // PEM format
    },
    privateKey: {
        type: String, // PEM format
    },
    fullChain: {
        type: String, // PEM format (optional)
    },
    challengeType: {
        type: String,
        enum: ['http-01', 'dns-01', 'tls-alpn-01'],
        required: true,
        default: 'http-01',
    },
    certificateAuthority: {
        type: Schema.Types.ObjectId,
        ref: 'AcmeCa',
        required: true,
    },
    acmeAccount: {
        type: Schema.Types.ObjectId,
        ref: 'AcmeAccount',
        required: true,
    },
    dnsProvider: {
        type: Schema.Types.ObjectId,
        ref: 'DnsProvider',
        required: function (this: any) {
            return this.challengeType === 'dns-01';
        },
    },
    tags: {
        type: [String],
        default: [],
        index: true
    },
    autoRenewal: {
        type: Boolean,
        default: true,
    },
    renewalSchedule: {
        daysBeforeExpiry: {
            type: Number,
            required: true,
            default: 30,
        },
        time: {
            type: String,
            required: true,
            default: '03:00',
        },
        timeShiftMinutes: {
            type: Number,
            required: true,
            default: 0,
        },
    },
    // Post-issue scripts (multiple scripts in execution order)
    postIssueScripts: [{
        script: {
            type: Schema.Types.ObjectId,
            ref: 'PostIssueScript',
        },
        vars: {
            type: Object, // { VAR1: value, VAR2: value }
            default: {},
        },
        sshKey: {
            type: Schema.Types.ObjectId,
            ref: 'SshKey',
            required: false // Only required if script.requiresSshKey = true
        }
    }],
    lastRenewalAttempt: {
        type: Date,
    },
    lastRenewalStatus: {
        type: String,
        enum: ['success', 'failed'],
    },
    lastScriptExecution: {
        type: Date,
    },
    lastScriptStatus: {
        type: String,
        enum: ['success', 'failed'],
    },
    // Flag to indicate if certificate config was modified after issuance (requires reissue instead of renew)
    modified: {
        type: Boolean,
        default: false,
    },
    // Flag to enable/disable the certificate renewal scheduling without changing the configuration
    enabled: {
        type: Boolean,
        default: true,
    },
    // Retry counter: incremented on each failed renewal attempt, reset to 0 on success
    renewalRetryCount: {
        type: Number,
        default: 0,
    },
}, {
    timestamps: true,
});

certificateSchema.index({ status: 1 });

export const Certificate = model('Certificate', certificateSchema);