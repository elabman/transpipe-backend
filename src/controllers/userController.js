const db = require('../config/database');
const AuthUtils = require('../utils/auth');
const logger = require('../utils/logger');

class UserController {
  // User Registration
  static async register(req, res, next) {
    try {
      const { name, email, phone, password, category } = req.body;

      // Check if user already exists
      const existingUser = await db.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'User with this email already exists'
        });
      }

      // Hash password
      const passwordHash = await AuthUtils.hashPassword(password);

      // Create user
      const result = await db.query(
        `INSERT INTO users (name, email, phone, password_hash, category) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING id, uuid, name, email, phone, category, role, created_at`,
        [name, email, phone, passwordHash, category]
      );

      const user = result.rows[0];

      // Generate tokens
      const token = AuthUtils.generateToken({
        id: user.id,
        email: user.email,
        role: user.role
      });

      logger.info('User registered successfully', { 
        userId: user.id, 
        email: user.email,
        category 
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
      next(error);
    }
  }

  // User Login
  static async login(req, res, next) {
    try {
      const { email, password } = req.body;

      // Find user
      const result = await db.query(
        `SELECT id, uuid, name, email, phone, password_hash, category, role, is_active 
         FROM users WHERE email = $1`,
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      const user = result.rows[0];

      // Check if user is active
      if (!user.is_active) {
        return res.status(401).json({
          success: false,
          message: 'Account is deactivated. Please contact administrator.'
        });
      }

      // Verify password
      const isValidPassword = await AuthUtils.comparePassword(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Generate token
      const token = AuthUtils.generateToken({
        id: user.id,
        email: user.email,
        role: user.role
      });

      logger.info('User logged in successfully', { 
        userId: user.id, 
        email: user.email 
      });

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
      next(error);
    }
  }

  // Create Worker
  static async createWorker(req, res, next) {
    try {
      const { userId, fullname, phone, email, position, bankAccount, idPassport, salary } = req.body;

      // Verify worker exists
      const userExists = await db.query('SELECT id FROM users WHERE id = $1', [userId]);
      if (userExists.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Create worker
      const result = await db.query(
        `INSERT INTO workers (user_id, fullname, phone, email, position, bank_account, id_passport, salary) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         RETURNING id, uuid, fullname, phone, email, position, salary, created_at`,
        [userId, fullname, phone, email, position, bankAccount, idPassport, salary]
      );

      const worker = result.rows[0];

      logger.info('Worker created successfully', { 
        workerId: worker.id, 
        userId,
        position 
      });

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
      next(error);
    }
  }

  // Create Worker with Card
  static async createWorkerWithCard(req, res, next) {
    try {
      const { cardId, name, email, phone, positionId, projectId, nationalId, address } = req.body;

      // Verify position and project exist
      const [positionExists, projectExists] = await Promise.all([
        db.query('SELECT id, name FROM positions WHERE id = $1', [positionId]),
        db.query('SELECT id, name FROM projects WHERE id = $1', [projectId])
      ]);

      if (positionExists.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Position not found'
        });
      }

      if (projectExists.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }

      // Check if card ID already exists
      const cardExists = await db.query('SELECT id FROM workers WHERE card_id = $1', [cardId]);
      if (cardExists.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Worker with this card ID already exists'
        });
      }

      const position = positionExists.rows[0];

      // Create worker with transaction
      const result = await db.transaction(async (client) => {
        // Create worker
        const workerResult = await client.query(
          `INSERT INTO workers (card_id, fullname, phone, email, position_id, national_id, address, user_id) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
           RETURNING id, uuid, card_id, fullname, phone, email, created_at`,
          [cardId, name, email, phone, positionId, nationalId, address, req.user.id]
        );

        const worker = workerResult.rows[0];

        // Assign worker to project
        await client.query(
          'INSERT INTO project_workers (project_id, worker_id) VALUES ($1, $2)',
          [projectId, worker.id]
        );

        return worker;
      });

      logger.info('Worker with card created successfully', { 
        workerId: result.id, 
        cardId,
        projectId 
      });

      res.status(201).json({
        success: true,
        message: 'Worker created and assigned to project successfully',
        data: {
          worker: {
            id: result.id,
            uuid: result.uuid,
            cardId: result.card_id,
            fullname: result.fullname,
            phone: result.phone,
            email: result.email,
            position: position.name,
            createdAt: result.created_at
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Create Seller
  static async createSeller(req, res, next) {
    try {
      const { name, email, phone, password } = req.body;

      // Check if seller already exists
      const existingSeller = await db.query(
        'SELECT id FROM sellers WHERE email = $1',
        [email]
      );

      if (existingSeller.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Seller with this email already exists'
        });
      }

      // Hash password
      const passwordHash = await AuthUtils.hashPassword(password);

      // Create seller
      const result = await db.query(
        `INSERT INTO sellers (name, email, phone, password_hash, role) 
         VALUES ($1, $2, $3, $4, 'seller') 
         RETURNING id, uuid, name, email, phone, role, created_at`,
        [name, email, phone, passwordHash]
      );

      const seller = result.rows[0];

      logger.info('Seller created successfully', { 
        sellerId: seller.id, 
        email: seller.email 
      });

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
      next(error);
    }
  }
}

module.exports = UserController;