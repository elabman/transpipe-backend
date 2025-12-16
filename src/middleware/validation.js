const Joi = require('joi');
const logger = require('../utils/logger');

/**
 * Input Validation Middleware for TransPipe Backend
 * Provides comprehensive request validation using Joi schemas
 */

/**
 * Generic validation middleware factory
 * Creates middleware that validates request data against Joi schema
 * @param {Object} schema - Joi validation schema
 * @param {string} target - What to validate ('body', 'query', 'params')
 * @returns {Function} Express middleware function
 */
const validate = (schema, target = 'body') => {
  return (req, res, next) => {
    // Get data to validate based on target
    const dataToValidate = req[target];
    
    // Validate against schema with detailed error reporting
    const { error } = schema.validate(dataToValidate, { 
      abortEarly: false,  // Return all errors, not just first
      allowUnknown: false, // Reject unknown fields
      stripUnknown: true   // Remove unknown fields
    });
    
    if (error) {
      // Transform Joi errors to user-friendly format
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      // Log validation errors for monitoring
      logger.warn('Validation error', { 
        endpoint: req.path,
        method: req.method,
        target,
        errors,
        ip: req.ip
      });

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    // Validation passed, continue
    next();
  };
};

/**
 * Input sanitization middleware
 * Cleans and normalizes input data before validation
 * Trims strings and handles common formatting issues
 */
const sanitizeInput = (req, res, next) => {
  // Recursive function to sanitize object properties
  const sanitizeObject = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        // Trim whitespace and normalize
        sanitized[key] = value.trim();
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(item => 
          typeof item === 'string' ? item.trim() : sanitizeObject(item)
        );
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  };

  // Sanitize request data
  if (req.body) req.body = sanitizeObject(req.body);
  if (req.query) req.query = sanitizeObject(req.query);
  if (req.params) req.params = sanitizeObject(req.params);

  next();
};

