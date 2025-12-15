const BaseModel = require('./BaseModel');
const AuthUtils = require('../utils/auth');
const logger = require('../utils/logger');

/**
 * Seller Model
 * Handles all seller-related database operations
 * Extends BaseModel for common CRUD operations
 */
class Seller extends BaseModel {
  constructor() {
    super('sellers');
  }

  /**
   * Find seller by email
   * @param {string} email - Seller email
   * @returns {Object|null} - Seller record or null
   */
  async findByEmail(email) {
    try {
      const result = await this.db.query(
        'SELECT * FROM sellers WHERE email = $1',
        [email]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding seller by email', { 
        email, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Create a new seller
   * @param {Object} sellerData - Seller data
   * @returns {Object} - Created seller (without password)
   */
  async createSeller(sellerData) {
    try {
      const { name, email, phone, password } = sellerData;

      // Check if seller already exists
      const existingSeller = await this.findByEmail(email);
      if (existingSeller) {
        throw new Error('Seller with this email already exists');
      }

      // Hash password
      const passwordHash = await AuthUtils.hashPassword(password);

      // Create seller
      const seller = await this.create({
        name,
        email,
        phone,
        password_hash: passwordHash,
        role: 'seller'
      });

      // Remove password hash from response
      delete seller.password_hash;

      logger.business('seller_created', {
        sellerId: seller.id,
        email: seller.email
      });

      return seller;
    } catch (error) {
      logger.error('Error creating seller', { 
        sellerData: { ...sellerData, password: '[REDACTED]' }, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Authenticate seller login
   * @param {string} email - Seller email
   * @param {string} password - Seller password
   * @returns {Object} - Seller data and token
   */
  async authenticateSeller(email, password) {
    try {
      // Find seller with password hash
      const seller = await this.db.query(
        `SELECT id, uuid, name, email, phone, password_hash, role, is_active 
         FROM sellers WHERE email = $1`,
        [email]
      );

      if (seller.rows.length === 0) {
        throw new Error('Invalid email or password');
      }

      const sellerData = seller.rows[0];

      // Check if seller is active
      if (!sellerData.is_active) {
        throw new Error('Account is deactivated. Please contact administrator.');
      }

      // Verify password
      const isValidPassword = await AuthUtils.comparePassword(password, sellerData.password_hash);
      if (!isValidPassword) {
        throw new Error('Invalid email or password');
      }

      // Generate token
      const token = AuthUtils.generateToken({
        id: sellerData.id,
        email: sellerData.email,
        role: sellerData.role
      });

      // Remove password hash from response
      delete sellerData.password_hash;

      logger.auth('seller_login', {
        sellerId: sellerData.id,
        email: sellerData.email
      });

      return {
        seller: sellerData,
        token
      };
    } catch (error) {
      logger.security('seller_login_failed', {
        email,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update seller profile
   * @param {number} sellerId - Seller ID
   * @param {Object} updateData - Data to update
   * @returns {Object|null} - Updated seller
   */
  async updateProfile(sellerId, updateData) {
    try {
      // Remove sensitive fields that shouldn't be updated directly
      const { password, password_hash, role, ...safeUpdateData } = updateData;

      const updatedSeller = await this.updateById(sellerId, safeUpdateData);
      
      if (updatedSeller) {
        delete updatedSeller.password_hash;
        
        logger.business('seller_profile_updated', {
          sellerId,
          updatedFields: Object.keys(safeUpdateData)
        });
      }

      return updatedSeller;
    } catch (error) {
      logger.error('Error updating seller profile', { 
        sellerId, 
        updateData, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Change seller password
   * @param {number} sellerId - Seller ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {boolean} - Success status
   */
  async changePassword(sellerId, currentPassword, newPassword) {
    try {
      // Get seller with current password hash
      const seller = await this.db.query(
        'SELECT password_hash FROM sellers WHERE id = $1',
        [sellerId]
      );

      if (seller.rows.length === 0) {
        throw new Error('Seller not found');
      }

      // Verify current password
      const isValidPassword = await AuthUtils.comparePassword(
        currentPassword, 
        seller.rows[0].password_hash
      );

      if (!isValidPassword) {
        throw new Error('Current password is incorrect');
      }

      // Hash new password
      const newPasswordHash = await AuthUtils.hashPassword(newPassword);

      // Update password
      await this.updateById(sellerId, { password_hash: newPasswordHash });

      logger.security('seller_password_changed', { sellerId });

      return true;
    } catch (error) {
      logger.error('Error changing seller password', { 
        sellerId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get sellers with pagination and filters
   * @param {Object} filters - Filter conditions
   * @param {Object} pagination - Pagination options
   * @returns {Object} - Sellers and pagination info
   */
  async getSellers(filters = {}, pagination = {}) {
    try {
      const { page = 1, limit = 10 } = pagination;
      const offset = (page - 1) * limit;

      // Build query conditions
      const conditions = {};
      if (filters.is_active !== undefined) conditions.is_active = filters.is_active;

      // Get sellers
      const sellers = await this.findWhere(conditions, {
        limit,
        offset,
        orderBy: 'created_at DESC'
      });

      // Remove password hashes
      sellers.forEach(seller => delete seller.password_hash);

      // Get total count
      const totalCount = await this.count(conditions);

      return {
        sellers,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          hasNext: page * limit < totalCount,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      logger.error('Error getting sellers', { 
        filters, 
        pagination, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Deactivate seller account
   * @param {number} sellerId - Seller ID
   * @returns {boolean} - Success status
   */
  async deactivateSeller(sellerId) {
    try {
      const updatedSeller = await this.updateById(sellerId, { is_active: false });
      
      if (updatedSeller) {
        logger.business('seller_deactivated', { sellerId });
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Error deactivating seller', { 
        sellerId, 
        error: error.message 
      });
      throw error;
    }
  }
}

module.exports = new Seller();