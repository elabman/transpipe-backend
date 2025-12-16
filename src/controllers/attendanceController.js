const Attendance = require('../models/Attendance');
const logger = require('../utils/logger');

const attendanceModel = new Attendance();

/**
 * Attendance Controller
 * Handles HTTP requests for attendance management operations
 */
class AttendanceController {
  /**
   * Create Attendance
   * Creates a new attendance record for a worker
   */
  static async createAttendance(req, res, next) {
    try {
      const userId = req.user.id;
      const attendanceData = { ...req.body, userId };

      const attendance = await attendanceModel.createAttendance(attendanceData);

      res.status(201).json({
        success: true,
        message: 'Attendance record created successfully',
        data: {
          attendance: {
            id: attendance.id,
            uuid: attendance.uuid,
            workerId: attendance.worker_id,
            projectId: attendance.project_id,
            date: attendance.date,
            checkIn: attendance.check_in,
            checkOut: attendance.check_out,
            status: attendance.status,
            rating: attendance.rating,
            comments: attendance.comments,
            createdAt: attendance.created_at
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
   * Mark Attendance with Rating
   * Creates or updates attendance record with supervisor rating
   */
  static async markAttendanceWithRating(req, res, next) {
    try {
      const userId = req.user.id;
      const attendanceData = { ...req.body, userId };

      const attendance = await attendanceModel.markAttendanceWithRating(attendanceData);

      res.status(201).json({
        success: true,
        message: 'Attendance marked with rating successfully',
        data: {
          attendance: {
            id: attendance.id,
            uuid: attendance.uuid,
            workerId: attendance.worker_id,
            projectId: attendance.project_id,
            date: attendance.date,
            status: attendance.status,
            rating: attendance.rating,
            comments: attendance.comments,
            createdAt: attendance.created_at,
            updatedAt: attendance.updated_at
          }
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
   * Get Attendance Records
   * Returns attendance records with pagination and filters
   */
  static async getAttendanceRecords(req, res, next) {
    try {
      const userId = req.user.id;
      const { 
        page, 
        limit, 
        workerId, 
        projectId, 
        status, 
        date, 
        startDate, 
        endDate 
      } = req.query;
      
      const filters = { userId };
      if (workerId) filters.workerId = parseInt(workerId);
      if (projectId) filters.projectId = parseInt(projectId);
      if (status) filters.status = status;
      if (date) filters.date = date;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      const result = await attendanceModel.getAttendanceRecords(
        filters, 
        { page: parseInt(page), limit: parseInt(limit) }
      );

      res.json({
        success: true,
        message: 'Attendance records retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Attendance by ID
   * Returns specific attendance record details
   */
  static async getAttendanceById(req, res, next) {
    try {
      const userId = req.user.id;
      const { attendanceId } = req.params;

      const attendance = await attendanceModel.findById(parseInt(attendanceId));
      if (!attendance || attendance.user_id !== userId) {
        return res.status(404).json({
          success: false,
          message: 'Attendance record not found'
        });
      }

      res.json({
        success: true,
        message: 'Attendance record retrieved successfully',
        data: {
          attendance: {
            id: attendance.id,
            uuid: attendance.uuid,
            workerId: attendance.worker_id,
            projectId: attendance.project_id,
            date: attendance.date,
            checkIn: attendance.check_in,
            checkOut: attendance.check_out,
            status: attendance.status,
            rating: attendance.rating,
            comments: attendance.comments,
            createdAt: attendance.created_at,
            updatedAt: attendance.updated_at
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update Attendance
   * Updates attendance record information
   */
  static async updateAttendance(req, res, next) {
    try {
      const userId = req.user.id;
      const { attendanceId } = req.params;
      const updateData = req.body;

      const updatedAttendance = await attendanceModel.updateAttendance(
        parseInt(attendanceId), 
        updateData, 
        userId
      );

      if (!updatedAttendance) {
        return res.status(404).json({
          success: false,
          message: 'Attendance record not found'
        });
      }

      res.json({
        success: true,
        message: 'Attendance record updated successfully',
        data: {
          attendance: {
            id: updatedAttendance.id,
            uuid: updatedAttendance.uuid,
            workerId: updatedAttendance.worker_id,
            projectId: updatedAttendance.project_id,
            date: updatedAttendance.date,
            checkIn: updatedAttendance.check_in,
            checkOut: updatedAttendance.check_out,
            status: updatedAttendance.status,
            rating: updatedAttendance.rating,
            comments: updatedAttendance.comments,
            updatedAt: updatedAttendance.updated_at
          }
        }
      });
    } catch (error) {
      if (error.message.includes('not found') || 
          error.message.includes('Access denied')) {
        return res.status(error.message.includes('not found') ? 404 : 403).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Delete Attendance
   * Deletes an attendance record
   */
  static async deleteAttendance(req, res, next) {
    try {
      const userId = req.user.id;
      const { attendanceId } = req.params;

      const deleted = await attendanceModel.deleteAttendance(
        parseInt(attendanceId), 
        userId
      );

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Attendance record not found'
        });
      }

      res.json({
        success: true,
        message: 'Attendance record deleted successfully'
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
   * Get Attendance Statistics
   * Returns attendance statistics with filters
   */
  static async getAttendanceStats(req, res, next) {
    try {
      const userId = req.user.id;
      const { 
        projectId, 
        workerId, 
        startDate, 
        endDate 
      } = req.query;
      
      const filters = { userId };
      if (projectId) filters.projectId = parseInt(projectId);
      if (workerId) filters.workerId = parseInt(workerId);
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      const stats = await attendanceModel.getAttendanceStats(filters);

      res.json({
        success: true,
        message: 'Attendance statistics retrieved successfully',
        data: {
          stats
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Worker Attendance Summary
   * Returns attendance summary for a specific worker
   */
  static async getWorkerAttendanceSummary(req, res, next) {
    try {
      const userId = req.user.id;
      const { workerId } = req.params;
      const { projectId, startDate, endDate } = req.query;

      // Verify worker belongs to user
      const workerResult = await attendanceModel.db.query(
        'SELECT * FROM workers WHERE id = $1 AND user_id = $2',
        [parseInt(workerId), userId]
      );

      if (workerResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Worker not found or access denied'
        });
      }

      const filters = { userId, workerId: parseInt(workerId) };
      if (projectId) filters.projectId = parseInt(projectId);
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      const [stats, records] = await Promise.all([
        attendanceModel.getAttendanceStats(filters),
        attendanceModel.getAttendanceRecords(filters, { page: 1, limit: 100 })
      ]);

      res.json({
        success: true,
        message: 'Worker attendance summary retrieved successfully',
        data: {
          worker: workerResult.rows[0],
          stats,
          recentRecords: records.attendanceRecords
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AttendanceController;