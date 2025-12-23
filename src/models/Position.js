const BaseModel = require('./BaseModel');
const logger = require('../utils/logger');

/**
 * Position Model
 * Handles position-related database operations
 * Extends BaseModel for common CRUD operations
 */
class Position extends BaseModel {
  constructor() {
    super('positions');
  }

  // Find positions by user ID
  async findByUserId(userId) {
    return this.findWhere({ user_id: userId });
  }

  // Create position with validation
  async createPosition(positionData) {
    const { 
      userId, 
      name, 
      description, 
      defaultDailyRate 
    } = positionData;

    // Validate user exists
    const User = require('./User');
    const userModel = new User();
    const user = await userModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if position with same name already exists for this user
    const existingPosition = await this.findOne({ 
      user_id: userId, 
      name: name 
    });

    if (existingPosition) {
      throw new Error('Position with this name already exists');
    }

    // Create position
    const position = await this.create({
      user_id: userId,
      name,
      description,
      default_daily_rate: defaultDailyRate
    });

    logger.business('position_created', {
      positionId: position.id,
      userId,
      name,
      defaultDailyRate
    });

    return position;
  }

  // Update position information
  async updatePosition(positionId, updateData, userId) {
    // Verify ownership
    const position = await this.findById(positionId);
    if (!position) {
      throw new Error('Position not found');
    }

    if (position.user_id !== userId) {
      throw new Error('Access denied. You can only update your own positions.');
    }

    // Map frontend field names to database field names
    const fieldMapping = {
      name: 'name',
      description: 'description',
      defaultDailyRate: 'default_daily_rate'
    };

    const allowedFields = Object.values(fieldMapping);
    
    const filteredData = {};
    Object.keys(updateData).forEach(key => {
      const dbField = fieldMapping[key] || key;
      if (allowedFields.includes(dbField)) {
        filteredData[dbField] = updateData[key];
      }
    });

    const updatedPosition = await this.updateById(positionId, filteredData);

    if (updatedPosition) {
      logger.business('position_updated', {
        positionId,
        userId,
        updatedFields: Object.keys(filteredData)
      });
    }

    return updatedPosition;
  }

  // Get positions with pagination and filters
  async getPositions(filters = {}, pagination = {}) {
    const { page = 1, limit = 10 } = pagination;
    const offset = (page - 1) * limit;

    // Build conditions from filters
    const conditions = {};
    if (filters.userId) conditions.user_id = filters.userId;

    const positions = await this.findWhere(conditions, {
      limit,
      offset,
      orderBy: 'created_at DESC'
    });

    // Get total count
    const totalCount = await this.count(conditions);

    return {
      positions,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNext: page * limit < totalCount,
        hasPrev: page > 1
      }
    };
  }

  // Delete position
  async deletePosition(positionId, userId) {
    const position = await this.findById(positionId);
    if (!position || position.user_id !== userId) {
      throw new Error('Position not found or access denied');
    }

    // Check if position is used in any projects
    const projectUsage = await this.db.query(
      'SELECT COUNT(*) FROM project_positions WHERE position_id = $1',
      [positionId]
    );

    if (parseInt(projectUsage.rows[0].count) > 0) {
      throw new Error('Cannot delete position that is used in projects');
    }

    const deleted = await this.deleteById(positionId);

    if (deleted) {
      logger.business('position_deleted', { positionId, userId });
    }

    return deleted;
  }
}

module.exports = Position;