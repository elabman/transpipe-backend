const BaseModel = require('./BaseModel');
const AuthUtils = require('../utils/auth');
const logger = require('../utils/logger');

/**
 * User Model
 * Handles all user-related database operations
 * Extends BaseModel for common CRUD operations
 */
class User extends BaseModel {
  constructor() {
    super('users');
  }

  /**
   * Find user by email
   * @param {string} email - User email
   * @returns {Object|null} - User record or null
   */
  async findByEmail(email) {
    try {
      const result = await this.db.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding user by email', { 
        email, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Create a new user with hashed password
   * @param {Object} userData - User data
   * @returns {Object} - Created user (without password)
   */
  async createUser(userData) {
    try {
      const { name, email, phone, password, category } = userData;

      // Check if user already exists
      const existingUser = await this.findByEmail(email);
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Hash password
      const passwordHash = await AuthUtils.hashPassword(password);

      // Create user
      const user = await this.create({
        name,
        email,
        phone,
        password_hash: passwordHash,
        category,
        role: 'user'
      });

      // Remove password hash from response
      delete user.password_hash;

      logger.auth('user_registered', {
        userId: user.id,
        email: user.email,
        category: user.category
      });

      return user;
    } catch (error) {
      logger.error('Error creating user', { 
        userData: { ...userData, password: '[REDACTED]' }, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Authenticate user login
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Object} - User data and token
   */
  async authenticateUser(email, password) {
    try {
      // Find user with password hash
      const user = await this.db.query(
        `SELECT id, uuid, name, email, phone, password_hash, category, role, is_active 
         FROM users WHERE email = $1`,
        [email]
      );

      if (user.rows.length === 0) {
        throw new Error('Invalid email or password');
      }

      const userData = user.rows[0];

      // Check if user is active
      if (!userData.is_active) {
        throw new Error('Account is deactivated. Please contact administrator.');
      }

      // Verify password
      const isValidPassword = await AuthUtils.comparePassword(password, userData.password_hash);
      if (!isValidPassword) {
        throw new Error('Invalid email or password');
      }

      // Generate token
      const token = AuthUtils.generateToken({
        id: userData.id,
        email: userData.email,
        role: userData.role
      });

      // Remove password hash from response
      delete userData.password_hash;

      logger.auth('user_login', {
        userId: userData.id,
        email: userData.email
      });

      return {
        user: userData,
        token
      };
    } catch (error) {
      logger.security('login_attempt_failed', {
        email,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update user profile
   * @param {number} userId - User ID
   * @param {Object} updateData - Data to update
   * @returns {Object|null} - Updated user
   */
  async updateProfile(userId, updateData) {
    try {
      // Remove sensitive fields that shouldn't be updated directly
      const { password, password_hash, role, ...safeUpdateData } = updateData;

      const updatedUser = await this.updateById(userId, safeUpdateData);
      
      if (updatedUser) {
        delete updatedUser.password_hash;
        
        logger.business('user_profile_updated', {
          userId,
          updatedFields: Object.keys(safeUpdateData)
        });
      }

      return updatedUser;
    } catch (error) {
      logger.error('Error updating user profile', { 
        userId, 
        updateData, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Change user password
   * @param {number} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {boolean} - Success status
   */
  async changePassword(userId, currentPassword, newPassword) {
    try {
      // Get user with current password hash
      const user = await this.db.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [userId]
      );

      if (user.rows.length === 0) {
        throw new Error('User not found');
      }

      // Verify current password
      const isValidPassword = await AuthUtils.comparePassword(
        currentPassword, 
        user.rows[0].password_hash
      );

      if (!isValidPassword) {
        throw new Error('Current password is incorrect');
      }

      // Hash new password
      const newPasswordHash = await AuthUtils.hashPassword(newPassword);

      // Update password
      await this.updateById(userId, { password_hash: newPasswordHash });

      logger.security('password_changed', { userId });

      return true;
    } catch (error) {
      logger.error('Error changing password', { 
        userId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Deactivate user account
   * @param {number} userId - User ID
   * @returns {boolean} - Success status
   */
  async deactivateUser(userId) {
    try {
      const updatedUser = await this.updateById(userId, { is_active: false });
      
      if (updatedUser) {
        logger.business('user_deactivated', { userId });
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Error deactivating user', { 
        userId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get users with pagination and filters
   * @param {Object} filters - Filter conditions
   * @param {Object} pagination - Pagination options
   * @returns {Object} - Users and pagination info
   */
  async getUsers(filters = {}, pagination = {}) {
    try {
      const { page = 1, limit = 10 } = pagination;
      const offset = (page - 1) * limit;

      // Build query conditions
      const conditions = {};
      if (filters.category) conditions.category = filters.category;
      if (filters.role) conditions.role = filters.role;
      if (filters.is_active !== undefined) conditions.is_active = filters.is_active;

      // Get users
      const users = await this.findWhere(conditions, {
        limit,
        offset,
        orderBy: 'created_at DESC'
      });

      // Remove password hashes
      users.forEach(user => delete user.password_hash);

      // Get total count
      const totalCount = await this.count(conditions);

      return {
        users,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          hasNext: page * limit < totalCount,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      logger.error('Error getting users', { 
        filters, 
        pagination, 
        error: error.message 
      });
      throw error;
    }
  }
}

module.exports = User;