const request = require('supertest');

// Mock the database for tests
jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  transaction: jest.fn()
}));

const app = require('../src/server');
const db = require('../src/config/database');

describe('User Management', () => {
  // Generate valid JWT token for tests using the test secret
  const jwt = require('jsonwebtoken');
  const mockToken = jwt.sign(
    { id: 1, email: 'test@example.com', role: 'user' },
    process.env.JWT_SECRET || 'test_jwt_secret_key'
  );
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset all mocks to ensure clean state
    db.query.mockReset();
    db.transaction.mockReset();
  });

  describe('POST /api/v1/users/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '+1234567890',
        password: 'SecurePass123',
        category: 'Individual'
      };

      // Mock database responses
      db.query
        .mockResolvedValueOnce({ rows: [] }) // Check existing user
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: 1, 
            uuid: 'test-uuid', 
            name: userData.name,
            email: userData.email,
            phone: userData.phone,
            category: userData.category,
            role: 'user',
            created_at: new Date()
          }] 
        }); // Create user

      const response = await request(app)
        .post('/api/v1/users/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.token).toBeDefined();
    });

    it('should return validation error for invalid email', async () => {
      const userData = {
        name: 'John Doe',
        email: 'invalid-email',
        phone: '+1234567890',
        password: 'SecurePass123',
        category: 'Individual'
      };

      const response = await request(app)
        .post('/api/v1/users/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should return error for duplicate email', async () => {
      const userData = {
        name: 'John Doe',
        email: 'existing@example.com',
        phone: '+1234567890',
        password: 'SecurePass123',
        category: 'Individual'
      };

      // Mock existing user found
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const response = await request(app)
        .post('/api/v1/users/register')
        .send(userData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User with this email already exists');
    });
  });

  describe('POST /api/v1/users/login', () => {
    it('should login user successfully', async () => {
      const loginData = {
        email: 'john.doe@example.com',
        password: 'SecurePass123'
      };

      // Mock user found with valid password
      db.query.mockResolvedValueOnce({ 
        rows: [{ 
          id: 1,
          uuid: 'test-uuid',
          name: 'John Doe',
          email: loginData.email,
          phone: '+1234567890',
          password_hash: '$2a$12$hashedpassword',
          category: 'Individual',
          role: 'user',
          is_active: true
        }] 
      });

      // Mock bcrypt compare to return true
      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/v1/users/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.data.user.email).toBe(loginData.email);
      expect(response.body.data.token).toBeDefined();
    });

    it('should return validation error for missing credentials', async () => {
      const response = await request(app)
        .post('/api/v1/users/login')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should return error for invalid credentials', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'wrongpassword'
      };

      // Mock no user found
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/v1/users/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid email or password');
    });
  });

  describe('POST /api/v1/users/workers', () => {
    it('should create worker successfully', async () => {
      const workerData = {
        userId: 1,
        fullname: 'Jane Smith',
        phone: '+1987654321',
        email: 'jane.smith@example.com',
        position: 'Engineer',
        bankAccount: '123456789',
        idPassport: 'ID123456',
        salary: 5000.00
      };

      // Mock user exists and worker creation
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // User exists
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: 1,
            uuid: 'worker-uuid',
            fullname: workerData.fullname,
            phone: workerData.phone,
            email: workerData.email,
            position: workerData.position,
            salary: workerData.salary,
            created_at: new Date()
          }] 
        }); // Create worker

      const response = await request(app)
        .post('/api/v1/users/workers')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(workerData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Worker created successfully');
      expect(response.body.data.worker.fullname).toBe(workerData.fullname);
      expect(response.body.data.worker.position).toBe(workerData.position);
    });

    it('should return error for non-existent user', async () => {
      const workerData = {
        userId: 999,
        fullname: 'Jane Smith',
        phone: '+1987654321',
        position: 'Engineer',
        idPassport: 'ID123456',
        salary: 5000.00
      };

      // Mock user not found
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/v1/users/workers')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(workerData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User not found');
    });

    it('should require authentication', async () => {
      const workerData = {
        userId: 1,
        fullname: 'Jane Smith',
        phone: '+1987654321',
        position: 'Engineer',
        idPassport: 'ID123456',
        salary: 5000.00
      };

      const response = await request(app)
        .post('/api/v1/users/workers')
        .send(workerData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access token required');
    });
  });

  describe('POST /api/v1/users/workers/card', () => {
    it('should create worker with card successfully', async () => {
      const workerCardData = {
        cardId: 'CARD123',
        name: 'Mike Johnson',
        email: 'mike.johnson@example.com',
        phone: '+1555666777',
        positionId: 1,
        projectId: 1,
        nationalId: 'NAT123456',
        address: '123 Main St'
      };

      // Clear all previous mocks to avoid interference
      jest.clearAllMocks();

      // Mock position and project exist, card doesn't exist, worker creation
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Engineer' }] }) // Position exists
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Project' }] }) // Project exists
        .mockResolvedValueOnce({ rows: [] }); // Card doesn't exist

      // Mock transaction
      db.transaction.mockImplementation(async (callback) => {
        const mockClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ 
              rows: [{ 
                id: 1,
                uuid: 'worker-uuid',
                card_id: workerCardData.cardId,
                fullname: workerCardData.name,
                phone: workerCardData.phone,
                email: workerCardData.email,
                created_at: new Date()
              }] 
            }) // Create worker
            .mockResolvedValueOnce({ rows: [] }) // Assign to project
        };
        return callback(mockClient);
      });

      const response = await request(app)
        .post('/api/v1/users/workers/card')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(workerCardData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Worker created and assigned to project successfully');
      expect(response.body.data.worker.cardId).toBe(workerCardData.cardId);
    });

    it('should return error for duplicate card ID', async () => {
      const workerCardData = {
        cardId: 'EXISTINGCARD123', // Use alphanumeric only to pass validation
        name: 'Mike Johnson',
        email: 'mike.johnson@example.com',
        phone: '+1555666777',
        positionId: 1,
        projectId: 1,
        nationalId: 'NAT123456'
      };

      // Mock position and project exist, but card already exists
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Engineer' }] }) // Position exists
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Project' }] }) // Project exists
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Card exists

      const response = await request(app)
        .post('/api/v1/users/workers/card')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(workerCardData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Worker with this card ID already exists');
    });
  });

  describe('POST /api/v1/users/sellers', () => {
    it('should create seller successfully', async () => {
      const sellerData = {
        name: 'Alice Seller',
        email: 'alice.seller@example.com',
        phone: '+1444555666',
        password: 'SellerPass123'
      };

      // Clear all previous mocks to avoid interference
      jest.clearAllMocks();

      // Mock seller doesn't exist and creation
      db.query
        .mockResolvedValueOnce({ rows: [] }) // Seller doesn't exist
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: 1,
            uuid: 'seller-uuid',
            name: sellerData.name,
            email: sellerData.email,
            phone: sellerData.phone,
            role: 'seller',
            created_at: new Date()
          }] 
        }); // Create seller

      const response = await request(app)
        .post('/api/v1/users/sellers')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(sellerData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Seller created successfully');
      expect(response.body.data.seller.name).toBe(sellerData.name);
      expect(response.body.data.seller.role).toBe('seller');
    });

    it('should return error for duplicate seller email', async () => {
      const sellerData = {
        name: 'Alice Seller',
        email: 'existing.seller@example.com',
        phone: '+1444555666',
        password: 'SellerPass123'
      };

      // Clear all previous mocks to avoid interference
      jest.clearAllMocks();

      // Mock seller already exists
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const response = await request(app)
        .post('/api/v1/users/sellers')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(sellerData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Seller with this email already exists');
    });

    it('should require authentication', async () => {
      const sellerData = {
        name: 'Alice Seller',
        email: 'alice.seller@example.com',
        phone: '+1444555666',
        password: 'SellerPass123'
      };

      const response = await request(app)
        .post('/api/v1/users/sellers')
        .send(sellerData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access token required');
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('TransPipe Backend is running');
    });
  });
});