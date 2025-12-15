const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error('Error occurred', {
    error: error.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { message, statusCode: 404 };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = { message, statusCode: 400 };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message);
    error = { message, statusCode: 400 };
  }

  // PostgreSQL errors
  if (err.code) {
    switch (err.code) {
      case '23505': // Unique violation
        error = { 
          message: 'Duplicate entry. This record already exists.', 
          statusCode: 409 
        };
        break;
      case '23503': // Foreign key violation
        error = { 
          message: 'Referenced record does not exist.', 
          statusCode: 400 
        };
        break;
      case '23502': // Not null violation
        error = { 
          message: 'Required field is missing.', 
          statusCode: 400 
        };
        break;
      case '42P01': // Undefined table
        error = { 
          message: 'Database configuration error.', 
          statusCode: 500 
        };
        break;
      default:
        error = { 
          message: 'Database error occurred.', 
          statusCode: 500 
        };
    }
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;