// Validation schemas for different endpoints
const schemas = {
  // User registration validation schema
  userRegistration: Joi.object({
    name: Joi.string()
      .min(2)
      .max(255)
      .pattern(/^[a-zA-Z\s]+$/)
      .required()
      .messages({
        'string.pattern.base': 'Name must contain only letters and spaces'
      }),
    email: Joi.string()
      .email({ tlds: { allow: false } })
      .lowercase()
      .required(),
    phone: Joi.string()
      .pattern(/^\+?[\d\s-()]+$/)
      .min(10)
      .max(20)
      .required()
      .messages({
        'string.pattern.base': 'Phone must contain only digits, spaces, hyphens, parentheses, and optional plus sign'
      }),
    password: Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .required()
      .messages({
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      }),
    category: Joi.string()
      .valid('Individual', 'Company', 'NGO', 'Government Institution')
      .required()
  }),

  // User login validation schema
  userLogin: Joi.object({
    email: Joi.string()
      .email({ tlds: { allow: false } })
      .lowercase()
      .required(),
    password: Joi.string()
      .min(1)
      .required()
  }),

  // Worker creation validation schema
  createWorker: Joi.object({
    userId: Joi.number()
      .integer()
      .positive()
      .required(),
    fullname: Joi.string()
      .min(2)
      .max(255)
      .pattern(/^[a-zA-Z\s]+$/)
      .required(),
    phone: Joi.string()
      .pattern(/^\+?[\d\s-()]+$/)
      .min(10)
      .max(20)
      .required(),
    email: Joi.string()
      .email({ tlds: { allow: false } })
      .lowercase()
      .optional(),
    position: Joi.string()
      .valid('Engineer', 'Supervisor', 'Masonry')
      .required(),
    bankAccount: Joi.string()
      .max(100)
      .optional(),
    idPassport: Joi.string()
      .min(5)
      .max(100)
      .required(),
    salary: Joi.number()
      .positive()
      .precision(2)
      .required()
  }),

  // Worker with card creation validation schema
  createWorkerWithCard: Joi.object({
    cardId: Joi.string()
      .min(1)
      .max(50)
      .alphanum()
      .required(),
    name: Joi.string()
      .min(2)
      .max(255)
      .pattern(/^[a-zA-Z\s]+$/)
      .required(),
    email: Joi.string()
      .email({ tlds: { allow: false } })
      .lowercase()
      .optional(),
    phone: Joi.string()
      .pattern(/^\+?[\d\s-()]+$/)
      .min(10)
      .max(20)
      .required(),
    positionId: Joi.number()
      .integer()
      .positive()
      .required(),
    projectId: Joi.number()
      .integer()
      .positive()
      .required(),
    nationalId: Joi.string()
      .min(5)
      .max(100)
      .required(),
    address: Joi.string()
      .max(500)
      .optional()
  }),

  // Project creation validation schema
  createProject: Joi.object({
    userId: Joi.number()
      .integer()
      .positive()
      .required(),
    name: Joi.string()
      .min(2)
      .max(255)
      .required(),
    client: Joi.string()
      .min(2)
      .max(255)
      .required(),
    category: Joi.string()
      .valid('Construction', 'Farming', 'Education')
      .required(),
    startDate: Joi.date()
      .iso()
      .required(),
    endDate: Joi.date()
      .iso()
      .min(Joi.ref('startDate'))
      .required(),
    budget: Joi.number()
      .positive()
      .precision(2)
      .required(),
    positions: Joi.array()
      .items(Joi.string().valid('Engineer', 'Supervisor', 'Masonry'))
      .min(1)
      .unique()
      .required()
  }),

  // Attendance creation validation schema
  createAttendance: Joi.object({
    userId: Joi.number()
      .integer()
      .positive()
      .required(),
    workerId: Joi.number()
      .integer()
      .positive()
      .required(),
    projectId: Joi.number()
      .integer()
      .positive()
      .required(),
    date: Joi.date()
      .iso()
      .max('now')
      .required(),
    checkIn: Joi.string()
      .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .optional(),
    checkOut: Joi.string()
      .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .optional(),
    status: Joi.string()
      .valid('Present', 'Absent', 'Late', 'Half Day')
      .required()
  }),

  // Attendance and rating validation schema
  markAttendanceAndRate: Joi.object({
    userId: Joi.number()
      .integer()
      .positive()
      .required(),
    workerId: Joi.number()
      .integer()
      .positive()
      .required(),
    projectId: Joi.number()
      .integer()
      .positive()
      .required(),
    date: Joi.date()
      .iso()
      .max('now')
      .required(),
    attendance: Joi.string()
      .valid('Present', 'Absent', 'Late')
      .required(),
    rating: Joi.number()
      .integer()
      .min(1)
      .max(5)
      .required(),
    comments: Joi.string()
      .max(1000)
      .optional()
  }),

  // Payment request validation schema
  paymentRequest: Joi.object({
    userId: Joi.number()
      .integer()
      .positive()
      .required(),
    requestId: Joi.string()
      .min(1)
      .max(100)
      .alphanum()
      .required(),
    projectId: Joi.number()
      .integer()
      .positive()
      .required(),
    requestDate: Joi.date()
      .iso()
      .max('now')
      .required(),
    workers: Joi.array()
      .items(
        Joi.object({
          workerId: Joi.number()
            .integer()
            .positive()
            .required(),
          daysWorked: Joi.number()
            .positive()
            .max(31)
            .required(),
          allowancePerDay: Joi.number()
            .positive()
            .precision(2)
            .required(),
          totalAmount: Joi.number()
            .positive()
            .precision(2)
            .required()
        })
      )
      .min(1)
      .required(),
    notes: Joi.string()
      .max(1000)
      .optional()
  }),

  // Pagination query validation schema
  paginationQuery: Joi.object({
    page: Joi.number()
      .integer()
      .min(1)
      .default(1),
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .default(10),
    sortBy: Joi.string()
      .optional(),
    sortOrder: Joi.string()
      .valid('asc', 'desc')
      .default('desc')
  }),

  // Company registration validation schema
  companyRegistration: Joi.object({
    companyName: Joi.string()
      .min(2)
      .max(255)
      .required()
      .messages({
        'string.min': 'Company name must be at least 2 characters long',
        'string.max': 'Company name cannot exceed 255 characters'
      }),
    registrationNumber: Joi.string()
      .min(3)
      .max(100)
      .optional()
      .messages({
        'string.min': 'Registration number must be at least 3 characters long'
      }),
    taxId: Joi.string()
      .min(3)
      .max(100)
      .optional()
      .messages({
        'string.min': 'Tax ID must be at least 3 characters long'
      }),
    address: Joi.string()
      .max(500)
      .optional(),
    industry: Joi.string()
      .min(2)
      .max(100)
      .required()
      .messages({
        'string.min': 'Industry must be at least 2 characters long'
      })
  }),

  // Company update validation schema
  companyUpdate: Joi.object({
    companyName: Joi.string()
      .min(2)
      .max(255)
      .optional(),
    registrationNumber: Joi.string()
      .min(3)
      .max(100)
      .optional(),
    taxId: Joi.string()
      .min(3)
      .max(100)
      .optional(),
    address: Joi.string()
      .max(500)
      .optional(),
    industry: Joi.string()
      .min(2)
      .max(100)
      .optional()
  }).min(1) // At least one field must be provided for update
};

module.exports = {
  validate,
  sanitizeInput,
  schemas
};