const winston = require('winston');
const path = require('path');

/**
 * Winston Logger Configuration for TransPipe Backend
 * Provides structured logging with file rotation and console output
 * Supports different log levels and formats for development/production
 */

/**
 * Custom log format for structured logging
 * Combines timestamp, error stack traces, and JSON formatting
 * Ensures consistent log structure across the application
 */
const logFormat = winston.format.combine(
  // Add timestamp to all log entries
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  // Include error stack traces when logging error objects
  winston.format.errors({ stack: true }),
  // Format logs as JSON for easy parsing and analysis
  winston.format.json()
);

/**
 * Development-friendly console format
 * Uses colorized output and simple formatting for better readability
 * Only used in non-production environments
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
    // Format console output for better readability
    let output = `${timestamp} [${level}] ${message}`;
    
    // Add metadata if present (excluding common fields)
    const metaKeys = Object.keys(meta).filter(key => 
      !['timestamp', 'level', 'message', 'service'].includes(key)
    );
    
    if (metaKeys.length > 0) {
      const metaString = metaKeys.map(key => `${key}=${meta[key]}`).join(' ');
      output += ` | ${metaString}`;
    }
    
    return output;
  })
);

/**
 * Main Winston logger instance
 * Configured with file transports for persistent logging
 * and console transport for development
 */
const logger = winston.createLogger({
  // Set log level from environment variable or default to 'info'
  level: process.env.LOG_LEVEL || 'info',
  
  // Use structured JSON format for file logs
  format: logFormat,
  
  // Add service name to all log entries
  defaultMeta: { 
    service: 'transpipe-backend',
    version: process.env.npm_package_version || '1.0.0'
  },
  
  // File transport configurations
  transports: [
    // Error-only log file for critical issues
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB per file
      maxFiles: 5,      // Keep 5 rotated files
      tailable: true,   // Allow log rotation
      zippedArchive: true // Compress old log files
    }),
    
    // Combined log file for all log levels
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
      maxsize: 5242880, // 5MB per file
      maxFiles: 10,     // Keep 10 rotated files
      tailable: true,   // Allow log rotation
      zippedArchive: true // Compress old log files
    }),
    
    // Separate file for audit logs (user actions, security events)
    new winston.transports.File({
      filename: path.join('logs', 'audit.log'),
      level: 'info',
      maxsize: 10485760, // 10MB per file
      maxFiles: 20,      // Keep 20 rotated files for compliance
      tailable: true,
      zippedArchive: true
    })
  ],
  
  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join('logs', 'exceptions.log'),
      maxsize: 5242880,
      maxFiles: 5
    })
  ],
  
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: path.join('logs', 'rejections.log'),
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

// Add console transport for non-production environments
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'debug' // Show debug logs in development
  }));
}

/**
 * Custom logging methods for TransPipe-specific events
 * Provides consistent logging patterns across the application
 */

/**
 * Log user authentication events
 * @param {string} event - Type of auth event (login, logout, register, etc.)
 * @param {Object} data - Event data (userId, email, ip, etc.)
 */
logger.auth = (event, data) => {
  logger.info(`Auth: ${event}`, {
    category: 'authentication',
    event,
    ...data
  });
};

/**
 * Log database operations
 * @param {string} operation - Database operation (query, insert, update, delete)
 * @param {Object} data - Operation data (table, duration, rows affected, etc.)
 */
logger.db = (operation, data) => {
  logger.debug(`DB: ${operation}`, {
    category: 'database',
    operation,
    ...data
  });
};

/**
 * Log API requests and responses
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {number} duration - Request duration in milliseconds
 */
logger.api = (req, res, duration) => {
  logger.info('API Request', {
    category: 'api',
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    duration,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id || 'anonymous'
  });
};

/**
 * Log security events
 * @param {string} event - Security event type
 * @param {Object} data - Event data
 */
logger.security = (event, data) => {
  logger.warn(`Security: ${event}`, {
    category: 'security',
    event,
    ...data
  });
};

/**
 * Log business logic events (payments, attendance, etc.)
 * @param {string} event - Business event type
 * @param {Object} data - Event data
 */
logger.business = (event, data) => {
  logger.info(`Business: ${event}`, {
    category: 'business',
    event,
    ...data
  });
};

// Export the configured logger
module.exports = logger;