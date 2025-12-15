const logger = require('../utils/logger');

/**
 * Global Error Handler Middleware for TransPipe Backend
 * Handles all application errors and provides consistent error responses
 * Specifically designed for PostgreSQL database errors and Express.js
 */

/**
 * Central error handling middleware
 * Processes different types of errors and returns appropriate HTTP responses
 * Logs all errors for monitoring and debugging
 * 
 * @param {Error} err - Error object from previous middleware or route handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const errorHandler = (err, req, res, next) => {
  // Create error object copy to avoid mutation
  let error = { ...err };
  error.message = err.message;

  // Log comprehensive error information for monitoring
  logger.error('Error occurred', {
    error: error.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id || 'anonymous',
    timestamp: new Date().toISOString()
  });

  // Handle JWT Token Errors
  if (err.name === 'JsonWebTokenError') {
    error = { 
      message: 'Invalid authentication token', 
      statusCode: 401 
    };
  }

  // Handle JWT Token Expiration
  if (err.name === 'TokenExpiredError') {
    error = { 
      message: 'Authentication token has expired', 
      statusCode: 401 
    };
  }

  // Handle Validation Errors (from Joi or custom validation)
  if (err.name === 'ValidationError') {
    const message = 'Validation failed';
    error = { message, statusCode: 400 };
  }

  // Handle PostgreSQL Database Errors
  if (err.code) {
    switch (err.code) {
      case '23505': // Unique constraint violation
        error = { 
          message: 'Duplicate entry. This record already exists.', 
          statusCode: 409 
        };
        break;
      
      case '23503': // Foreign key constraint violation
        error = { 
          message: 'Referenced record does not exist.', 
          statusCode: 400 
        };
        break;
      
      case '23502': // Not null constraint violation
        error = { 
          message: 'Required field is missing.', 
          statusCode: 400 
        };
        break;
      
      case '23514': // Check constraint violation
        error = { 
          message: 'Invalid data value provided.', 
          statusCode: 400 
        };
        break;
      
      case '42P01': // Undefined table error
        error = { 
          message: 'Database configuration error.', 
          statusCode: 500 
        };
        break;
      
      case '42703': // Undefined column error
        error = { 
          message: 'Database schema error.', 
          statusCode: 500 
        };
        break;
      
      case '28P01': // Invalid password (authentication failed)
        error = { 
          message: 'Database authentication failed.', 
          statusCode: 500 
        };
        break;
      
      case '3D000': // Invalid database name
        error = { 
          message: 'Database connection error.', 
          statusCode: 500 
        };
        break;
      
      case '08006': // Connection failure
        error = { 
          message: 'Database connection lost.', 
          statusCode: 503 
        };
        break;
      
      default:
        // Generic database error
        error = { 
          message: 'Database operation failed.', 
          statusCode: 500 
        };
    }
  }

  // Handle Express.js specific errors
  if (err.type === 'entity.parse.failed') {
    error = { 
      message: 'Invalid JSON format in request body.', 
      statusCode: 400 
    };
  }



  // Handle rate limiting errors
  if (err.status === 429) {
    error = { 
      message: 'Too many requests. Please try again later.', 
      statusCode: 429 
    };
  }

  // Handle network/timeout errors
  if (err.code === 'ECONNREFUSED') {
    error = { 
      message: 'Service temporarily unavailable.', 
      statusCode: 503 
    };
  }

  // Handle permission errors
  if (err.code === 'EACCES') {
    error = { 
      message: 'Permission denied.', 
      statusCode: 403 
    };
  }

  // Determine final status code
  const statusCode = error.statusCode || 500;
  
  // Prepare error response
  const errorResponse = {
    success: false,
    message: error.message || 'Internal Server Error',
    timestamp: new Date().toISOString()
  };

  // Add stack trace in development mode only
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
    errorResponse.details = {
      name: err.name,
      code: err.code,
      constraint: err.constraint,
      table: err.table,
      column: err.column
    };
  }

  // Add request ID for tracking (if available)
  if (req.requestId) {
    errorResponse.requestId = req.requestId;
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

/**
 * 404 Not Found Handler
 * Handles requests to non-existent routes
 * Should be placed after all route definitions
 */
const notFoundHandler = (req, res, next) => {
  const error = new Error(`Route ${req.originalUrl} not found`);
  error.statusCode = 404;
  
  logger.warn('Route not found', {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
};

/**
 * Async Error Wrapper
 * Wraps async route handlers to catch and forward errors
 * Eliminates need for try-catch in every async route
 * 
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Express middleware function
 * 
 * Usage:
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await getUsersFromDB();
 *   res.json(users);
 * }));
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler
};