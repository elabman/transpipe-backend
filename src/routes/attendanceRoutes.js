const express = require('express');
const AttendanceController = require('../controllers/attendanceController');
const { validate, schemas } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Attendance routes
router.post('/', validate(schemas.createAttendance), AttendanceController.createAttendance);
router.post('/mark-rating', validate(schemas.markAttendanceWithRating), AttendanceController.markAttendanceWithRating);
router.get('/', AttendanceController.getAttendanceRecords);
router.get('/stats', AttendanceController.getAttendanceStats);
router.get('/:attendanceId', AttendanceController.getAttendanceById);
router.put('/:attendanceId', validate(schemas.updateAttendance), AttendanceController.updateAttendance);
router.delete('/:attendanceId', AttendanceController.deleteAttendance);

// Worker-specific attendance routes
router.get('/worker/:workerId/summary', AttendanceController.getWorkerAttendanceSummary);

module.exports = router;