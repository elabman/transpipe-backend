const BaseModel = require('./BaseModel');
const logger = require('../utils/logger');

/**
 * Attendance Model
 * Handles attendance-related database operations
 * Extends BaseModel for common CRUD operations
 */
class Attendance extends BaseModel {
  constructor() {
    super('attendance');
  }

  // Find attendance by user ID
  async findByUserId(userId) {
    return this.findWhere({ user_id: userId });
  }

  // Find attendance by worker and project
  async findByWorkerAndProject(workerId, projectId, date = null) {
    const conditions = { worker_id: workerId, project_id: projectId };
    if (date) {
      conditions.date = date;
    }
    return date ? this.findOne(conditions) : this.findWhere(conditions);
  }

  // Create attendance record with validation
  async createAttendance(attendanceData) {
    const { 
      userId, 
      workerId, 
      projectId, 
      date, 
      checkIn, 
      checkOut, 
      status 
    } = attendanceData;

    // Validate user exists
    const User = require('./User');
    const userModel = new User();
    const user = await userModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Validate worker exists and belongs to user
    const workerResult = await this.db.query(
      'SELECT * FROM workers WHERE id = $1 AND user_id = $2',
      [workerId, userId]
    );

    if (workerResult.rows.length === 0) {
      throw new Error('Worker not found or access denied');
    }

    // Validate project exists and belongs to user
    const Project = require('./Project');
    const projectModel = new Project();
    const project = await projectModel.findById(projectId);
    if (!project || project.user_id !== userId) {
      throw new Error('Project not found or access denied');
    }

    // Check if attendance already exists for this worker, project, and date
    const existingAttendance = await this.findByWorkerAndProject(workerId, projectId, date);
    if (existingAttendance) {
      throw new Error('Attendance record already exists for this worker on this date');
    }

    // Create attendance record
    const attendance = await this.create({
      user_id: userId,
      worker_id: workerId,
      project_id: projectId,
      date,
      check_in: checkIn,
      check_out: checkOut,
      status
    });

    logger.business('attendance_created', {
      attendanceId: attendance.id,
      userId,
      workerId,
      projectId,
      date,
      status
    });

    return attendance;
  }

  // Mark attendance with rating (supervisor function)
  async markAttendanceWithRating(attendanceData) {
    const { 
      userId, 
      workerId, 
      projectId, 
      date, 
      attendance: status, 
      rating, 
      comments 
    } = attendanceData;

    // Validate user exists
    const User = require('./User');
    const userModel = new User();
    const user = await userModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Validate worker exists and belongs to user
    const workerResult = await this.db.query(
      'SELECT * FROM workers WHERE id = $1 AND user_id = $2',
      [workerId, userId]
    );

    if (workerResult.rows.length === 0) {
      throw new Error('Worker not found or access denied');
    }

    // Validate project exists and belongs to user
    const Project = require('./Project');
    const projectModel = new Project();
    const project = await projectModel.findById(projectId);
    if (!project || project.user_id !== userId) {
      throw new Error('Project not found or access denied');
    }

    // Check if attendance already exists for this date
    const existingAttendance = await this.findByWorkerAndProject(workerId, projectId, date);
    
    let attendance;
    if (existingAttendance) {
      // Update existing attendance with rating
      attendance = await this.updateById(existingAttendance.id, {
        status,
        rating,
        comments
      });
    } else {
      // Create new attendance record with rating
      attendance = await this.create({
        user_id: userId,
        worker_id: workerId,
        project_id: projectId,
        date,
        status,
        rating,
        comments
      });
    }

    logger.business('attendance_marked_with_rating', {
      attendanceId: attendance.id,
      userId,
      workerId,
      projectId,
      date,
      status,
      rating
    });

    return attendance;
  }

  // Update attendance record
  async updateAttendance(attendanceId, updateData, userId) {
    // Verify ownership
    const attendance = await this.findById(attendanceId);
    if (!attendance) {
      throw new Error('Attendance record not found');
    }

    if (attendance.user_id !== userId) {
      throw new Error('Access denied. You can only update your own attendance records.');
    }

    // Map frontend field names to database field names
    const fieldMapping = {
      checkIn: 'check_in',
      checkOut: 'check_out',
      status: 'status',
      rating: 'rating',
      comments: 'comments'
    };

    const allowedFields = Object.values(fieldMapping);
    
    const filteredData = {};
    Object.keys(updateData).forEach(key => {
      const dbField = fieldMapping[key] || key;
      if (allowedFields.includes(dbField)) {
        filteredData[dbField] = updateData[key];
      }
    });

    const updatedAttendance = await this.updateById(attendanceId, filteredData);

    if (updatedAttendance) {
      logger.business('attendance_updated', {
        attendanceId,
        userId,
        updatedFields: Object.keys(filteredData)
      });
    }

    return updatedAttendance;
  }

