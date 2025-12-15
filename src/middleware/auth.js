const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * Authentication Middleware
 * 
 * Middleware for JWT token authentication and role-based authorization.
 * Provides secure access control for protected routes.
 */

/**
 * Authenticate JWT Token Middleware
 * 
 * Verifies JWT token from Authorization header and attaches user info to request.
 * Expects token in format: "Bearer <token>"
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object  
 * @param {Function} next - Express next middleware function
 * 
 * @returns {void} - Calls next() on success, sends error response on failure
 * 
 * Usage:
 * router.get('/protected', authenticateToken, controller.method);
 */
const authenticateToken = (req, res, next) => {
  // Extract Authorization header
  const authHeader = req.headers['authorization'];
  
  // Extract token from "Bearer <token>" format
  const token = authHeader && authHeader.split(' ')[1];

  // Check if token is provided
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

    // Attach user information to request object
    req.user = user;
    next();
  });
};

/**
 * Role-Based Authorization Middleware
 * 
 * Restricts access to routes based on user roles.
 * Must be used after authenticateToken middleware.
 * 
 * @param {...string} roles - Allowed roles for the route
 * 
 * @returns {Function} - Express middleware function
 * 
 * Usage:
 * router.delete('/admin', authenticateToken, authorizeRoles('admin'), controller.method);
 * router.post('/supervisor', authenticateToken, authorizeRoles('admin', 'supervisor'), controller.method);
 */
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    // Ensure user is authenticated first
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Check if user's role is in allowed roles
    if (!roles.includes(req.user.role)) {
      // Log authorization failure for security monitoring
      logger.warn('Authorization failed', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles,
        endpoint: req.path,
        method: req.method
      });

      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    // User has required role, proceed
    next();
  };
};

/**
 * Optional Authentication Middleware
 * 
 * Similar to authenticateToken but doesn't fail if no token is provided.
 * Useful for routes that work for both authenticated and anonymous users.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * 
 * Usage:
 * router.get('/public-or-private', optionalAuth, controller.method);
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // If no token provided, continue without authentication
  if (!token) {
    return next();
  }

  // If token provided, verify it
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (!err) {
      req.user = user;
    }
    // Continue regardless of token validity for optional auth
    next();
  });
};

/**
 * Check if User Owns Resource Middleware
 * 
 * Verifies that the authenticated user owns the resource being accessed.
 * Useful for ensuring users can only access their own data.
 * 
 * @param {string} resourceIdParam - Parameter name containing resource ID
 * @param {string} resourceTable - Database table name
 * @param {string} ownerColumn - Column name that contains the owner ID
 * 
 * @returns {Function} - Express middleware function
 * 
 * Usage:
 * router.get('/projects/:id', authenticateToken, checkOwnership('id', 'projects', 'user_id'), controller.method);
 */
const checkOwnership = (resourceIdParam, resourceTable, ownerColumn = 'user_id') => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[resourceIdParam];
      const userId = req.user.id;

      // Skip ownership check for admin users
      if (req.user.role === 'admin') {
        return next();
      }

      // Query database to check ownership
      const db = require('../config/database');
      const result = await db.query(
        `SELECT ${ownerColumn} FROM ${resourceTable} WHERE id = $1`,
        [resourceId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Resource not found'
        });
      }

      if (result.rows[0][ownerColumn] !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only access your own resources.'
        });
      }

      next();
    } catch (error) {
      logger.error('Ownership check failed', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Server error during authorization'
      });
    }
  };
};

// Export all middleware functions
module.exports = {
  authenticateToken,
  authorizeRoles,
  optionalAuth,
  checkOwnership
};