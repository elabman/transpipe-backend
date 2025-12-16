const Company = require('../models/Company');
const companyModel = new Company();
const logger = require('../utils/logger');

/**
 * Company Controller
 * Handles HTTP requests for company management operations
 * Uses Company model for data access and business logic
 */
class CompanyController {
  /**
   * Register Company
   * Creates a new company registration for authenticated user
   */
  static async registerCompany(req, res, next) {
    try {
      const userId = req.user.id;
      const companyData = { ...req.body, userId };

      const company = await companyModel.createCompany(companyData);

      res.status(201).json({
        success: true,
        message: 'Company registered successfully',
        data: {
          company: {
            id: company.id,
            uuid: company.uuid,
            companyName: company.company_name,
            registrationNumber: company.registration_number,
            taxId: company.tax_id,
            address: company.address,
            industry: company.industry,
            createdAt: company.created_at
          }
        }
      });
    } catch (error) {
      if (error.message.includes('User not found') || 
          error.message.includes('already has a registered company') ||
          error.message.includes('registration number already exists')) {
        return res.status(409).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Get Company Profile
   * Returns authenticated user's company information
   */
  static async getCompanyProfile(req, res, next) {
    try {
      const userId = req.user.id;
      
      const company = await companyModel.findByUserId(userId);
      if (!company) {
        return res.status(404).json({
          success: false,
          message: 'Company not found. Please register your company first.'
        });
      }

      const companyWithOwner = await companyModel.getCompanyWithOwner(company.id);

      res.json({
        success: true,
        message: 'Company profile retrieved successfully',
        data: {
          company: {
            id: companyWithOwner.id,
            uuid: companyWithOwner.uuid,
            companyName: companyWithOwner.company_name,
            registrationNumber: companyWithOwner.registration_number,
            taxId: companyWithOwner.tax_id,
            address: companyWithOwner.address,
            industry: companyWithOwner.industry,
            owner: {
              name: companyWithOwner.owner_name,
              email: companyWithOwner.owner_email,
              phone: companyWithOwner.owner_phone
            },
            createdAt: companyWithOwner.created_at,
            updatedAt: companyWithOwner.updated_at
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update Company
   * Updates company information for authenticated user
   */
  static async updateCompany(req, res, next) {
    try {
      const userId = req.user.id;
      const { companyId } = req.params;
      const updateData = req.body;

      const updatedCompany = await companyModel.updateCompany(
        parseInt(companyId), 
        updateData, 
        userId
      );

      if (!updatedCompany) {
        return res.status(404).json({
          success: false,
          message: 'Company not found'
        });
      }

      res.json({
        success: true,
        message: 'Company updated successfully',
        data: {
          company: {
            id: updatedCompany.id,
            uuid: updatedCompany.uuid,
            companyName: updatedCompany.company_name,
            registrationNumber: updatedCompany.registration_number,
            taxId: updatedCompany.tax_id,
            address: updatedCompany.address,
            industry: updatedCompany.industry,
            updatedAt: updatedCompany.updated_at
          }
        }
      });
    } catch (error) {
      if (error.message.includes('Company not found') || 
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
   * Get Company Statistics
   * Returns company statistics including worker and project counts
   */
  static async getCompanyStats(req, res, next) {
    try {
      const userId = req.user.id;
      const { companyId } = req.params;

      const stats = await companyModel.getCompanyStats(parseInt(companyId), userId);

      res.json({
        success: true,
        message: 'Company statistics retrieved successfully',
        data: stats
      });
    } catch (error) {
      if (error.message.includes('Company not found') || 
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
   * Get Companies (Admin only)
   * Returns paginated list of companies with filters
   */
  static async getCompanies(req, res, next) {
    try {
      const { page, limit, industry } = req.query;
      
      const filters = {};
      if (industry) filters.industry = industry;
      
      // Non-admin users can only see their own company
      if (req.user.role !== 'admin') {
        filters.userId = req.user.id;
      }

      const result = await companyModel.getCompanies(
        filters, 
        { page: parseInt(page), limit: parseInt(limit) }
      );

      res.json({
        success: true,
        message: 'Companies retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete Company
   * Deactivates company by deactivating associated user account
   */
  static async deleteCompany(req, res, next) {
    try {
      const userId = req.user.id;
      const { companyId } = req.params;

      await companyModel.deleteCompany(parseInt(companyId), userId);

      res.json({
        success: true,
        message: 'Company account deactivated successfully'
      });
    } catch (error) {
      if (error.message.includes('Company not found') || 
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
   * Get Company by ID (Public endpoint with limited info)
   * Returns basic company information for public viewing
   */
  static async getCompanyById(req, res, next) {
    try {
      const { companyId } = req.params;
      
      const company = await companyModel.getCompanyWithOwner(parseInt(companyId));
      if (!company) {
        return res.status(404).json({
          success: false,
          message: 'Company not found'
        });
      }

      // Return limited public information
      res.json({
        success: true,
        message: 'Company information retrieved successfully',
        data: {
          company: {
            id: company.id,
            companyName: company.company_name,
            industry: company.industry,
            address: company.address,
            registrationNumber: company.registration_number
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = CompanyController;