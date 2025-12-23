const Payment = require('../models/Payment');
const logger = require('../utils/logger');

const paymentModel = new Payment();

/**
 * Payment Controller
 * Handles HTTP requests for payment management operations
 */
class PaymentController {
  /**
   * Create Payment Request
   * Creates a new payment request for workers
   */
  static async createPaymentRequest(req, res, next) {
    try {
      const userId = req.user.id;
      const paymentData = { ...req.body, userId };

      const paymentRequest = await paymentModel.createPaymentRequest(paymentData);

      res.status(201).json({
        success: true,
        message: 'Payment request created successfully',
        data: {
          paymentRequest: {
            id: paymentRequest.id,
            uuid: paymentRequest.uuid,
            requestId: paymentRequest.request_id,
            projectId: paymentRequest.project_id,
            requestDate: paymentRequest.request_date,
            totalAmount: paymentRequest.total_amount,
            status: paymentRequest.status,
            notes: paymentRequest.notes,
            createdAt: paymentRequest.created_at
          }
        }
      });
    } catch (error) {
      if (error.message.includes('not found') || 
          error.message.includes('access denied') ||
          error.message.includes('already exists')) {
        return res.status(error.message.includes('already exists') ? 409 : 404).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Get Payment Requests
   * Returns payment requests with pagination and filters
   */
  static async getPaymentRequests(req, res, next) {
    try {
      const userId = req.user.id;
      const { 
        page, 
        limit, 
        projectId, 
        status, 
        startDate, 
        endDate 
      } = req.query;
      
      const filters = { userId };
      if (projectId) filters.projectId = parseInt(projectId);
      if (status) filters.status = status;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      const result = await paymentModel.getPaymentRequests(
        filters, 
        { page: parseInt(page), limit: parseInt(limit) }
      );

      res.json({
        success: true,
        message: 'Payment requests retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Payment Request by ID
   * Returns specific payment request with workers details
   */
  static async getPaymentRequestById(req, res, next) {
    try {
      const userId = req.user.id;
      const { paymentRequestId } = req.params;

      const result = await paymentModel.getPaymentRequestWithWorkers(
        parseInt(paymentRequestId), 
        userId
      );

      res.json({
        success: true,
        message: 'Payment request retrieved successfully',
        data: {
          paymentRequest: {
            id: result.paymentRequest.id,
            uuid: result.paymentRequest.uuid,
            requestId: result.paymentRequest.request_id,
            projectId: result.paymentRequest.project_id,
            requestDate: result.paymentRequest.request_date,
            totalAmount: result.paymentRequest.total_amount,
            status: result.paymentRequest.status,
            notes: result.paymentRequest.notes,
            approvedBy: result.paymentRequest.approved_by,
            approvedAt: result.paymentRequest.approved_at,
            rejectionReason: result.paymentRequest.rejection_reason,
            createdAt: result.paymentRequest.created_at,
            updatedAt: result.paymentRequest.updated_at
          },
          workers: result.workers.map(worker => ({
            id: worker.id,
            workerId: worker.worker_id,
            workerName: worker.worker_name,
            position: worker.position,
            daysWorked: worker.days_worked,
            allowancePerDay: worker.allowance_per_day,
            totalAmount: worker.total_amount
          }))
        }
      });
    } catch (error) {
      if (error.message.includes('not found') || 
          error.message.includes('access denied')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Approve Payment Request
   * Approves a pending payment request
   */
  static async approvePaymentRequest(req, res, next) {
    try {
      const userId = req.user.id;
      const { requestId } = req.body;

      const updatedRequest = await paymentModel.approvePaymentRequest(
        requestId, 
        userId
      );

      res.json({
        success: true,
        message: 'Payment request approved successfully',
        data: {
          paymentRequest: {
            id: updatedRequest.id,
            requestId: updatedRequest.request_id,
            status: updatedRequest.status,
            approvedBy: updatedRequest.approved_by,
            approvedAt: updatedRequest.approved_at,
            totalAmount: updatedRequest.total_amount
          }
        }
      });
    } catch (error) {
      if (error.message.includes('not found') || 
          error.message.includes('Only pending')) {
        return res.status(error.message.includes('not found') ? 404 : 400).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Reject Payment Request
   * Rejects a pending payment request with reason
   */
  static async rejectPaymentRequest(req, res, next) {
    try {
      const userId = req.user.id;
      const { requestId, reason } = req.body;

      const updatedRequest = await paymentModel.rejectPaymentRequest(
        requestId, 
        userId,
        reason
      );

      res.json({
        success: true,
        message: 'Payment request rejected successfully',
        data: {
          paymentRequest: {
            id: updatedRequest.id,
            requestId: updatedRequest.request_id,
            status: updatedRequest.status,
            rejectedBy: updatedRequest.approved_by,
            rejectedAt: updatedRequest.approved_at,
            rejectionReason: updatedRequest.rejection_reason,
            totalAmount: updatedRequest.total_amount
          }
        }
      });
    } catch (error) {
      if (error.message.includes('not found') || 
          error.message.includes('Only pending')) {
        return res.status(error.message.includes('not found') ? 404 : 400).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Process Payments
   * Processes multiple approved payment requests
   */
  static async processPayments(req, res, next) {
    try {
      const userId = req.user.id;
      const { paymentIds } = req.body;

      if (!Array.isArray(paymentIds) || paymentIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Payment IDs array is required and cannot be empty'
        });
      }

      const result = await paymentModel.processPayments(paymentIds, userId);

      res.json({
        success: true,
        message: 'Payments processed successfully',
        data: {
          processedCount: result.count,
          totalAmount: result.totalAmount,
          processedPayments: result.processedPayments.map(payment => ({
            id: payment.id,
            requestId: payment.request_id,
            status: payment.status,
            totalAmount: payment.total_amount
          }))
        }
      });
    } catch (error) {
      if (error.message.includes('not found') || 
          error.message.includes('Access denied') ||
          error.message.includes('not approved')) {
        return res.status(error.message.includes('not found') ? 404 : 400).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Delete Payment Request
   * Deletes a pending payment request
   */
  static async deletePaymentRequest(req, res, next) {
    try {
      const userId = req.user.id;
      const { paymentRequestId } = req.params;

      const deleted = await paymentModel.deletePaymentRequest(
        parseInt(paymentRequestId), 
        userId
      );

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Payment request not found'
        });
      }

      res.json({
        success: true,
        message: 'Payment request deleted successfully'
      });
    } catch (error) {
      if (error.message.includes('not found') || 
          error.message.includes('access denied') ||
          error.message.includes('Only pending')) {
        return res.status(error.message.includes('Only pending') ? 400 : 404).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Get Payment Statistics
   * Returns payment statistics with filters
   */
  static async getPaymentStats(req, res, next) {
    try {
      const userId = req.user.id;
      const { 
        projectId, 
        startDate, 
        endDate 
      } = req.query;
      
      const filters = { userId };
      if (projectId) filters.projectId = parseInt(projectId);
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      const stats = await paymentModel.getPaymentStats(filters);

      res.json({
        success: true,
        message: 'Payment statistics retrieved successfully',
        data: {
          stats
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Approved Payment Requests
   * Returns only approved payment requests ready for processing
   */
  static async getApprovedPaymentRequests(req, res, next) {
    try {
      const userId = req.user.id;
      const { page, limit, projectId } = req.query;
      
      const filters = { userId, status: 'Approved' };
      if (projectId) filters.projectId = parseInt(projectId);

      const result = await paymentModel.getPaymentRequests(
        filters, 
        { page: parseInt(page), limit: parseInt(limit) }
      );

      res.json({
        success: true,
        message: 'Approved payment requests retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = PaymentController;