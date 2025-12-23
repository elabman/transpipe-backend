const request = require('supertest');

// Mock the database for tests
jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  transaction: jest.fn()
}));

const app = require('../src/server');
const db = require('../src/config/database');

describe('Payment Management', () => {
  // Generate valid JWT token for tests
  const jwt = require('jsonwebtoken');
  const mockToken = jwt.sign(
    { id: 1, email: 'test@example.com', role: 'user' },
    process.env.JWT_SECRET || 'test_jwt_secret_key'
  );
  
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockReset();
    db.transaction.mockReset();
  });

  describe('POST /api/v1/payments/request', () => {
    it('should create payment request successfully', async () => {
      const paymentData = {
        requestId: 'PAY-2024-001',
        projectId: 1,
        requestDate: '2024-01-15',
        workers: [
          {
            workerId: 1,
            daysWorked: 20,
            allowancePerDay: 150.00,
            totalAmount: 3000.00
          },
          {
            workerId: 2,
            daysWorked: 18,
            allowancePerDay: 120.00,
            totalAmount: 2160.00
          }
        ],
        notes: 'Monthly payment request'
      };

      // Mock transaction
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ 
            rows: [{ 
              id: 1,
              uuid: 'payment-uuid',
              request_id: paymentData.requestId,
              project_id: paymentData.projectId,
              request_date: paymentData.requestDate,
              total_amount: 5160.00,
              status: 'Pending',
              notes: paymentData.notes,
              created_at: new Date()
            }] 
          }) // Create payment request
          .mockResolvedValueOnce({ rows: [] }) // Create worker 1
          .mockResolvedValueOnce({ rows: [] }) // Create worker 2
      };

      // Mock user exists, project exists, no existing request, workers exist, transaction
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // User exists
        .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 1 }] }) // Project exists
        .mockResolvedValueOnce({ rows: [] }) // No existing request
        .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 1 }] }) // Worker 1 exists
        .mockResolvedValueOnce({ rows: [{ id: 2, user_id: 1 }] }); // Worker 2 exists

      db.transaction.mockImplementation(async (callback) => {
        return await callback(mockClient);
      });

      const response = await request(app)
        .post('/api/v1/payments/request')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(paymentData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Payment request created successfully');
      expect(response.body.data.paymentRequest.requestId).toBe(paymentData.requestId);
      expect(response.body.data.paymentRequest.totalAmount).toBe(5160);
    });

    it('should return error for duplicate request ID', async () => {
      const paymentData = {
        requestId: 'PAY-2024-001',
        projectId: 1,
        requestDate: '2024-01-15',
        workers: [{ workerId: 1, daysWorked: 20, allowancePerDay: 150.00 }]
      };

      // Mock user exists, project exists, existing request
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // User exists
        .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 1 }] }) // Project exists
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Existing request

      const response = await request(app)
        .post('/api/v1/payments/request')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(paymentData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Payment request with this ID already exists');
    });

    it('should require authentication', async () => {
      const paymentData = {
        requestId: 'PAY-2024-001',
        projectId: 1,
        requestDate: '2024-01-15',
        workers: [{ workerId: 1, daysWorked: 20, allowancePerDay: 150.00 }]
      };

      const response = await request(app)
        .post('/api/v1/payments/request')
        .send(paymentData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access token required');
    });

    it('should return validation error for invalid data', async () => {
      const invalidData = {
        requestId: '', // Empty request ID
        workers: [] // Empty workers array
      };

      const response = await request(app)
        .post('/api/v1/payments/request')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });
  });

  describe('GET /api/v1/payments/requests', () => {
    it('should get payment requests successfully', async () => {
      const mockPaymentRequests = [
        {
          id: 1,
          request_id: 'PAY-2024-001',
          project_id: 1,
          total_amount: '5000.00',
          status: 'Pending',
          project_name: 'Test Project',
          requester_name: 'John Doe',
          approver_name: null
        }
      ];

      // Mock payment requests query and count
      db.query
        .mockResolvedValueOnce({ rows: mockPaymentRequests }) // Get payment requests
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }); // Count requests

      const response = await request(app)
        .get('/api/v1/payments/requests')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Payment requests retrieved successfully');
      expect(response.body.data.paymentRequests).toHaveLength(1);
      expect(response.body.data.pagination.totalCount).toBe(1);
    });
  });

  describe('GET /api/v1/payments/requests/:paymentRequestId', () => {
    it('should get payment request by ID successfully', async () => {
      const mockPaymentRequest = {
        id: 1,
        uuid: 'payment-uuid',
        request_id: 'PAY-2024-001',
        user_id: 1,
        project_id: 1,
        request_date: '2024-01-15',
        total_amount: '5000.00',
        status: 'Pending',
        notes: 'Test payment',
        created_at: new Date(),
        updated_at: new Date()
      };

      const mockWorkers = [
        {
          id: 1,
          worker_id: 1,
          worker_name: 'John Worker',
          position: 'Engineer',
          days_worked: 20,
          allowance_per_day: '150.00',
          total_amount: '3000.00'
        }
      ];

      db.query
        .mockResolvedValueOnce({ rows: [mockPaymentRequest] }) // Payment request exists
        .mockResolvedValueOnce({ rows: mockWorkers }); // Workers for payment request

      const response = await request(app)
        .get('/api/v1/payments/requests/1')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Payment request retrieved successfully');
      expect(response.body.data.paymentRequest.requestId).toBe('PAY-2024-001');
      expect(response.body.data.workers).toHaveLength(1);
    });

    it('should return error for non-existent payment request', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/v1/payments/requests/999')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Payment request not found or access denied');
    });
  });

  describe('POST /api/v1/payments/approve', () => {
    it('should approve payment request successfully', async () => {
      const approvalData = {
        requestId: 'PAY-2024-001'
      };

      const mockPaymentRequest = {
        id: 1,
        request_id: approvalData.requestId,
        status: 'Pending',
        total_amount: '5000.00'
      };

      const mockUpdatedRequest = {
        id: 1,
        request_id: approvalData.requestId,
        status: 'Approved',
        approved_by: 1,
        approved_at: new Date(),
        total_amount: '5000.00'
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockPaymentRequest] }) // Request exists
        .mockResolvedValueOnce({ rows: [mockUpdatedRequest] }); // Update request

      const response = await request(app)
        .post('/api/v1/payments/approve')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(approvalData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Payment request approved successfully');
      expect(response.body.data.paymentRequest.status).toBe('Approved');
    });

    it('should return error for non-pending request', async () => {
      const approvalData = {
        requestId: 'PAY-2024-001'
      };

      const mockPaymentRequest = {
        id: 1,
        request_id: approvalData.requestId,
        status: 'Approved' // Already approved
      };

      db.query.mockResolvedValueOnce({ rows: [mockPaymentRequest] });

      const response = await request(app)
        .post('/api/v1/payments/approve')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(approvalData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Only pending payment requests can be approved');
    });
  });

  describe('POST /api/v1/payments/reject', () => {
    it('should reject payment request successfully', async () => {
      const rejectionData = {
        requestId: 'PAY-2024-001',
        reason: 'Insufficient documentation'
      };

      const mockPaymentRequest = {
        id: 1,
        request_id: rejectionData.requestId,
        status: 'Pending',
        total_amount: '5000.00'
      };

      const mockUpdatedRequest = {
        id: 1,
        request_id: rejectionData.requestId,
        status: 'Rejected',
        approved_by: 1,
        approved_at: new Date(),
        rejection_reason: rejectionData.reason,
        total_amount: '5000.00'
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockPaymentRequest] }) // Request exists
        .mockResolvedValueOnce({ rows: [mockUpdatedRequest] }); // Update request

      const response = await request(app)
        .post('/api/v1/payments/reject')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(rejectionData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Payment request rejected successfully');
      expect(response.body.data.paymentRequest.status).toBe('Rejected');
      expect(response.body.data.paymentRequest.rejectionReason).toBe(rejectionData.reason);
    });
  });

  describe('POST /api/v1/payments/process', () => {
    it('should process payments successfully', async () => {
      const processData = {
        paymentIds: [1, 2]
      };

      const mockPaymentRequests = [
        { id: 1, user_id: 1, status: 'Approved', total_amount: '3000.00', request_id: 'PAY-001' },
        { id: 2, user_id: 1, status: 'Approved', total_amount: '2000.00', request_id: 'PAY-002' }
      ];

      const mockProcessedRequests = [
        { id: 1, request_id: 'PAY-001', status: 'Processed', total_amount: '3000.00' },
        { id: 2, request_id: 'PAY-002', status: 'Processed', total_amount: '2000.00' }
      ];

      db.query
        .mockResolvedValueOnce({ rows: [mockPaymentRequests[0]] }) // Payment 1 exists
        .mockResolvedValueOnce({ rows: [mockPaymentRequests[1]] }) // Payment 2 exists
        .mockResolvedValueOnce({ rows: [mockProcessedRequests[0]] }) // Process payment 1
        .mockResolvedValueOnce({ rows: [mockProcessedRequests[1]] }); // Process payment 2

      const response = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(processData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Payments processed successfully');
      expect(response.body.data.processedCount).toBe(2);
      expect(response.body.data.totalAmount).toBe(5000);
    });

    it('should return error for empty payment IDs', async () => {
      const processData = {
        paymentIds: []
      };

      const response = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(processData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });
  });

  describe('DELETE /api/v1/payments/requests/:paymentRequestId', () => {
    it('should delete payment request successfully', async () => {
      const mockPaymentRequest = { 
        id: 1, 
        user_id: 1, 
        status: 'Pending',
        request_id: 'PAY-2024-001'
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockPaymentRequest] }) // Payment request exists
        .mockResolvedValueOnce({ rowCount: 1 }); // Delete payment request

      const response = await request(app)
        .delete('/api/v1/payments/requests/1')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Payment request deleted successfully');
    });

    it('should return error for non-pending request', async () => {
      const mockPaymentRequest = { 
        id: 1, 
        user_id: 1, 
        status: 'Approved' // Cannot delete approved request
      };

      db.query.mockResolvedValueOnce({ rows: [mockPaymentRequest] });

      const response = await request(app)
        .delete('/api/v1/payments/requests/1')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Only pending payment requests can be deleted');
    });
  });

  describe('GET /api/v1/payments/stats', () => {
    it('should get payment statistics successfully', async () => {
      // Mock statistics queries
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '10' }] }) // Total requests
        .mockResolvedValueOnce({ rows: [{ count: '3' }] }) // Pending count
        .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // Approved count
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }) // Rejected count
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }) // Processed count
        .mockResolvedValueOnce({ rows: [{ sum: '15000.00' }] }); // Total amount

      const response = await request(app)
        .get('/api/v1/payments/stats')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Payment statistics retrieved successfully');
      expect(response.body.data.stats.totalRequests).toBe(10);
      expect(response.body.data.stats.pendingRequests).toBe(3);
      expect(response.body.data.stats.totalApprovedAmount).toBe(15000);
    });
  });

  describe('GET /api/v1/payments/requests/approved', () => {
    it('should get approved payment requests successfully', async () => {
      const mockApprovedRequests = [
        {
          id: 1,
          request_id: 'PAY-2024-001',
          status: 'Approved',
          total_amount: '5000.00',
          project_name: 'Test Project',
          requester_name: 'John Doe'
        }
      ];

      // Mock approved requests query and count
      db.query
        .mockResolvedValueOnce({ rows: mockApprovedRequests }) // Get approved requests
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }); // Count requests

      const response = await request(app)
        .get('/api/v1/payments/requests/approved')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Approved payment requests retrieved successfully');
      expect(response.body.data.paymentRequests).toHaveLength(1);
      expect(response.body.data.paymentRequests[0].status).toBe('Approved');
    });
  });
});