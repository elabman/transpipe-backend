const BaseModel = require('./BaseModel');
const logger = require('../utils/logger');

/**
 * Payment Model
 * Handles payment request database operations
 * Extends BaseModel for common CRUD operations
 */
class Payment extends BaseModel {
  constructor() {
    super('payment_requests');
  }

  // Find payment requests by user ID
  async findByUserId(userId) {
    return this.findWhere({ user_id: userId });
  }

  // Find payment request by request ID
  async findByRequestId(requestId) {
    return this.findOne({ request_id: requestId });
  }

  // Create payment request with workers
  async createPaymentRequest(paymentData) {
    const { 
      userId, 
      requestId,
      projectId,
      requestDate,
      workers,
      notes
    } = paymentData;

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
      throw new Error('Payment request with this ID already exists');
    }

    // Validate workers belong to user
    for (const worker of workers) {
      const workerResult = await this.db.query(
        'SELECT * FROM workers WHERE id = $1 AND user_id = $2',
        [worker.workerId, userId]
      );
      if (workerResult.rows.length === 0) {
        throw new Error(`Worker with ID ${worker.workerId} not found or access denied`);
      }
    }

    // Calculate total amount
    const totalAmount = workers.reduce((sum, worker) => 
      sum + (worker.daysWorked * worker.allowancePerDay), 0
    );