  // Get attendance records with pagination and filters
  async getAttendanceRecords(filters = {}, pagination = {}) {
    const { page = 1, limit = 10 } = pagination;
    const offset = (page - 1) * limit;

    // Build conditions from filters
    const conditions = {};
    if (filters.userId) conditions.user_id = filters.userId;
    if (filters.workerId) conditions.worker_id = filters.workerId;
    if (filters.projectId) conditions.project_id = filters.projectId;
    if (filters.status) conditions.status = filters.status;
    if (filters.date) conditions.date = filters.date;

    // Get attendance records with worker and project information
    let query = `
      SELECT a.*, 
             w.fullname as worker_name, 
             p.name as project_name,
             u.name as supervisor_name
      FROM attendance a
      JOIN workers w ON a.worker_id = w.id
      JOIN projects p ON a.project_id = p.id
      JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    // Add filters to query
    if (conditions.user_id) {
      paramCount++;
      query += ` AND a.user_id = $${paramCount}`;
      params.push(conditions.user_id);
    }

    if (conditions.worker_id) {
      paramCount++;
      query += ` AND a.worker_id = $${paramCount}`;
      params.push(conditions.worker_id);
    }

    if (conditions.project_id) {
      paramCount++;
      query += ` AND a.project_id = $${paramCount}`;
      params.push(conditions.project_id);
    }

    if (conditions.status) {
      paramCount++;
      query += ` AND a.status = $${paramCount}`;
      params.push(conditions.status);
    }

    if (conditions.date) {
      paramCount++;
      query += ` AND a.date = $${paramCount}`;
      params.push(conditions.date);
    }

    // Add date range filters if provided
    if (filters.startDate) {
      paramCount++;
      query += ` AND a.date >= $${paramCount}`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      paramCount++;
      query += ` AND a.date <= $${paramCount}`;
      params.push(filters.endDate);
    }

    // Add pagination
    query += ` ORDER BY a.date DESC, a.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);

    // Get total count
    const totalCount = await this.count(conditions);

    return {
      attendanceRecords: result.rows,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNext: page * limit < totalCount,
        hasPrev: page > 1
      }
    };
  }

  // Get attendance statistics
  async getAttendanceStats(filters = {}) {
    const conditions = {};
    if (filters.userId) conditions.user_id = filters.userId;
    if (filters.projectId) conditions.project_id = filters.projectId;
    if (filters.workerId) conditions.worker_id = filters.workerId;

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

    if (conditions.worker_id) {
      paramCount++;
      whereClause += ` AND worker_id = $${paramCount}`;
      params.push(conditions.worker_id);
    }

    // Add date range if provided
    if (filters.startDate) {
      paramCount++;
      whereClause += ` AND date >= $${paramCount}`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      paramCount++;
      whereClause += ` AND date <= $${paramCount}`;
      params.push(filters.endDate);
    }

    // Get statistics in parallel
    const [totalRecords, presentCount, absentCount, lateCount, avgRating] = await Promise.all([
      this.db.query(`SELECT COUNT(*) FROM attendance ${whereClause}`, params),
      this.db.query(`SELECT COUNT(*) FROM attendance ${whereClause} AND status = 'Present'`, params),
      this.db.query(`SELECT COUNT(*) FROM attendance ${whereClause} AND status = 'Absent'`, params),
      this.db.query(`SELECT COUNT(*) FROM attendance ${whereClause} AND status = 'Late'`, params),
      this.db.query(`SELECT AVG(rating) FROM attendance ${whereClause} AND rating IS NOT NULL`, params)
    ]);

    const total = parseInt(totalRecords.rows[0].count);
    const present = parseInt(presentCount.rows[0].count);
    const absent = parseInt(absentCount.rows[0].count);
    const late = parseInt(lateCount.rows[0].count);

    return {
      totalRecords: total,
      presentCount: present,
      absentCount: absent,
      lateCount: late,
      halfDayCount: total - present - absent - late, // Calculate half day
      attendanceRate: total > 0 ? ((present + late) / total * 100).toFixed(2) : 0,
      averageRating: parseFloat(avgRating.rows[0].avg || 0).toFixed(2)
    };
  }

  // Delete attendance record
  async deleteAttendance(attendanceId, userId) {
    const attendance = await this.findById(attendanceId);
    if (!attendance || attendance.user_id !== userId) {
      throw new Error('Attendance record not found or access denied');
    }

    const deleted = await this.deleteById(attendanceId);

    if (deleted) {
      logger.business('attendance_deleted', { attendanceId, userId });
    }

    return deleted;
  }
}

module.exports = Attendance;