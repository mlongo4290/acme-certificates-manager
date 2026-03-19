import path from 'path';
import winston from 'winston';
import DailyRotateFile = require('winston-daily-rotate-file');
import { jobStorage } from './jobManager.service';

// Configuration from environment variables
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), '..', 'logs');
const ENABLE_CONSOLE_LOGS = process.env.ENABLE_CONSOLE_LOGS !== 'false';
const ENABLE_FILE_LOGS = process.env.ENABLE_FILE_LOGS !== 'false';
const LOG_MAX_SIZE = process.env.LOG_MAX_SIZE;
const LOG_MAX_FILES = process.env.LOG_MAX_FILES;
const LOG_DATE_PATTERN = process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD';

/**
 * SSE Manager — routes log messages to the current job via AsyncLocalStorage.
 * Each parallel job runs in its own async context, so messages are never mixed.
 */
class SSEManager {
    static sendMessage(message: string, level: string, context?: string) {
        const callback = jobStorage.getStore();
        if (callback) {
            const text = context ? `[${context}] ${message}` : message;
            callback(level, text);
        }
    }
}

// Create custom format for console output
const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, context }) => {
        const contextStr = context ? `[${context}] ` : '';
        return `${timestamp} ${level}: ${contextStr}${message}`;
    })
);

// Create custom format for file output
const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, context }) => {
        const contextStr = context ? `[${context}] ` : '';
        return `${timestamp} [${level.toUpperCase()}]: ${contextStr}${message}`;
    })
);

// Build transports array based on configuration
const transports: winston.transport[] = [];

// Add console transport (enabled in development by default, configurable via env)
if (ENABLE_CONSOLE_LOGS) {
    transports.push(
        new winston.transports.Console({
            format: consoleFormat
        })
    );
}

// Add file transports with rotation if enabled
if (ENABLE_FILE_LOGS) {
    const rotateOptions: any = {
        filename: path.join(LOG_DIR, 'acm-%DATE%.log'),
        datePattern: LOG_DATE_PATTERN,
        format: fileFormat,
        auditFile: path.join(LOG_DIR, '.audit.json'),
        zippedArchive: true
    };

    // Add optional rotation parameters only if specified
    if (LOG_MAX_SIZE) {
        rotateOptions.maxSize = LOG_MAX_SIZE;
    }
    if (LOG_MAX_FILES) {
        rotateOptions.maxFiles = LOG_MAX_FILES;
    }

    transports.push(new DailyRotateFile(rotateOptions));
}

// Create Winston logger
const winstonLogger = winston.createLogger({
    level: LOG_LEVEL,
    transports
});

/**
 * Logger class with context support and SSE integration
 */
export class Logger {
    private context?: string;

    constructor(context?: string) {
        this.context = context;
    }

    /**
     * Create a child logger with specific context
     */
    child(context: string): Logger {
        return new Logger(context);
    }

    /**
     * Log info message
     */
    info(message: string) {
        SSEManager.sendMessage(message, 'info', this.context);
        winstonLogger.info(message, { context: this.context });
    }

    /**
     * Log warning message
     */
    warn(message: string) {
        SSEManager.sendMessage(message, 'warn', this.context);
        winstonLogger.warn(message, { context: this.context });
    }

    /**
     * Log error message
     */
    error(message: string, error?: Error) {
        if (error) {
            const errorMessage = `${message}: ${error.message}`;
            SSEManager.sendMessage(errorMessage, 'error', this.context);
            winstonLogger.error(errorMessage, {
                context: this.context,
                stack: error.stack
            });
        } else {
            SSEManager.sendMessage(message, 'error', this.context);
            winstonLogger.error(message, { context: this.context });
        }
    }

    /**
     * Log debug message
     */
    debug(message: string) {
        SSEManager.sendMessage(message, 'debug', this.context);
        winstonLogger.debug(message, { context: this.context });
    }

    /**
     * Log verbose message
     */
    verbose(message: string) {
        SSEManager.sendMessage(message, 'verbose', this.context);
        winstonLogger.verbose(message, { context: this.context });
    }

    /**
     * Send success message to SSE (if connected) and log
     */
    success(message: string) {
        this.info(`✓ ${message}`);
    }

    /**
     * Send error message to SSE (if connected) and log
     */
    errorWithSymbol(message: string) {
        this.error(`✗ ${message}`);
    }
}

// Export default logger instance
export const logger = new Logger();

// Export winston instance for advanced usage
export { winstonLogger };

