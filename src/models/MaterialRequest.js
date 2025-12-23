const BaseModel = require('./BaseModel');
const logger = require('../utils/logger');

/**
 * MaterialRequest Model
 * Handles material request database operations
 * Extends BaseModel for common CRUD operations
 */
class MaterialRequest extends BaseModel {
  constructor() {
    super('material_requests');
  }

  // Find material requests by user ID
  async findByUserId(userId) {
    return this.findWhere({ user_id: userId });
  }

  // Find material request by request ID
  async findByRequestId(requestId) {
    return this.findOne({ request_id: requestId });
  }

  // Create material request with validation
  async createMaterialRequest(requestData) {
    const { 
      userId, 
      requestId,
      projectId,
      materialName, 
      quantity, 
      unit,
      estimatedCost,
      urgency,
      description
    } = requestData;

    // Validate user exists
    const User = require('./User');
    const userModel = new User();
    const user = await userModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Validate project exists and belongs to user
    const Project = require('./Project');
    const projectModel = new Project();
    const project = await projectModel.findById(projectId);
    if (!project || project.user_id !== userId) {
      throw new Error('Project not found or access denied');
    }

    // Check if request ID already exists
    const existingRequest = await this.findByRequestId(requestId);
    if (existingRequest) {
      throw new Error('Material request with this ID already exists');
    }

    // Create material request
    const materialRequest = await this.create({
      request_id: requestId,
      user_id: userId,
      project_id: projectId,
      material_name: materialName,
      quantity,
      unit,
      estimated_cost: estimatedCost,
      urgency,
      description,
      status: 'Pending'
    });

    logger.business('material_request_created', {
      materialRequestId: materialRequest.id,
      requestId,
      userId,
      projectId,
      materialName,
      estimatedCost
    });

    return materialRequest;
  }

  // Approve material request
  async approveMaterialRequest(requestId, approvedBy) {
    const materialRequest = await this.findByRequestId(requestId);
    if (!materialRequest) {
      throw new Error('Material request not found');
    }

    if (materialRequest.status !== 'Pending') {
      throw new Error('Only pending requests can be approved');
    }

    const updatedRequest = await this.updateById(materialRequest.id, {
      status: 'Approved',
      approved_by: approvedBy,
      approved_at: new Date()
    });

    logger.business('material_request_approved', {
      materialRequestId: materialRequest.id,
      requestId,
      approvedBy
    });

    return updatedRequest;
  }

  // Reject material request
  async rejectMaterialRequest(requestId, rejectedBy, reason) {
    const materialRequest = await this.findByRequestId(requestId);
    if (!materialRequest) {
      throw new Error('Material request not found');
    }

    if (materialRequest.status !== 'Pending') {
      throw new Error('Only pending requests can be rejected');
    }

    const updatedRequest = await this.updateById(materialRequest.id, {
      status: 'Rejected',
      approved_by: rejectedBy,
      approved_at: new Date(),
      rejection_reason: reason
    });

    logger.business('material_request_rejected', {
      materialRequestId: materialRequest.id,
      requestId,
      rejectedBy,
      reason
    });

    return updatedRequest;
  }

  // Get material requests with pagination and filters
  async getMaterialRequests(filters = {}, pagination = {}) {
    const { page = 1, limit = 10 } = pagination;
    const offset = (page - 1) * limit;

    // Build conditions from filters
    const conditions = {};
    if (filters.userId) conditions.user_id = filters.userId;
    if (filters.projectId) conditions.project_id = filters.projectId;
    if (filters.status) conditions.status = filters.status;
    if (filters.urgency) conditions.urgency = filters.urgency;

    // Get material requests with project and user information
    let query = `
      SELECT mr.*, p.name as project_name, u.name as requester_name
      FROM material_requests mr
      JOIN projects p ON mr.project_id = p.id
      JOIN users u ON mr.user_id = u.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    // Add filters to query
    if (conditions.user_id) {
      paramCount++;
      query += ` AND mr.user_id = $${paramCount}`;
      params.push(conditions.user_id);
    }

    if (conditions.project_id) {
      paramCount++;
      query += ` AND mr.project_id = $${paramCount}`;
      params.push(conditions.project_id);
    }

    if (conditions.status) {
      paramCount++;
      query += ` AND mr.status = $${paramCount}`;
      params.push(conditions.status);
    }

    if (conditions.urgency) {
      paramCount++;
      query += ` AND mr.urgency = $${paramCount}`;
      params.push(conditions.urgency);
    }

    // Add pagination
    query += ` ORDER BY mr.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);

    // Get total count
    const totalCount = await this.count(conditions);

    return {
      materialRequests: result.rows,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNext: page * limit < totalCount,
        hasPrev: page > 1
      }
    };
  }

  // Get material request statistics
  async getMaterialRequestStats(userId) {
    const [pendingCount, approvedCount, rejectedCount, totalCost] = await Promise.all([
      this.db.query(
        'SELECT COUNT(*) FROM material_requests WHERE user_id = $1 AND status = $2',
        [userId, 'Pending']
      ),
      this.db.query(
        'SELECT COUNT(*) FROM material_requests WHERE user_id = $1 AND status = $2',
        [userId, 'Approved']
      ),
      this.db.query(
        'SELECT COUNT(*) FROM material_requests WHERE user_id = $1 AND status = $2',
        [userId, 'Rejected']
      ),
      this.db.query(
        'SELECT SUM(estimated_cost) FROM material_requests WHERE user_id = $1 AND status = $2',
        [userId, 'Approved']
      )
    ]);

    return {
      pendingRequests: parseInt(pendingCount.rows[0].count),
      approvedRequests: parseInt(approvedCount.rows[0].count),
      rejectedRequests: parseInt(rejectedCount.rows[0].count),
      totalApprovedCost: parseFloat(totalCost.rows[0].sum || 0)
    };
  }
}

module.exports = MaterialRequest;