# Post-Issue Scripts

Post-issue deployment scripts are managed through the dedicated **Post-Issue Scripts** interface in ACME Certificates Manager.

## 📦 Script Repository

**[acme-post-issue-scripts](https://github.com/mlongo4290/acme-post-issue-scripts)**

## 📁 Script Structure

Each script is a **folder** containing:
- **Entrypoint file** (e.g., `script.sh`, `script.py`, `script.js`)
- **Support files** (dependencies, resources, config files)
- **init.js** (optional) - Initialization script run once during import
- **.acmeignore** (optional) - Files/folders to exclude from export

```
SCRIPTS_FOLDER/
├── deploy-nginx/
│   ├── script.sh          ← Entrypoint (executed)
│   ├── init.js            ← Optional: runs on import
│   ├── .acmeignore        ← Optional: exclude from export
│   ├── resources.txt
│   └── templates/
│       └── nginx.conf
├── python-deployer/
│   ├── script.py          ← Entrypoint (executed)
│   ├── init.js            ← Creates venv, installs requirements
│   ├── .acmeignore        ← Excludes venv/ from export
│   ├── requirements.txt
│   └── venv/              (excluded from export)
```

## Quick Installation

```bash
# Clone the scripts repository
git clone https://github.com/mlongo4290/acme-post-issue-scripts.git /opt/acme-post-issue-scripts

# Scripts are organized by folder
ls /opt/acme-post-issue-scripts/
# deploy-nginx/  python-deployer/  idrac-deployer/
```

## Configuration via Web Interface

### 1. Script Management

Navigate to **Post-Issue Scripts** section to:
- ✅ Create and manage reusable script definitions
- ✅ Define **path** (folder name) and **entrypoint** (file to execute)
- ✅ Define environment variables with descriptions and default values
- ✅ Mark sensitive variables (passwords, tokens) for automatic encryption
- ✅ Export/import scripts as ZIP packages for portability

### 2. Script Definition

When creating a script:
1. **Name**: Descriptive name (e.g., "Deploy to NGINX")
2. **Path**: Folder name (e.g., `deploy-nginx`)
3. **Entrypoint**: File to execute (e.g., `script.sh`, `script.py`)
4. **Description**: Optional documentation
5. **Environment Variables**: Define required variables with:
   - Key name
   - Description
   - Default value (optional)
   - Sensitive flag (for passwords/tokens)

When creating a script:
1. **Name**: Descriptive name (e.g., "Deploy to NGINX")
2. **Path**: Relative to `SCRIPTS_FOLDER` (e.g., `nginx-deploy.sh`)
3. **Description**: Optional documentation
4. **Environment Variables**: Define required variables with:
   - Key name
   - Description
   - Default value (optional)
   - Sensitive flag (for passwords/tokens)

### 3. Certificate Assignment

In **Certificates** → **Edit Certificate** → **Post-Issuance Script**:
1. Select a script from the dropdown
2. Fill in environment variable values
3. Sensitive values are encrypted and masked with `__ENCRYPTED__`
4. Script runs automatically after certificate issuance/renewal

## Initialization Scripts (init.js)

Create an **init.js** file in your script folder for one-time setup (e.g., creating virtual environments, installing dependencies):

```javascript
const { execSync } = require('child_process');
const fs = require('fs');

console.log('Initializing Python environment...');

// Create venv
if (!fs.existsSync('venv')) {
    execSync('python3 -m venv venv', { stdio: 'inherit' });
}

// Install requirements
if (fs.existsSync('requirements.txt')) {
    const pip = process.platform === 'win32' ? 'venv\\Scripts\\pip' : 'venv/bin/pip';
    execSync(`${pip} install -r requirements.txt`, { stdio: 'inherit' });
}

console.log('✓ Initialization complete!');
```

**init.js** runs automatically:
- During script import from ZIP
- Only once per import operation
- With 5-minute timeout
- Logs are captured and shown in the UI

## Export/Import Scripts

### Export
- Click **Export** button next to any script
- Downloads a ZIP containing:
  - `metadata.json` - Script definition with variables
  - **All files in the script folder** (respecting `.acmeignore`)
  - Excludes: `venv/`, `node_modules/`, `__pycache__/`, `.git/`

### Import
- Click **Import** button
- Select a previously exported ZIP file
- Script folder is extracted to `SCRIPTS_FOLDER/path/`
- If **init.js** exists, it runs automatically
- If script `_id` matches existing script → **Update**
- If new → **Create**
- Enables easy migration between environments (dev/prod)

## .acmeignore File

Create a `.acmeignore` file to exclude files/folders from export:

```
# Python virtual environments
venv/
.venv/
__pycache__/
*.pyc

# Node.js
node_modules/

# Git
.git/

# IDE
.vscode/
.idea/

# Logs
*.log
```

## Automatic Environment Variables

The ACME Manager automatically provides these variables to all scripts:

- `CERT_CERTIFICATE_FILE` - Certificate file path
- `CERT_PRIVATE_KEY_FILE` - Private key file path
- `CERT_FULL_CHAIN_FILE` - Full chain file path
- `CERT_DOMAIN` - Certificate domain
- `CERT_ADDITIONAL_DOMAINS` - Additional domains (comma-separated)
- `CERT_ISSUE_DATE` - Issue date (ISO 8601)
- `CERT_EXPIRY_DATE` - Expiry date (ISO 8601)

Additional configuration variables (like `HOST`, `CREDENTIALS_FILE`, etc.) are defined in the script configuration.

## Security Features

- ✅ **Sensitive Variables**: Mark variables as sensitive for automatic encryption
- ✅ **Database Encryption**: Sensitive values encrypted at rest using `ENCRYPTION_KEY`
- ✅ **Masked Display**: Encrypted values shown as `__ENCRYPTED__` in UI
- ✅ **Automatic Decryption**: Values decrypted only during script execution
- ✅ **Password Inputs**: Sensitive variables use password field type

---

For detailed script documentation and examples, visit the [acme-post-issue-scripts repository](https://github.com/mlongo4290/acme-post-issue-scripts).
