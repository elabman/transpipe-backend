const express = require('express');
const ProjectController = require('../controllers/projectController');
const { validate, schemas } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Project routes
router.post('/', validate(schemas.createProject), ProjectController.createProject);
router.get('/', ProjectController.getUserProjects);
router.get('/:projectId', ProjectController.getProjectById);
router.put('/:projectId', validate(schemas.updateProject), ProjectController.updateProject);
router.get('/:projectId/stats', ProjectController.getProjectStats);

// Supervisor assignment
router.post('/assign-supervisor', validate(schemas.assignSupervisor), ProjectController.assignSupervisor);

// Position routes
router.post('/positions', validate(schemas.createPosition), ProjectController.createPosition);
router.get('/positions/list', ProjectController.getUserPositions);

// Material request routes
router.post('/materials/request', validate(schemas.createMaterialRequest), ProjectController.requestMaterial);
router.post('/materials/approve', validate(schemas.approveMaterialRequest), ProjectController.approveMaterialRequest);
router.get('/materials/requests', ProjectController.getMaterialRequests);

module.exports = router;