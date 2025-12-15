const request = require('supertest');

// Mock the database for tests
jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  transaction: jest.fn()
}));

const app = require('../src/server');

const db = require('../src/config/database');

describe('User Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/users/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        name: 'Abayo sincere',
        email: 'abayo@gmail.com',
        phone: '+250788888888',
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
        name: 'abayo sincere',
        email: 'invalid-email',
        phone: '+250788888888',
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
  });

  describe('POST /api/v1/users/login', () => {
    it('should return validation error for missing credentials', async () => {
      const response = await request(app)
        .post('/api/v1/users/login')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
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