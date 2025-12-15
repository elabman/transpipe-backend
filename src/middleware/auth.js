const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * Authentication Middleware for TransPipe Backend
 * Handles JWT token verification and role-based authorization
 */

/**
 * Middleware to authenticate JWT tokens from Authorization header
 * Expects format: "Bearer <token>"
 * Attaches user info to req.user on successful verification
 */
const authenticateToken = (req, res, next) => {
  // Extract Authorization header
  const authHeader = req.headers['authorization'];
  // Get token from "Bearer <token>" format
  const token = authHeader && authHeader.split(' ')[1];

  // Check if token exists
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  // Verify JWT token
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      // Log security event for monitoring
      logger.warn('Invalid token attempt', { 
        token: token.substring(0, 20) + '...', 
        error: err.message,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    // Attach user data to request object
    req.user = user;
    next();
  });
};

/**
 * Middleware factory for role-based authorization
 * Restricts access based on user roles
 * Must be used after authenticateToken middleware
 * @param {...string} roles - Allowed roles for the route
 * @returns {Function} Express middleware function
 */
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    // Ensure user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Check if user role is authorized
    if (!roles.includes(req.user.role)) {
      // Log authorization failure
      logger.warn('Authorization failed', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles,
        endpoint: req.path
      });

      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    // User authorized, proceed
    next();
  };
};

/**
 * Optional authentication middleware
 * Attaches user info if token is valid, but doesn't fail if no token
 * Useful for routes that work for both authenticated and anonymous users
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // If no token, continue without authentication
  if (!token) {
    return next();
  }

  // If token exists, try to verify it
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (!err) {
      req.user = user;
    }
    // Continue regardless of token validity
    next();
  });
};

module.exports = {
  authenticateToken,
  authorizeRoles,
  optionalAuth
};