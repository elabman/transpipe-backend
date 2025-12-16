const BaseModel = require('./BaseModel');
const logger = require('../utils/logger');

/**
 * Company Model - Clean & Professional
 * Handles company-related database operations
 * Extends BaseModel for common CRUD operations
 */
class Company extends BaseModel {
  constructor() {
    super('companies');
  }

  // Find company by user ID
  async findByUserId(userId) {
    return this.findOne({ user_id: userId });
  }

  // Find company by registration number
  async findByRegistrationNumber(registrationNumber) {
    return this.findOne({ registration_number: registrationNumber });
  }

  // Create company with validation
  async createCompany(companyData) {
    const { 
      userId, 
      companyName, 
      registrationNumber, 
      taxId, 
      address, 
      industry 
    } = companyData;

    // Validate user exists and doesn't already have a company
    await this._validateCompanyCreation(userId, registrationNumber);

    const company = await this.create({
      user_id: userId,
      company_name: companyName,
      registration_number: registrationNumber,
      tax_id: taxId,
      address,
      industry
    });

    logger.business('company_created', {
      companyId: company.id,
      userId,
      companyName,
      industry
    });

    return company;
  }

  // Update company information
  async updateCompany(companyId, updateData, userId) {
    // Verify ownership
    const company = await this.findById(companyId);
    if (!company) {
      throw new Error('Company not found');
    }

    if (company.user_id !== userId) {
      throw new Error('Access denied. You can only update your own company.');
    }

    // Map frontend field names to database field names
    const fieldMapping = {
      companyName: 'company_name',
      registrationNumber: 'registration_number',
      taxId: 'tax_id',
      address: 'address',
      industry: 'industry'
    };
    
    const allowedFields = Object.values(fieldMapping);
    
    const filteredData = {};
    Object.keys(updateData).forEach(key => {
      const dbField = fieldMapping[key] || key;
      if (allowedFields.includes(dbField)) {
        filteredData[dbField] = updateData[key];
      }
    });



    const updatedCompany = await this.updateById(companyId, filteredData);

    if (updatedCompany) {
      logger.business('company_updated', {
        companyId,
        userId,
        updatedFields: Object.keys(filteredData)
      });
    }

    return updatedCompany;
  }

  // Get companies with pagination and filters
  async getCompanies(filters = {}, pagination = {}) {
    const { page = 1, limit = 10 } = pagination;
    const offset = (page - 1) * limit;

    // Build conditions from filters
    const conditions = {};
    if (filters.industry) conditions.industry = filters.industry;
    if (filters.userId) conditions.user_id = filters.userId;

    // Get companies with user information
    let query = `
      SELECT c.*, u.name as owner_name, u.email as owner_email
      FROM companies c
      JOIN users u ON c.user_id = u.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    // Add filters to query
    if (conditions.industry) {
      paramCount++;
      query += ` AND c.industry = $${paramCount}`;
      params.push(conditions.industry);
    }

    if (conditions.user_id) {
      paramCount++;
      query += ` AND c.user_id = $${paramCount}`;
      params.push(conditions.user_id);
    }

    // Add pagination
    query += ` ORDER BY c.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);

    // Get total count
    const totalCount = await this.count(conditions);

    return {
      companies: result.rows,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNext: page * limit < totalCount,
        hasPrev: page > 1
      }
    };
  }

  // Get company statistics
  async getCompanyStats(companyId, userId) {
    // Verify ownership
    const company = await this.findById(companyId);
    if (!company || company.user_id !== userId) {
      throw new Error('Company not found or access denied');
    }

    // Get statistics in parallel
    const [workerCount, projectCount, activeProjectCount] = await Promise.all([
      this.db.query(
        'SELECT COUNT(*) FROM workers WHERE user_id = $1 AND is_active = true',
        [userId]
      ),
      this.db.query(
        'SELECT COUNT(*) FROM projects WHERE user_id = $1',
        [userId]
      ),
      this.db.query(
        'SELECT COUNT(*) FROM projects WHERE user_id = $1 AND status = $2',
        [userId, 'Active']
      )
    ]);

    return {
      company,
      stats: {
        totalWorkers: parseInt(workerCount.rows[0].count),
        totalProjects: parseInt(projectCount.rows[0].count),
        activeProjects: parseInt(activeProjectCount.rows[0].count)
      }
    };
  }

  // Delete company (soft delete by deactivating user)
  async deleteCompany(companyId, userId) {
    const company = await this.findById(companyId);
    if (!company || company.user_id !== userId) {
      throw new Error('Company not found or access denied');
    }

    // Instead of deleting, we deactivate the associated user
    const User = require('./User');
    const userModel = new User();
    await userModel.deactivateUser(userId);

    logger.business('company_deleted', { companyId, userId });
    return true;
  }

  // Private helper methods
  async _validateCompanyCreation(userId, registrationNumber) {
    // Check if user exists
    const User = require('./User');
    const userModel = new User();
    const user = await userModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if user already has a company
    const existingCompany = await this.findByUserId(userId);
    if (existingCompany) {
      throw new Error('User already has a registered company');
    }

    // Check if registration number is unique (if provided)
    if (registrationNumber) {
      const existingRegNumber = await this.findByRegistrationNumber(registrationNumber);
      if (existingRegNumber) {
        throw new Error('Company with this registration number already exists');
      }
    }
  }

  // Get company by ID with owner information
  async getCompanyWithOwner(companyId) {
    const result = await this.db.query(
      `SELECT c.*, u.name as owner_name, u.email as owner_email, u.phone as owner_phone
       FROM companies c
       JOIN users u ON c.user_id = u.id
       WHERE c.id = $1`,
      [companyId]
    );

    return result.rows[0] || null;
  }
}

module.exports = Company;