    // Use transaction to create payment request and workers
    return await this.transaction(async (client) => {
      // Create payment request
      const paymentRequestResult = await client.query(
        `INSERT INTO payment_requests (request_id, user_id, project_id, request_date, total_amount, notes, status) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [requestId, userId, projectId, requestDate, totalAmount, notes, 'Pending']
      );

      const paymentRequest = paymentRequestResult.rows[0];

      // Create payment request workers
      for (const worker of workers) {
        const workerTotalAmount = worker.daysWorked * worker.allowancePerDay;
        await client.query(
          `INSERT INTO payment_request_workers (payment_request_id, worker_id, days_worked, allowance_per_day, total_amount) 
           VALUES ($1, $2, $3, $4, $5)`,
          [paymentRequest.id, worker.workerId, worker.daysWorked, worker.allowancePerDay, workerTotalAmount]
        );
      }

      logger.business('payment_request_created', {
        paymentRequestId: paymentRequest.id,
        requestId,
        userId,
        projectId,
        totalAmount,
        workersCount: workers.length
      });

      return paymentRequest;
    });
  }

  // Approve payment request
  async approvePaymentRequest(requestId, approvedBy) {
    const paymentRequest = await this.findByRequestId(requestId);
    if (!paymentRequest) {
      throw new Error('Payment request not found');
    }

    if (paymentRequest.status !== 'Pending') {
      throw new Error('Only pending payment requests can be approved');
    }

    const updatedRequest = await this.updateById(paymentRequest.id, {
      status: 'Approved',
      approved_by: approvedBy,
      approved_at: new Date()
    });

    logger.business('payment_request_approved', {
      paymentRequestId: paymentRequest.id,
      requestId,
      approvedBy,
      totalAmount: paymentRequest.total_amount
    });

    return updatedRequest;
  }

  // Reject payment request
  async rejectPaymentRequest(requestId, rejectedBy, reason) {
    const paymentRequest = await this.findByRequestId(requestId);
    if (!paymentRequest) {
      throw new Error('Payment request not found');
    }

    if (paymentRequest.status !== 'Pending') {
      throw new Error('Only pending payment requests can be rejected');
    }

    const updatedRequest = await this.updateById(paymentRequest.id, {
      status: 'Rejected',
      approved_by: rejectedBy,
      approved_at: new Date(),
      rejection_reason: reason
    });

    logger.business('payment_request_rejected', {
      paymentRequestId: paymentRequest.id,
      requestId,
      rejectedBy,
      reason,
      totalAmount: paymentRequest.total_amount
    });

    return updatedRequest;
  }

  // Process approved payments
  async processPayments(paymentIds, userId) {
    // Validate all payment requests exist and are approved
    const paymentRequests = [];
    for (const paymentId of paymentIds) {
      const payment = await this.findById(paymentId);
      if (!payment) {
        throw new Error(`Payment request with ID ${paymentId} not found`);
      }
      if (payment.user_id !== userId) {
        throw new Error(`Access denied for payment request ${paymentId}`);
      }
      if (payment.status !== 'Approved') {
        throw new Error(`Payment request ${payment.request_id} is not approved`);
      }
      paymentRequests.push(payment);
    }

    // Process payments (update status to Processed)
    const processedPayments = [];
    for (const payment of paymentRequests) {
      const processedPayment = await this.updateById(payment.id, {
        status: 'Processed'
      });
      processedPayments.push(processedPayment);
    }

    const totalProcessedAmount = paymentRequests.reduce((sum, payment) => 
      sum + parseFloat(payment.total_amount), 0
    );

    logger.business('payments_processed', {
      userId,
      paymentCount: paymentIds.length,
      totalAmount: totalProcessedAmount,
      paymentIds
    });

    return {
      processedPayments,
      totalAmount: totalProcessedAmount,
      count: paymentIds.length
    };
  }

  // Get payment requests with pagination and filters
  async getPaymentRequests(filters = {}, pagination = {}) {
    const { page = 1, limit = 10 } = pagination;
    const offset = (page - 1) * limit;

    // Build conditions from filters
    const conditions = {};
    if (filters.userId) conditions.user_id = filters.userId;
    if (filters.projectId) conditions.project_id = filters.projectId;
    if (filters.status) conditions.status = filters.status;

    // Get payment requests with project and user information
    let query = `
      SELECT pr.*, p.name as project_name, u.name as requester_name,
             approver.name as approver_name
      FROM payment_requests pr
      JOIN projects p ON pr.project_id = p.id
      JOIN users u ON pr.user_id = u.id
      LEFT JOIN users approver ON pr.approved_by = approver.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    // Add filters to query
    if (conditions.user_id) {
      paramCount++;
      query += ` AND pr.user_id = $${paramCount}`;
      params.push(conditions.user_id);
    }

    if (conditions.project_id) {
      paramCount++;
      query += ` AND pr.project_id = $${paramCount}`;
      params.push(conditions.project_id);
    }

    if (conditions.status) {
      paramCount++;
      query += ` AND pr.status = $${paramCount}`;
      params.push(conditions.status);
    }

    // Add date range filters if provided
    if (filters.startDate) {
      paramCount++;
      query += ` AND pr.request_date >= $${paramCount}`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      paramCount++;
      query += ` AND pr.request_date <= $${paramCount}`;
      params.push(filters.endDate);
    }

    // Add pagination
    query += ` ORDER BY pr.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);

    // Get total count
    const totalCount = await this.count(conditions);

    return {
      paymentRequests: result.rows,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNext: page * limit < totalCount,
        hasPrev: page > 1
      }
    };
  }

  // Get payment request with workers details
  async getPaymentRequestWithWorkers(paymentRequestId, userId) {
    // Get payment request
    const paymentRequest = await this.findById(paymentRequestId);
    if (!paymentRequest || paymentRequest.user_id !== userId) {
      throw new Error('Payment request not found or access denied');
    }

    // Get workers for this payment request
    const workersResult = await this.db.query(
      `SELECT prw.*, w.fullname as worker_name, w.position
       FROM payment_request_workers prw
       JOIN workers w ON prw.worker_id = w.id
       WHERE prw.payment_request_id = $1`,
      [paymentRequestId]
    );

    return {
      paymentRequest,
      workers: workersResult.rows
    };
  }

  // Get payment statistics
  async getPaymentStats(filters = {}) {
    const conditions = {};
    if (filters.userId) conditions.user_id = filters.userId;
    if (filters.projectId) conditions.project_id = filters.projectId;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (conditions.user_id) {
      paramCount++;
      whereClause += ` AND user_id = $${paramCount}`;
      params.push(conditions.user_id);
    }

    if (conditions.project_id) {
      paramCount++;
      whereClause += ` AND project_id = $${paramCount}`;
      params.push(conditions.project_id);
    }

    // Add date range if provided
    if (filters.startDate) {
      paramCount++;
      whereClause += ` AND request_date >= $${paramCount}`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      paramCount++;
      whereClause += ` AND request_date <= $${paramCount}`;
      params.push(filters.endDate);
    }

    // Get statistics in parallel
    const [totalRequests, pendingCount, approvedCount, rejectedCount, processedCount, totalAmount] = await Promise.all([
      this.db.query(`SELECT COUNT(*) FROM payment_requests ${whereClause}`, params),
      this.db.query(`SELECT COUNT(*) FROM payment_requests ${whereClause} AND status = 'Pending'`, params),
      this.db.query(`SELECT COUNT(*) FROM payment_requests ${whereClause} AND status = 'Approved'`, params),
      this.db.query(`SELECT COUNT(*) FROM payment_requests ${whereClause} AND status = 'Rejected'`, params),
      this.db.query(`SELECT COUNT(*) FROM payment_requests ${whereClause} AND status = 'Processed'`, params),
      this.db.query(`SELECT SUM(total_amount) FROM payment_requests ${whereClause} AND status IN ('Approved', 'Processed')`, params)
    ]);

    return {
      totalRequests: parseInt(totalRequests.rows[0].count),
      pendingRequests: parseInt(pendingCount.rows[0].count),
      approvedRequests: parseInt(approvedCount.rows[0].count),
      rejectedRequests: parseInt(rejectedCount.rows[0].count),
      processedRequests: parseInt(processedCount.rows[0].count),
      totalApprovedAmount: parseFloat(totalAmount.rows[0].sum || 0)
    };
  }

  // Delete payment request (only if pending)
  async deletePaymentRequest(paymentRequestId, userId) {
    const paymentRequest = await this.findById(paymentRequestId);
    if (!paymentRequest || paymentRequest.user_id !== userId) {
      throw new Error('Payment request not found or access denied');
    }

    if (paymentRequest.status !== 'Pending') {
      throw new Error('Only pending payment requests can be deleted');
    }

    const deleted = await this.deleteById(paymentRequestId);

    if (deleted) {
      logger.business('payment_request_deleted', { 
        paymentRequestId, 
        userId,
        requestId: paymentRequest.request_id
      });
    }

    return deleted;
  }
}

module.exports = Payment;