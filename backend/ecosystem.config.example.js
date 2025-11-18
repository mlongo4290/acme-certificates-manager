module.exports = {
  apps: [{
    name: 'acm-backend',
    script: 'dist/server.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',

    // Production environment variables
    env: {
      // Server Configuration
      NODE_ENV: 'production',
      PORT: '3000',

      // Database
      MONGODB_URI: 'mongodb://localhost:27017/acme-certificates-manager',

      // Scripts folder
      SCRIPTS_FOLDER: '/opt/acme-post-issue-scripts',

      // JWT Configuration
      JWT_SECRET: 'your-jwt-secret',
      JWT_EXPIRES_IN: '24h',

      // ACME Configuration
      ENCRYPTION_KEY: 'your-encryption-key',

      // Frontend URL (used for OAuth callbacks and password reset links)
      FRONTEND_URL: 'http://localhost:4200',

      // SMTP Email Configuration (optional - for password reset emails)
      //SMTP_HOST: '',
      //SMTP_PORT: '25',
      //SMTP_SECURE: '',
      //SMTP_USER: '',
      //SMTP_PASS: '',
      //SMTP_FROM: '',
      //SMTP_FROM_NAME: 'ACME Certificates Manager',

      // Logging Configuration
      LOG_LEVEL: 'info',
      LOG_DIR: '/var/log/acme-certificates-manager',
      ENABLE_CONSOLE_LOGS: 'false',
      ENABLE_FILE_LOGS: 'true',
      LOG_MAX_FILES: '14d',
      LOG_DATE_PATTERN: 'YYYY-MM-DD',

      // Activity Log Configuration
      ACTIVITY_LOG_ENABLED: 'true',
      ACTIVITY_LOG_RETENTION_DAYS: '90',
      ACTIVITY_LOG_HOUSEKEEPING_SCHEDULE: '0 2 * * *'
    },

    // PM2 logs configuration (minimal, Winston handles app logs)
    error_file: '/var/log/acme-certificates-manager/pm2-error.log',
    out_file: '/var/log/acme-certificates-manager/pm2-out.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
};
