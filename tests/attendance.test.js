const request = require('supertest');

// Mock the database for tests
jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  transaction: jest.fn()
}));

const app = require('../src/server');
const db = require('../src/config/database');

describe('Attendance Management', () => {
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

  describe('POST /api/v1/attendance', () => {
    it('should create attendance successfully', async () => {
      const attendanceData = {
        workerId: 1,
        projectId: 1,
        date: '2024-01-15',
        checkIn: '08:00',
        checkOut: '17:00',
        status: 'Present'
      };

      // Mock user exists, worker exists, project exists, no existing attendance, create attendance
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // User exists
        .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 1 }] }) // Worker exists
        .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 1 }] }) // Project exists
        .mockResolvedValueOnce({ rows: [] }) // No existing attendance
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: 1,
            uuid: 'attendance-uuid',
            user_id: 1,
            worker_id: attendanceData.workerId,
            project_id: attendanceData.projectId,
            date: attendanceData.date,
            check_in: attendanceData.checkIn,
            check_out: attendanceData.checkOut,
            status: attendanceData.status,
            created_at: new Date()
          }] 
        }); // Create attendance

      const response = await request(app)
        .post('/api/v1/attendance')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(attendanceData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Attendance record created successfully');
      expect(response.body.data.attendance.workerId).toBe(attendanceData.workerId);
      expect(response.body.data.attendance.status).toBe(attendanceData.status);
    });

    it('should return error for duplicate attendance', async () => {
      const attendanceData = {
        workerId: 1,
        projectId: 1,
        date: '2024-01-15',
        status: 'Present'
      };

      // Mock user exists, worker exists, project exists, existing attendance
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // User exists
        .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 1 }] }) // Worker exists
        .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 1 }] }) // Project exists
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Existing attendance

      const response = await request(app)
        .post('/api/v1/attendance')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(attendanceData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Attendance record already exists for this worker on this date');
    });

    it('should require authentication', async () => {
      const attendanceData = {
        workerId: 1,
        projectId: 1,
        date: '2024-01-15',
        status: 'Present'
      };

      const response = await request(app)
        .post('/api/v1/attendance')
        .send(attendanceData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access token required');
    });

    it('should return validation error for invalid data', async () => {
      const invalidData = {
        workerId: 'invalid', // Should be number
        status: 'InvalidStatus' // Invalid status
      };

      const response = await request(app)
        .post('/api/v1/attendance')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });
  });

  describe('POST /api/v1/attendance/mark-rating', () => {
    it('should mark attendance with rating successfully', async () => {
      const ratingData = {
        workerId: 1,
        projectId: 1,
        date: '2024-01-15',
        attendance: 'Present',
        rating: 4,
        comments: 'Good work'
      };

      // Mock user exists, worker exists, project exists, no existing attendance, create attendance
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // User exists
        .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 1 }] }) // Worker exists
        .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 1 }] }) // Project exists
        .mockResolvedValueOnce({ rows: [] }) // No existing attendance
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: 1,
            uuid: 'attendance-uuid',
            user_id: 1,
            worker_id: ratingData.workerId,
            project_id: ratingData.projectId,
            date: ratingData.date,
            status: ratingData.attendance,
            rating: ratingData.rating,
            comments: ratingData.comments,
            created_at: new Date(),
            updated_at: new Date()
          }] 
        }); // Create attendance with rating

      const response = await request(app)
        .post('/api/v1/attendance/mark-rating')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(ratingData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Attendance marked with rating successfully');
      expect(response.body.data.attendance.rating).toBe(ratingData.rating);
      expect(response.body.data.attendance.comments).toBe(ratingData.comments);
    });

    it('should update existing attendance with rating', async () => {
      const ratingData = {
        workerId: 1,
        projectId: 1,
        date: '2024-01-15',
        attendance: 'Present',
        rating: 5,
        comments: 'Excellent work'
      };

      const existingAttendance = { id: 1, worker_id: 1, project_id: 1, date: '2024-01-15' };

      // Mock user exists, worker exists, project exists, existing attendance, update attendance
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // User exists
        .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 1 }] }) // Worker exists
        .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 1 }] }) // Project exists
        .mockResolvedValueOnce({ rows: [existingAttendance] }) // Existing attendance
        .mockResolvedValueOnce({ 
          rows: [{ 
            ...existingAttendance,
            status: ratingData.attendance,
            rating: ratingData.rating,
            comments: ratingData.comments,
            updated_at: new Date()
          }] 
        }); // Update attendance

      const response = await request(app)
        .post('/api/v1/attendance/mark-rating')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(ratingData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Attendance marked with rating successfully');
    });
  });

  describe('GET /api/v1/attendance', () => {
    it('should get attendance records successfully', async () => {
      const mockAttendanceRecords = [
        {
          id: 1,
          worker_id: 1,
          project_id: 1,
          date: '2024-01-15',
          status: 'Present',
          rating: 4,
          worker_name: 'John Worker',
          project_name: 'Test Project',
          supervisor_name: 'Jane Supervisor'
        }
      ];

      // Mock attendance query and count
      db.query
        .mockResolvedValueOnce({ rows: mockAttendanceRecords }) // Get attendance records
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }); // Count records

      const response = await request(app)
        .get('/api/v1/attendance')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Attendance records retrieved successfully');
      expect(response.body.data.attendanceRecords).toHaveLength(1);
      expect(response.body.data.pagination.totalCount).toBe(1);
    });
  });

  describe('GET /api/v1/attendance/:attendanceId', () => {
    it('should get attendance by ID successfully', async () => {
      const mockAttendance = {
        id: 1,
        uuid: 'attendance-uuid',
        user_id: 1,
        worker_id: 1,
        project_id: 1,
        date: '2024-01-15',
        check_in: '08:00',
        check_out: '17:00',
        status: 'Present',
        rating: 4,
        comments: 'Good work',
        created_at: new Date(),
        updated_at: new Date()
      };

      db.query.mockResolvedValueOnce({ rows: [mockAttendance] });

      const response = await request(app)
        .get('/api/v1/attendance/1')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Attendance record retrieved successfully');
      expect(response.body.data.attendance.id).toBe(mockAttendance.id);
    });

    it('should return error for non-existent attendance', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/v1/attendance/999')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Attendance record not found');
    });
  });

  describe('PUT /api/v1/attendance/:attendanceId', () => {
    it('should update attendance successfully', async () => {
      const updateData = {
        checkOut: '18:00',
        rating: 5,
        comments: 'Excellent performance'
      };

      const mockAttendance = { id: 1, user_id: 1 };
      const mockUpdatedAttendance = {
        id: 1,
        uuid: 'attendance-uuid',
        user_id: 1,
        worker_id: 1,
        project_id: 1,
        check_out: updateData.checkOut,
        rating: updateData.rating,
        comments: updateData.comments,
        updated_at: new Date()
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockAttendance] }) // Attendance exists
        .mockResolvedValueOnce({ rows: [mockUpdatedAttendance] }); // Update attendance

      const response = await request(app)
        .put('/api/v1/attendance/1')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Attendance record updated successfully');
      expect(response.body.data.attendance.rating).toBe(updateData.rating);
    });
  });

  describe('DELETE /api/v1/attendance/:attendanceId', () => {
    it('should delete attendance successfully', async () => {
      const mockAttendance = { id: 1, user_id: 1 };

      db.query
        .mockResolvedValueOnce({ rows: [mockAttendance] }) // Attendance exists
        .mockResolvedValueOnce({ rowCount: 1 }); // Delete attendance

      const response = await request(app)
        .delete('/api/v1/attendance/1')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Attendance record deleted successfully');
    });
  });

  describe('GET /api/v1/attendance/stats', () => {
    it('should get attendance statistics successfully', async () => {
      // Mock statistics queries
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '10' }] }) // Total records
        .mockResolvedValueOnce({ rows: [{ count: '8' }] }) // Present count
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }) // Absent count
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }) // Late count
        .mockResolvedValueOnce({ rows: [{ avg: '4.2' }] }); // Average rating

      const response = await request(app)
        .get('/api/v1/attendance/stats')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Attendance statistics retrieved successfully');
      expect(response.body.data.stats.totalRecords).toBe(10);
      expect(response.body.data.stats.presentCount).toBe(8);
      expect(response.body.data.stats.attendanceRate).toBe('90.00');
    });
  });

  describe('GET /api/v1/attendance/worker/:workerId/summary', () => {
    it('should get worker attendance summary successfully', async () => {
      const mockWorker = { id: 1, fullname: 'John Worker', user_id: 1 };

      // Mock worker exists, statistics, and records
      db.query
        .mockResolvedValueOnce({ rows: [mockWorker] }) // Worker exists
        .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // Total records
        .mockResolvedValueOnce({ rows: [{ count: '4' }] }) // Present count
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }) // Absent count
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // Late count
        .mockResolvedValueOnce({ rows: [{ avg: '4.0' }] }) // Average rating
        .mockResolvedValueOnce({ rows: [] }) // Recent records
        .mockResolvedValueOnce({ rows: [{ count: '5' }] }); // Count for pagination

      const response = await request(app)
        .get('/api/v1/attendance/worker/1/summary')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Worker attendance summary retrieved successfully');
      expect(response.body.data.worker.fullname).toBe('John Worker');
      expect(response.body.data.stats.totalRecords).toBe(5);
    });

    it('should return error for non-existent worker', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }); // Worker not found

      const response = await request(app)
        .get('/api/v1/attendance/worker/999/summary')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Worker not found or access denied');
    });
  });
});