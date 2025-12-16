const BaseModel = require('./BaseModel');
const logger = require('../utils/logger');

/**
 * Project Model
 * Handles project-related database operations
 * Extends BaseModel for common CRUD operations
 */
class Project extends BaseModel {
  constructor() {
    super('projects');
  }

  // Find projects by user ID
  async findByUserId(userId) {
    return this.findWhere({ user_id: userId });
  }

  // Create project with validation
  async createProject(projectData) {
    const { 
      userId, 
      name, 
      description,
      client, 
      category, 
      startDate, 
      endDate, 
      budget,
      positions = []
    } = projectData;

    // Validate user exists
    const User = require('./User');
    const userModel = new User();
    const user = await userModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Create project
    const project = await this.create({
      user_id: userId,
      name,
      description,
      client,
      category,
      start_date: startDate,
      end_date: endDate,
      budget,
      status: 'Active'
    });

    // If positions are provided, create them and link to project
    if (positions.length > 0) {
      await this._createProjectPositions(project.id, positions, userId);
    }

    logger.business('project_created', {
      projectId: project.id,
      userId,
      name,
      category,
      budget
    });

    return project;
  }

  // Update project information
  async updateProject(projectId, updateData, userId) {
    // Verify ownership
    const project = await this.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    if (project.user_id !== userId) {
      throw new Error('Access denied. You can only update your own projects.');
    }

    // Map frontend field names to database field names
    const fieldMapping = {
      name: 'name',
      description: 'description',
      client: 'client',
      category: 'category',
      startDate: 'start_date',
      endDate: 'end_date',
      budget: 'budget',
      status: 'status'
    };

    const allowedFields = Object.values(fieldMapping);
    
    const filteredData = {};
    Object.keys(updateData).forEach(key => {
      const dbField = fieldMapping[key] || key;
      if (allowedFields.includes(dbField)) {
        filteredData[dbField] = updateData[key];
      }
    });

    const updatedProject = await this.updateById(projectId, filteredData);

    if (updatedProject) {
      logger.business('project_updated', {
        projectId,
        userId,
        updatedFields: Object.keys(filteredData)
      });
    }

    return updatedProject;
  }

  // Get projects with pagination and filters
  async getProjects(filters = {}, pagination = {}) {
    const { page = 1, limit = 10 } = pagination;
    const offset = (page - 1) * limit;

    // Build conditions from filters
    const conditions = {};
    if (filters.category) conditions.category = filters.category;
    if (filters.status) conditions.status = filters.status;
    if (filters.userId) conditions.user_id = filters.userId;

    // Get projects with user information
    let query = `
      SELECT p.*, u.name as owner_name, u.email as owner_email
      FROM projects p
      JOIN users u ON p.user_id = u.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    // Add filters to query
    if (conditions.category) {
      paramCount++;
      query += ` AND p.category = $${paramCount}`;
      params.push(conditions.category);
    }

    if (conditions.status) {
      paramCount++;
      query += ` AND p.status = $${paramCount}`;
      params.push(conditions.status);
    }

    if (conditions.user_id) {
      paramCount++;
      query += ` AND p.user_id = $${paramCount}`;
      params.push(conditions.user_id);
    }

    // Add pagination
    query += ` ORDER BY p.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);

    // Get total count
    const totalCount = await this.count(conditions);

    return {
      projects: result.rows,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNext: page * limit < totalCount,
        hasPrev: page > 1
      }
    };
  }

  // Assign supervisor to project
  async assignSupervisor(projectId, supervisorId, userId) {
    // Verify project ownership
    const project = await this.findById(projectId);
    if (!project || project.user_id !== userId) {
      throw new Error('Project not found or access denied');
    }

    // Verify supervisor exists and is a worker
    const workerResult = await this.db.query(
      'SELECT * FROM workers WHERE id = $1 AND user_id = $2',
      [supervisorId, userId]
    );

    if (workerResult.rows.length === 0) {
      throw new Error('Supervisor not found or not owned by user');
    }

    // Check if supervisor is already assigned
    const existingAssignment = await this.db.query(
      'SELECT * FROM project_supervisors WHERE project_id = $1 AND supervisor_id = $2',
      [projectId, supervisorId]
    );

    if (existingAssignment.rows.length > 0) {
      throw new Error('Supervisor already assigned to this project');
    }

    // Assign supervisor
    const result = await this.db.query(
      `INSERT INTO project_supervisors (project_id, supervisor_id) 
       VALUES ($1, $2) RETURNING *`,
      [projectId, supervisorId]
    );

    logger.business('supervisor_assigned', {
      projectId,
      supervisorId,
      userId
    });

    return result.rows[0];
  }

  // Get project statistics
  async getProjectStats(projectId, userId) {
    // Verify ownership
    const project = await this.findById(projectId);
    if (!project || project.user_id !== userId) {
      throw new Error('Project not found or access denied');
    }

    // Get statistics in parallel
    const [workerCount, supervisorCount, attendanceCount] = await Promise.all([
      this.db.query(
        'SELECT COUNT(*) FROM project_workers WHERE project_id = $1 AND is_active = true',
        [projectId]
      ),
      this.db.query(
        'SELECT COUNT(*) FROM project_supervisors WHERE project_id = $1 AND is_active = true',
        [projectId]
      ),
      this.db.query(
        'SELECT COUNT(*) FROM attendance WHERE project_id = $1',
        [projectId]
      )
    ]);

    return {
      project,
      stats: {
        totalWorkers: parseInt(workerCount.rows[0].count),
        totalSupervisors: parseInt(supervisorCount.rows[0].count),
        totalAttendanceRecords: parseInt(attendanceCount.rows[0].count)
      }
    };
  }

  // Private helper methods
  async _createProjectPositions(projectId, positions, userId) {
    // Get or create positions and link them to project
    for (const positionName of positions) {
      // Check if position exists for this user
      let positionResult = await this.db.query(
        'SELECT * FROM positions WHERE name = $1 AND user_id = $2',
        [positionName, userId]
      );

      let positionId;
      if (positionResult.rows.length === 0) {
        // Create new position with default rate
        const newPosition = await this.db.query(
          `INSERT INTO positions (user_id, name, default_daily_rate) 
           VALUES ($1, $2, $3) RETURNING *`,
          [userId, positionName, 100.00] // Default rate
        );
        positionId = newPosition.rows[0].id;
      } else {
        positionId = positionResult.rows[0].id;
      }

      // Link position to project
      await this.db.query(
        `INSERT INTO project_positions (project_id, position_id, daily_rate) 
         VALUES ($1, $2, (SELECT default_daily_rate FROM positions WHERE id = $2))
         ON CONFLICT (project_id, position_id) DO NOTHING`,
        [projectId, positionId]
      );
    }
  }
}

module.exports = Project;