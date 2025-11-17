import { model, Schema } from 'mongoose';

const SshKeySchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        description: {
            type: String,
            default: ''
        },
        privateKey: {
            type: String,
            required: true,
            select: false // Don't return in queries by default
        },
        publicKey: {
            type: String,
            required: true
        },
        keyType: {
            type: String,
            required: true,
            enum: [
                'rsa', 'rsa-pss', 'dsa', 'ec', 'ed25519', 'ed448',
                'dh', 'x25519', 'x448',
                'ml-dsa-44', 'ml-dsa-65', 'ml-dsa-87',
                'ml-kem-512', 'ml-kem-768', 'ml-kem-1024',
                'slh-dsa-sha2-128f', 'slh-dsa-sha2-128s',
                'slh-dsa-sha2-192f', 'slh-dsa-sha2-192s',
                'slh-dsa-sha2-256f', 'slh-dsa-sha2-256s',
                'slh-dsa-shake-128f', 'slh-dsa-shake-128s',
                'slh-dsa-shake-192f', 'slh-dsa-shake-192s',
                'slh-dsa-shake-256f', 'slh-dsa-shake-256s'
            ],
            default: 'ed25519'
        },
        keySize: {
            type: Number,
            required: false
        },
        username: {
            type: String,
            required: true,
            default: 'root'
        },
        port: {
            type: Number,
            required: true,
            default: 22,
            min: 1,
            max: 65535
        }
    },
    {
        timestamps: true
    }
);

export const SshKey = model('SshKey', SshKeySchema);
