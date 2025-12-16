const User = require('../models/User');
const userModel = new User();
const Worker = require('../models/Worker');
const Seller = require('../models/Seller');
const AuthUtils = require('../utils/auth');
const logger = require('../utils/logger');

/**
 * User Controller
 * Handles HTTP requests for user management operations
 * Uses models for data access and business logic
 */
class UserController {
  /**
   * User Registration
   * Creates a new user account with validation and authentication
   */
  static async register(req, res, next) {
    try {
      const userData = req.body;

      // Create user using model
      const user = await userModel.createUser(userData);

      // Generate authentication token
      const token = AuthUtils.generateToken({
        id: user.id,
        email: user.email,
        role: user.role
      });

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: {
            id: user.id,
            uuid: user.uuid,
            name: user.name,
            email: user.email,
            phone: user.phone,
            category: user.category,
            role: user.role,
            createdAt: user.created_at
          },
          token
        }
      });
    } catch (error) {
      if (error.message === 'User with this email already exists') {
        return res.status(409).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * User Login
   * Authenticates user credentials and returns JWT token
   */
  static async login(req, res, next) {
    try {
      const { email, password } = req.body;

      // Authenticate user using model
      const { user, token } = await userModel.authenticateUser(email, password);

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            uuid: user.uuid,
            name: user.name,
            email: user.email,
            phone: user.phone,
            category: user.category,
            role: user.role
          },
          token
        }
      });
    } catch (error) {
      if (error.message.includes('Invalid email or password') || 
          error.message.includes('Account is deactivated')) {
        return res.status(401).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Create Worker
   * Creates a new worker record associated with a user
   */
  static async createWorker(req, res, next) {
    try {
      const workerData = req.body;

      // Create worker using model
      const worker = await Worker.createWorker(workerData);

      res.status(201).json({
        success: true,
        message: 'Worker created successfully',
        data: {
          worker: {
            id: worker.id,
            uuid: worker.uuid,
            fullname: worker.fullname,
            phone: worker.phone,
            email: worker.email,
            position: worker.position,
            salary: worker.salary,
            createdAt: worker.created_at
          }
        }
      });
    } catch (error) {
      if (error.message === 'User not found') {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Create Worker with Card
   * Creates a worker with card ID and assigns to project
   */
  static async createWorkerWithCard(req, res, next) {
    try {
      const workerData = req.body;
      const userId = req.user.id;

      // Create worker with card using model
      const worker = await Worker.createWorkerWithCard(workerData, userId);

      res.status(201).json({
        success: true,
        message: 'Worker created and assigned to project successfully',
        data: {
          worker: {
            id: worker.id,
            uuid: worker.uuid,
            cardId: worker.card_id,
            fullname: worker.fullname,
            phone: worker.phone,
            email: worker.email,
            position: worker.position,
            createdAt: worker.created_at
          }
        }
      });
    } catch (error) {
      if (error.message === 'Position not found') {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      if (error.message === 'Project not found') {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      if (error.message === 'Worker with this card ID already exists') {
        return res.status(409).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Create Seller
   * Creates a new seller account
   */
  static async createSeller(req, res, next) {
    try {
      const sellerData = req.body;

      // Create seller using model
      const seller = await Seller.createSeller(sellerData);

      res.status(201).json({
        success: true,
        message: 'Seller created successfully',
        data: {
          seller: {
            id: seller.id,
            uuid: seller.uuid,
            name: seller.name,
            email: seller.email,
            phone: seller.phone,
            role: seller.role,
            createdAt: seller.created_at
          }
        }
      });
    } catch (error) {
      if (error.message === 'Seller with this email already exists') {
        return res.status(409).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Get User Profile
   * Returns authenticated user's profile information
   */
  static async getProfile(req, res, next) {
    try {
      const userId = req.user.id;
      
      const user = await userModel.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Remove sensitive information
      delete user.password_hash;

      res.json({
        success: true,
        message: 'Profile retrieved successfully',
        data: { user }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update User Profile
   * Updates authenticated user's profile information
   */
  static async updateProfile(req, res, next) {
    try {
      const userId = req.user.id;
      const updateData = req.body;

      const updatedUser = await userModel.updateProfile(userId, updateData);
      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: { user: updatedUser }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Users (Admin only)
   * Returns paginated list of users with filters
   */
  static async getUsers(req, res, next) {
    try {
      const { page, limit, category, role, is_active } = req.query;
      
      const filters = {};
      if (category) filters.category = category;
      if (role) filters.role = role;
      if (is_active !== undefined) filters.is_active = is_active === 'true';

      const result = await userModel.getUsers(filters, { page: parseInt(page), limit: parseInt(limit) });

      res.json({
        success: true,
        message: 'Users retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = UserController;