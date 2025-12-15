const BaseModel = require('./BaseModel');
const logger = require('../utils/logger');

/**
 * Worker Model
 * Handles all worker-related database operations
 * Extends BaseModel for common CRUD operations
 */
class Worker extends BaseModel {
  constructor() {
    super('workers');
  }

  /**
   * Find worker by card ID
   * @param {string} cardId - Worker card ID
   * @returns {Object|null} - Worker record or null
   */
  async findByCardId(cardId) {
    try {
      const result = await this.db.query(
        'SELECT * FROM workers WHERE card_id = $1',
        [cardId]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding worker by card ID', { 
        cardId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Create a new worker
   * @param {Object} workerData - Worker data
   * @returns {Object} - Created worker
   */
  async createWorker(workerData) {
    try {
      const { userId, fullname, phone, email, position, bankAccount, idPassport, salary } = workerData;

      // Verify user exists
      const userExists = await this.db.query('SELECT id FROM users WHERE id = $1', [userId]);
      if (userExists.rows.length === 0) {
        throw new Error('User not found');
      }

      // Create worker
      const worker = await this.create({
        user_id: userId,
        fullname,
        phone,
        email,
        position,
        bank_account: bankAccount,
        id_passport: idPassport,
        salary
      });

      logger.business('worker_created', {
        workerId: worker.id,
        userId,
        position
      });

      return worker;
    } catch (error) {
      logger.error('Error creating worker', { 
        workerData, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Create worker with card and assign to project
   * @param {Object} workerData - Worker data with card
   * @param {number} userId - User ID creating the worker
   * @returns {Object} - Created worker
   */
  async createWorkerWithCard(workerData, userId) {
    try {
      const { cardId, name, email, phone, positionId, projectId, nationalId, address } = workerData;

      // Verify position and project exist
      const [positionExists, projectExists] = await Promise.all([
        this.db.query('SELECT id, name FROM positions WHERE id = $1', [positionId]),
        this.db.query('SELECT id, name FROM projects WHERE id = $1', [projectId])
      ]);

      if (positionExists.rows.length === 0) {
        throw new Error('Position not found');
      }

      if (projectExists.rows.length === 0) {
        throw new Error('Project not found');
      }

      // Check if card ID already exists
      const cardExists = await this.findByCardId(cardId);
      if (cardExists) {
        throw new Error('Worker with this card ID already exists');
      }

      const position = positionExists.rows[0];

      // Create worker with transaction
      const result = await this.transaction(async (client) => {
        // Create worker
        const workerResult = await client.query(
          `INSERT INTO workers (card_id, fullname, phone, email, position_id, national_id, address, user_id) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
           RETURNING id, uuid, card_id, fullname, phone, email, created_at`,
          [cardId, name, email, phone, positionId, nationalId, address, userId]
        );

        const worker = workerResult.rows[0];

        // Assign worker to project
        await client.query(
          'INSERT INTO project_workers (project_id, worker_id) VALUES ($1, $2)',
          [projectId, worker.id]
        );

        return { ...worker, position: position.name };
      });

      logger.business('worker_with_card_created', {
        workerId: result.id,
        cardId,
        projectId
      });

      return result;
    } catch (error) {
      logger.error('Error creating worker with card', { 
        workerData, 
        userId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get workers by user ID
   * @param {number} userId - User ID
   * @param {Object} options - Query options
   * @returns {Array} - Array of workers
   */
  async getWorkersByUser(userId, options = {}) {
    try {
      const workers = await this.findWhere({ user_id: userId }, options);
      
      logger.db('get_workers_by_user', {
        userId,
        count: workers.length
      });

      return workers;
    } catch (error) {
      logger.error('Error getting workers by user', { 
        userId, 
        options, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get workers by project ID
   * @param {number} projectId - Project ID
   * @param {Object} options - Query options
   * @returns {Array} - Array of workers with project assignment info
   */
  async getWorkersByProject(projectId, options = {}) {
    try {
      const { limit, offset, orderBy = 'pw.assigned_at DESC' } = options;
      
      let query = `
        SELECT w.*, pw.assigned_at, pw.is_active as project_active,
               p.name as position_name
        FROM workers w
        JOIN project_workers pw ON w.id = pw.worker_id
        LEFT JOIN positions p ON w.position_id = p.id
        WHERE pw.project_id = $1 AND pw.is_active = true
        ORDER BY ${orderBy}
      `;

      const params = [projectId];
      let paramCount = 1;

      if (limit) {
        paramCount++;
        query += ` LIMIT $${paramCount}`;
        params.push(limit);
      }

      if (offset) {
        paramCount++;
        query += ` OFFSET $${paramCount}`;
        params.push(offset);
      }

      const result = await this.db.query(query, params);
      
      logger.db('get_workers_by_project', {
        projectId,
        count: result.rows.length
      });

      return result.rows;
    } catch (error) {
      logger.error('Error getting workers by project', { 
        projectId, 
        options, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Update worker information
   * @param {number} workerId - Worker ID
   * @param {Object} updateData - Data to update
   * @returns {Object|null} - Updated worker
   */
  async updateWorker(workerId, updateData) {
    try {
      const updatedWorker = await this.updateById(workerId, updateData);
      
      if (updatedWorker) {
        logger.business('worker_updated', {
          workerId,
          updatedFields: Object.keys(updateData)
        });
      }

      return updatedWorker;
    } catch (error) {
      logger.error('Error updating worker', { 
        workerId, 
        updateData, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Assign worker to project
   * @param {number} workerId - Worker ID
   * @param {number} projectId - Project ID
   * @returns {Object} - Assignment record
   */
  async assignToProject(workerId, projectId) {
    try {
      // Check if already assigned
      const existingAssignment = await this.db.query(
        'SELECT id FROM project_workers WHERE worker_id = $1 AND project_id = $2 AND is_active = true',
        [workerId, projectId]
      );

      if (existingAssignment.rows.length > 0) {
        throw new Error('Worker is already assigned to this project');
      }

      // Create assignment
      const result = await this.db.query(
        'INSERT INTO project_workers (worker_id, project_id) VALUES ($1, $2) RETURNING *',
        [workerId, projectId]
      );

      logger.business('worker_assigned_to_project', {
        workerId,
        projectId,
        assignmentId: result.rows[0].id
      });

      return result.rows[0];
    } catch (error) {
      logger.error('Error assigning worker to project', { 
        workerId, 
        projectId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Remove worker from project
   * @param {number} workerId - Worker ID
   * @param {number} projectId - Project ID
   * @returns {boolean} - Success status
   */
  async removeFromProject(workerId, projectId) {
    try {
      const result = await this.db.query(
        'UPDATE project_workers SET is_active = false WHERE worker_id = $1 AND project_id = $2',
        [workerId, projectId]
      );

      const success = result.rowCount > 0;
      
      if (success) {
        logger.business('worker_removed_from_project', {
          workerId,
          projectId
        });
      }

      return success;
    } catch (error) {
      logger.error('Error removing worker from project', { 
        workerId, 
        projectId, 
        error: error.message 
      });
      throw error;
    }
  }
}

module.exports = new Worker();