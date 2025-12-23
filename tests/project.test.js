const request = require('supertest');

// Mock the database for tests
jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  transaction: jest.fn()
}));

const app = require('../src/server');
const db = require('../src/config/database');

describe('Project Management', () => {
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

  describe('POST /api/v1/projects', () => {
    it('should create project successfully', async () => {
      const projectData = {
        name: 'Office Building Construction',
        description: 'Modern office building',
        client: 'ABC Corporation',
        category: 'Construction',
        startDate: '2024-01-15',
        endDate: '2024-12-31',
        budget: 500000.00,
        positions: ['Engineer', 'Supervisor']
      };

      // Mock user exists and project creation
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // User exists
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: 1,
            uuid: 'project-uuid',
            name: projectData.name,
            description: projectData.description,
            client: projectData.client,
            category: projectData.category,
            start_date: projectData.startDate,
            end_date: projectData.endDate,
            budget: projectData.budget,
            status: 'Active',
            created_at: new Date()
          }] 
        }) // Create project
        .mockResolvedValueOnce({ rows: [] }) // Position check 1
        .mockResolvedValueOnce({ rows: [{ id: 1, default_daily_rate: 100 }] }) // Create position 1
        .mockResolvedValueOnce({ rows: [] }) // Link position 1
        .mockResolvedValueOnce({ rows: [] }) // Position check 2
        .mockResolvedValueOnce({ rows: [{ id: 2, default_daily_rate: 120 }] }) // Create position 2
        .mockResolvedValueOnce({ rows: [] }); // Link position 2

      const response = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(projectData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Project created successfully');
      expect(response.body.data.project.name).toBe(projectData.name);
      expect(response.body.data.project.category).toBe(projectData.category);
    });

    it('should require authentication', async () => {
      const projectData = {
        name: 'Test Project',
        client: 'Test Client',
        category: 'Construction',
        startDate: '2024-01-15',
        endDate: '2024-12-31',
        budget: 100000
      };

      const response = await request(app)
        .post('/api/v1/projects')
        .send(projectData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access token required');
    });

    it('should return validation error for invalid data', async () => {
      const invalidData = {
        name: 'A', // Too short
        budget: -1000 // Negative budget
      };

      const response = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });
  });

  describe('GET /api/v1/projects', () => {
    it('should get user projects successfully', async () => {
      const mockProjects = [
        {
          id: 1,
          name: 'Project 1',
          category: 'Construction',
          status: 'Active',
          owner_name: 'John Doe',
          owner_email: 'john@example.com'
        }
      ];

      // Mock projects query and count
      db.query
        .mockResolvedValueOnce({ rows: mockProjects }) // Get projects
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }); // Count projects

      const response = await request(app)
        .get('/api/v1/projects')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Projects retrieved successfully');
      expect(response.body.data.projects).toHaveLength(1);
      expect(response.body.data.pagination.totalCount).toBe(1);
    });
  });

  describe('GET /api/v1/projects/:projectId', () => {
    it('should get project by ID successfully', async () => {
      const mockProject = {
        id: 1,
        uuid: 'project-uuid',
        user_id: 1,
        name: 'Test Project',
        description: 'Test Description',
        client: 'Test Client',
        category: 'Construction',
        start_date: '2024-01-15',
        end_date: '2024-12-31',
        budget: 100000,
        status: 'Active',
        created_at: new Date(),
        updated_at: new Date()
      };

      db.query.mockResolvedValueOnce({ rows: [mockProject] });

      const response = await request(app)
        .get('/api/v1/projects/1')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Project retrieved successfully');
      expect(response.body.data.project.name).toBe(mockProject.name);
    });

    it('should return error for non-existent project', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/v1/projects/999')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Project not found');
    });
  });

  describe('PUT /api/v1/projects/:projectId', () => {
    it('should update project successfully', async () => {
      const updateData = {
        name: 'Updated Project Name',
        budget: 150000
      };

      const mockProject = { id: 1, user_id: 1 };
      const mockUpdatedProject = {
        id: 1,
        uuid: 'project-uuid',
        name: updateData.name,
        budget: updateData.budget,
        updated_at: new Date()
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockProject] }) // Project exists
        .mockResolvedValueOnce({ rows: [mockUpdatedProject] }); // Update project

      const response = await request(app)
        .put('/api/v1/projects/1')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Project updated successfully');
      expect(response.body.data.project.name).toBe(updateData.name);
    });
  });

  describe('POST /api/v1/projects/positions', () => {
    it('should create position successfully', async () => {
      const positionData = {
        name: 'Senior Engineer',
        description: 'Senior level position',
        defaultDailyRate: 150.00
      };

      // Mock user exists, no existing position, create position
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // User exists
        .mockResolvedValueOnce({ rows: [] }) // No existing position
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: 1,
            uuid: 'position-uuid',
            name: positionData.name,
            description: positionData.description,
            default_daily_rate: positionData.defaultDailyRate,
            created_at: new Date()
          }] 
        }); // Create position

      const response = await request(app)
        .post('/api/v1/projects/positions')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(positionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Position created successfully');
      expect(response.body.data.position.name).toBe(positionData.name);
    });
  });

  describe('POST /api/v1/projects/materials/request', () => {
    it('should create material request successfully', async () => {
      const materialData = {
        requestId: 'MAT-2024-001',
        projectId: 1,
        materialName: 'Cement Bags',
        quantity: 100,
        unit: 'bags',
        estimatedCost: 5000.00,
        urgency: 'High',
        description: 'High quality cement'
      };

      // Mock user exists, project exists, no existing request, create request
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // User exists
        .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 1 }] }) // Project exists
        .mockResolvedValueOnce({ rows: [] }) // No existing request
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: 1,
            uuid: 'material-uuid',
            request_id: materialData.requestId,
            project_id: materialData.projectId,
            material_name: materialData.materialName,
            quantity: materialData.quantity,
            unit: materialData.unit,
            estimated_cost: materialData.estimatedCost,
            urgency: materialData.urgency,
            description: materialData.description,
            status: 'Pending',
            created_at: new Date()
          }] 
        }); // Create material request

      const response = await request(app)
        .post('/api/v1/projects/materials/request')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(materialData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Material request created successfully');
      expect(response.body.data.materialRequest.materialName).toBe(materialData.materialName);
    });
  });

  describe('POST /api/v1/projects/materials/approve', () => {
    it('should approve material request successfully', async () => {
      const approvalData = {
        requestId: 'MAT-2024-001'
      };

      const mockRequest = {
        id: 1,
        request_id: approvalData.requestId,
        status: 'Pending'
      };

      const mockUpdatedRequest = {
        id: 1,
        request_id: approvalData.requestId,
        status: 'Approved',
        approved_by: 1,
        approved_at: new Date()
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockRequest] }) // Request exists
        .mockResolvedValueOnce({ rows: [mockUpdatedRequest] }); // Update request

      const response = await request(app)
        .post('/api/v1/projects/materials/approve')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(approvalData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Material request approved successfully');
      expect(response.body.data.materialRequest.status).toBe('Approved');
    });
  });
});