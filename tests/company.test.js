const request = require('supertest');

// Mock the database for tests
jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  transaction: jest.fn()
}));

const app = require('../src/server');
const db = require('../src/config/database');

describe('Company Management', () => {
  // Generate valid JWT token for tests
  const jwt = require('jsonwebtoken');
  const mockToken = jwt.sign(
    { id: 1, email: 'test@example.com', role: 'user' },
    process.env.JWT_SECRET || 'test_jwt_secret_key'
  );

  const adminToken = jwt.sign(
    { id: 2, email: 'admin@example.com', role: 'admin' },
    process.env.JWT_SECRET || 'test_jwt_secret_key'
  );
  
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockReset();
    db.transaction.mockReset();
  });

  describe('POST /api/v1/companies/register', () => {
    it('should register company successfully', async () => {
      const companyData = {
        companyName: 'Tech Solutions Ltd',
        registrationNumber: 'REG123456',
        taxId: 'TAX789012',
        address: '123 Business Street, City',
        industry: 'Technology'
      };

      // Mock user exists, no existing company, no existing reg number
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // User exists
        .mockResolvedValueOnce({ rows: [] }) // No existing company
        .mockResolvedValueOnce({ rows: [] }) // No existing reg number
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: 1,
            uuid: 'company-uuid',
            company_name: companyData.companyName,
            registration_number: companyData.registrationNumber,
            tax_id: companyData.taxId,
            address: companyData.address,
            industry: companyData.industry,
            created_at: new Date()
          }] 
        }); // Create company

      const response = await request(app)
        .post('/api/v1/companies/register')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(companyData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Company registered successfully');
      expect(response.body.data.company.companyName).toBe(companyData.companyName);
      expect(response.body.data.company.industry).toBe(companyData.industry);
    });

    it('should return error for duplicate company registration', async () => {
      const companyData = {
        companyName: 'Existing Company',
        industry: 'Construction'
      };

      // Mock user exists but already has a company
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // User exists
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Company exists

      const response = await request(app)
        .post('/api/v1/companies/register')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(companyData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User already has a registered company');
    });

    it('should require authentication', async () => {
      const companyData = {
        companyName: 'Test Company',
        industry: 'Technology'
      };

      const response = await request(app)
        .post('/api/v1/companies/register')
        .send(companyData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access token required');
    });

    it('should return validation error for missing required fields', async () => {
      const invalidData = {
        companyName: 'A' // Too short
      };

      const response = await request(app)
        .post('/api/v1/companies/register')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });
  });

  describe('GET /api/v1/companies/profile', () => {
    it('should get company profile successfully', async () => {
      const mockCompany = {
        id: 1,
        uuid: 'company-uuid',
        company_name: 'Tech Solutions Ltd',
        registration_number: 'REG123456',
        tax_id: 'TAX789012',
        address: '123 Business Street',
        industry: 'Technology',
        owner_name: 'John Doe',
        owner_email: 'john@example.com',
        owner_phone: '+1234567890',
        created_at: new Date(),
        updated_at: new Date()
      };

      // Mock company exists and get company with owner
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 1 }] }) // Company exists
        .mockResolvedValueOnce({ rows: [mockCompany] }); // Get company with owner

      const response = await request(app)
        .get('/api/v1/companies/profile')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Company profile retrieved successfully');
      expect(response.body.data.company.companyName).toBe(mockCompany.company_name);
      expect(response.body.data.company.owner.name).toBe(mockCompany.owner_name);
    });

    it('should return error when company not found', async () => {
      // Mock no company found
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/v1/companies/profile')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Company not found. Please register your company first.');
    });
  });

  describe('PUT /api/v1/companies/:companyId', () => {
    it('should update company successfully', async () => {
      const updateData = {
        companyName: 'Updated Company Name',
        address: 'New Address',
        industry: 'Updated Industry'
      };

      const mockUpdatedCompany = {
        id: 1,
        uuid: 'company-uuid',
        company_name: updateData.companyName,
        address: updateData.address,
        industry: updateData.industry,
        updated_at: new Date()
      };

      // Mock company exists and update
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 1 }] }) // Company exists
        .mockResolvedValueOnce({ rows: [mockUpdatedCompany] }); // Update company

      const response = await request(app)
        .put('/api/v1/companies/1')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Company updated successfully');
      expect(response.body.data.company.companyName).toBe(updateData.companyName);
    });

    it('should return error for non-existent company', async () => {
      const updateData = {
        companyName: 'Updated Name'
      };

      // Mock company not found
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .put('/api/v1/companies/999')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(updateData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Company not found');
    });
  });

  describe('GET /api/v1/companies/:companyId/stats', () => {
    it('should get company statistics successfully', async () => {
      const mockStats = {
        id: 1,
        company_name: 'Tech Solutions Ltd',
        user_id: 1
      };

      // Mock company exists and stats queries
      db.query
        .mockResolvedValueOnce({ rows: [mockStats] }) // Company exists
        .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // Worker count
        .mockResolvedValueOnce({ rows: [{ count: '3' }] }) // Project count
        .mockResolvedValueOnce({ rows: [{ count: '2' }] }); // Active project count

      const response = await request(app)
        .get('/api/v1/companies/1/stats')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Company statistics retrieved successfully');
      expect(response.body.data.stats.totalWorkers).toBe(5);
      expect(response.body.data.stats.totalProjects).toBe(3);
      expect(response.body.data.stats.activeProjects).toBe(2);
    });
  });

  describe('GET /api/v1/companies/:companyId/public', () => {
    it('should get public company information', async () => {
      const mockCompany = {
        id: 1,
        company_name: 'Public Company',
        industry: 'Technology',
        address: '123 Public Street',
        registration_number: 'REG123456'
      };

      // Mock company exists
      db.query.mockResolvedValueOnce({ rows: [mockCompany] });

      const response = await request(app)
        .get('/api/v1/companies/1/public')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Company information retrieved successfully');
      expect(response.body.data.company.companyName).toBe(mockCompany.company_name);
      expect(response.body.data.company.industry).toBe(mockCompany.industry);
    });

    it('should return error for non-existent company', async () => {
      // Mock company not found
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/v1/companies/999/public')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Company not found');
    });
  });

  describe('GET /api/v1/companies', () => {
    it('should require admin role', async () => {
      const response = await request(app)
        .get('/api/v1/companies')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Insufficient permissions');
    });

    it('should get companies list for admin', async () => {
      const mockCompanies = [
        {
          id: 1,
          company_name: 'Company 1',
          industry: 'Technology',
          owner_name: 'Owner 1',
          owner_email: 'owner1@example.com'
        }
      ];

      // Mock companies query and count
      db.query
        .mockResolvedValueOnce({ rows: mockCompanies }) // Get companies
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }); // Count companies

      const response = await request(app)
        .get('/api/v1/companies')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Companies retrieved successfully');
      expect(response.body.data.companies).toHaveLength(1);
      expect(response.body.data.pagination.totalCount).toBe(1);
    });
  });
});