const Joi = require('joi');
const logger = require('../utils/logger');

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      logger.warn('Validation error', { 
        endpoint: req.path, 
        errors,
        body: req.body 
      });

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    next();
  };
};

// Common validation schemas
const schemas = {
  userRegistration: Joi.object({
    name: Joi.string().min(2).max(255).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().pattern(/^\+?[\d\s-()]+$/).min(10).max(20).required(),
    password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required()
      .messages({
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      }),
    category: Joi.string().valid('Individual', 'Company', 'NGO', 'Government Institution').required()
  }),

  userLogin: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  createWorker: Joi.object({
    userId: Joi.number().integer().positive().required(),
    fullname: Joi.string().min(2).max(255).required(),
    phone: Joi.string().pattern(/^\+?[\d\s-()]+$/).min(10).max(20).required(),
    email: Joi.string().email().optional(),
    position: Joi.string().valid('Engineer', 'Supervisor', 'Masonry').required(),
    bankAccount: Joi.string().max(100).optional(),
    idPassport: Joi.string().min(5).max(100).required(),
    salary: Joi.number().positive().required()
  }),

  createWorkerWithCard: Joi.object({
    cardId: Joi.string().min(1).max(50).required(),
    name: Joi.string().min(2).max(255).required(),
    email: Joi.string().email().optional(),
    phone: Joi.string().pattern(/^\+?[\d\s-()]+$/).min(10).max(20).required(),
    positionId: Joi.number().integer().positive().required(),
    projectId: Joi.number().integer().positive().required(),
    nationalId: Joi.string().min(5).max(100).required(),
    address: Joi.string().max(500).optional()
  }),

  createProject: Joi.object({
    userId: Joi.number().integer().positive().required(),
    name: Joi.string().min(2).max(255).required(),
    client: Joi.string().min(2).max(255).required(),
    category: Joi.string().valid('Construction', 'Farming', 'Education').required(),
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
    budget: Joi.number().positive().required(),
    positions: Joi.array().items(Joi.string().valid('Engineer', 'Supervisor', 'Masonry')).min(1).required()
  }),

  createAttendance: Joi.object({
    userId: Joi.number().integer().positive().required(),
    workerId: Joi.number().integer().positive().required(),
    projectId: Joi.number().integer().positive().required(),
    date: Joi.date().iso().required(),
    checkIn: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    checkOut: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    status: Joi.string().valid('Present', 'Absent', 'Late', 'Half Day').required()
  }),

  markAttendanceAndRate: Joi.object({
    userId: Joi.number().integer().positive().required(),
    workerId: Joi.number().integer().positive().required(),
    projectId: Joi.number().integer().positive().required(),
    date: Joi.date().iso().required(),
    attendance: Joi.string().valid('Present', 'Absent', 'Late').required(),
    rating: Joi.number().integer().min(1).max(5).required(),
    comments: Joi.string().max(1000).optional()
  }),

  paymentRequest: Joi.object({
    userId: Joi.number().integer().positive().required(),
    requestId: Joi.string().min(1).max(100).required(),
    projectId: Joi.number().integer().positive().required(),
    requestDate: Joi.date().iso().required(),
    workers: Joi.array().items(
      Joi.object({
        workerId: Joi.number().integer().positive().required(),
        daysWorked: Joi.number().positive().required(),
        allowancePerDay: Joi.number().positive().required(),
        totalAmount: Joi.number().positive().required()
      })
    ).min(1).required(),
    notes: Joi.string().max(1000).optional()
  })
};

module.exports = {
  validate,
  schemas
};