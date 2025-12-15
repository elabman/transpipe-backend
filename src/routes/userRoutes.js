const express = require('express');
const UserController = require('../controllers/userController');
const { validate, schemas } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.post('/register', validate(schemas.userRegistration), UserController.register);
router.post('/login', validate(schemas.userLogin), UserController.login);

// Protected routes
router.post('/workers', 
  authenticateToken, 
  validate(schemas.createWorker), 
  UserController.createWorker
);

router.post('/workers/card', 
  authenticateToken, 
  validate(schemas.createWorkerWithCard), 
  UserController.createWorkerWithCard
);

router.post('/sellers', 
  authenticateToken, 
  UserController.createSeller
);

module.exports = router;