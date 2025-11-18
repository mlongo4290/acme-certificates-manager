import { Schema, model } from 'mongoose';

const PostIssueScriptSchema = new Schema({
    name: { type: String, required: true, unique: true },
    path: { type: String, required: true }, // Folder name in SCRIPTS_FOLDER
    entrypoint: { type: String, required: true, default: 'script.sh' }, // File to execute within the folder
    description: { type: String },
    requiresSshKey: { type: Boolean, default: false }, // Whether this script requires SSH key
    envVars: [
        {
            key: { type: String, required: true },
            description: { type: String },
            sensitive: { type: Boolean, default: false }
        },
    ]
});

// Create compound index to ensure envVar keys are unique within each script
PostIssueScriptSchema.index({ '_id': 1, 'envVars.key': 1 }, { unique: true });

export const PostIssueScript = model('PostIssueScript', PostIssueScriptSchema);
