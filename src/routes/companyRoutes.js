const express = require('express');
const CompanyController = require('../controllers/companyController');
const { validate, schemas } = require('../middleware/validation');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.get('/:companyId/public', CompanyController.getCompanyById);

// Protected routes (require authentication)
router.use(authenticateToken);

// Company management routes
router.post('/register', validate(schemas.companyRegistration), CompanyController.registerCompany);
router.get('/profile', CompanyController.getCompanyProfile);
router.put('/:companyId', validate(schemas.companyUpdate), CompanyController.updateCompany);
router.get('/:companyId/stats', CompanyController.getCompanyStats);
router.delete('/:companyId', CompanyController.deleteCompany);

// Admin routes
router.get('/', authorizeRoles('admin'), CompanyController.getCompanies);

module.exports = router;