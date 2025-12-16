const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Base Model Class
 * Provides common database operations and utilities for all models
 * Implements standard CRUD operations and query helpers
 */
class BaseModel {
  constructor(tableName) {
    this.tableName = tableName;
    this.db = db;
  }

  /**
   * Find a record by ID
   * @param {number} id - Record ID
   * @returns {Object|null} - Record or null if not found
   */
  async findById(id) {
    try {
      const result = await this.db.query(
        `SELECT * FROM ${this.tableName} WHERE id = $1`,
        [id]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error finding ${this.tableName} by ID`, { 
        id, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Find a record by UUID
   * @param {string} uuid - Record UUID
   * @returns {Object|null} - Record or null if not found
   */
  async findByUuid(uuid) {
    try {
      const result = await this.db.query(
        `SELECT * FROM ${this.tableName} WHERE uuid = $1`,
        [uuid]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error finding ${this.tableName} by UUID`, { 
        uuid, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Find a single record with conditions
   * @param {Object} conditions - Where conditions
   * @returns {Object|null} - Record or null if not found
   */
  async findOne(conditions = {}) {
    try {
      let query = `SELECT * FROM ${this.tableName}`;
      const params = [];
      let paramCount = 0;

      // Build WHERE clause
      if (Object.keys(conditions).length > 0) {
        const whereClause = Object.keys(conditions).map(key => {
          paramCount++;
          params.push(conditions[key]);
          return `${key} = $${paramCount}`;
        }).join(' AND ');
        
        query += ` WHERE ${whereClause}`;
      }

      query += ' LIMIT 1';

      const result = await this.db.query(query, params);
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error finding one ${this.tableName}`, { 
        conditions, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Find records with conditions
   * @param {Object} conditions - Where conditions
   * @param {Object} options - Query options (limit, offset, orderBy)
   * @returns {Array} - Array of records
   */
  async findWhere(conditions = {}, options = {}) {
    try {
      const { limit, offset, orderBy = 'created_at DESC' } = options;
      
      let query = `SELECT * FROM ${this.tableName}`;
      const params = [];
      let paramCount = 0;

      // Build WHERE clause
      if (Object.keys(conditions).length > 0) {
        const whereClause = Object.keys(conditions).map(key => {
          paramCount++;
          params.push(conditions[key]);
          return `${key} = $${paramCount}`;
        }).join(' AND ');
        
        query += ` WHERE ${whereClause}`;
      }

      // Add ORDER BY
      query += ` ORDER BY ${orderBy}`;

      // Add LIMIT and OFFSET
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
      return result.rows;
    } catch (error) {
      logger.error(`Error finding ${this.tableName} with conditions`, { 
        conditions, 
        options,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Create a new record
   * @param {Object} data - Record data
   * @returns {Object} - Created record
   */
  async create(data) {
    try {
      const fields = Object.keys(data);
      const values = Object.values(data);
      const placeholders = fields.map((_, index) => `$${index + 1}`).join(', ');
      
      const query = `
        INSERT INTO ${this.tableName} (${fields.join(', ')}) 
        VALUES (${placeholders}) 
        RETURNING *
      `;

      const result = await this.db.query(query, values);
      
      logger.db('create', {
        table: this.tableName,
        recordId: result.rows[0].id
      });

      return result.rows[0];
    } catch (error) {
      logger.error(`Error creating ${this.tableName}`, { 
        data, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Update a record by ID
   * @param {number} id - Record ID
   * @param {Object} data - Update data
   * @returns {Object|null} - Updated record or null if not found
   */
  async updateById(id, data) {
    try {
      const fields = Object.keys(data);
      const values = Object.values(data);
      
      const setClause = fields.map((field, index) => 
        `${field} = $${index + 2}`
      ).join(', ');
      
      const query = `
        UPDATE ${this.tableName} 
        SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
        WHERE id = $1 
        RETURNING *
      `;

      const result = await this.db.query(query, [id, ...values]);
      
      if (result.rows.length > 0) {
        logger.db('update', {
          table: this.tableName,
          recordId: id,
          fields: fields
        });
      }

      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error updating ${this.tableName}`, { 
        id, 
        data, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Delete a record by ID
   * @param {number} id - Record ID
   * @returns {boolean} - True if deleted, false if not found
   */
  async deleteById(id) {
    try {
      const result = await this.db.query(
        `DELETE FROM ${this.tableName} WHERE id = $1`,
        [id]
      );

      const deleted = result.rowCount > 0;
      
      if (deleted) {
        logger.db('delete', {
          table: this.tableName,
          recordId: id
        });
      }

      return deleted;
    } catch (error) {
      logger.error(`Error deleting ${this.tableName}`, { 
        id, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Count records with conditions
   * @param {Object} conditions - Where conditions
   * @returns {number} - Count of records
   */
  async count(conditions = {}) {
    try {
      let query = `SELECT COUNT(*) FROM ${this.tableName}`;
      const params = [];
      let paramCount = 0;

      if (Object.keys(conditions).length > 0) {
        const whereClause = Object.keys(conditions).map(key => {
          paramCount++;
          params.push(conditions[key]);
          return `${key} = $${paramCount}`;
        }).join(' AND ');
        
        query += ` WHERE ${whereClause}`;
      }

      const result = await this.db.query(query, params);
      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error(`Error counting ${this.tableName}`, { 
        conditions, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Check if record exists
   * @param {Object} conditions - Where conditions
   * @returns {boolean} - True if exists, false otherwise
   */
  async exists(conditions) {
    try {
      const count = await this.count(conditions);
      return count > 0;
    } catch (error) {
      logger.error(`Error checking existence in ${this.tableName}`, { 
        conditions, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Execute transaction
   * @param {Function} callback - Transaction callback
   * @returns {*} - Transaction result
   */
  async transaction(callback) {
    return this.db.transaction(callback);
  }
}

module.exports = BaseModel;