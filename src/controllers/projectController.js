const Project = require('../models/Project');
const Position = require('../models/Position');
const MaterialRequest = require('../models/MaterialRequest');
const logger = require('../utils/logger');

const projectModel = new Project();
const positionModel = new Position();
const materialRequestModel = new MaterialRequest();

/**
 * Project Controller
 * Handles HTTP requests for project management operations
 */
class ProjectController {
  /**
   * Create Project
   * Creates a new project for authenticated user
   */
  static async createProject(req, res, next) {
    try {
      const userId = req.user.id;
      const projectData = { ...req.body, userId };

      const project = await projectModel.createProject(projectData);

      res.status(201).json({
        success: true,
        message: 'Project created successfully',
        data: {
          project: {
            id: project.id,
            uuid: project.uuid,
            name: project.name,
            description: project.description,
            client: project.client,
            category: project.category,
            startDate: project.start_date,
            endDate: project.end_date,
            budget: project.budget,
            status: project.status,
            createdAt: project.created_at
          }
        }
      });
    } catch (error) {
      if (error.message.includes('User not found')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Get User Projects
   * Returns authenticated user's projects
   */
  static async getUserProjects(req, res, next) {
    try {
      const userId = req.user.id;
      const { page, limit, category, status } = req.query;
      
      const filters = { userId };
      if (category) filters.category = category;
      if (status) filters.status = status;

      const result = await projectModel.getProjects(
        filters, 
        { page: parseInt(page), limit: parseInt(limit) }
      );

      res.json({
        success: true,
        message: 'Projects retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Project by ID
   * Returns specific project details
   */
  static async getProjectById(req, res, next) {
    try {
      const userId = req.user.id;
      const { projectId } = req.params;

      const project = await projectModel.findById(parseInt(projectId));
      if (!project || project.user_id !== userId) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }

      res.json({
        success: true,
        message: 'Project retrieved successfully',
        data: {
          project: {
            id: project.id,
            uuid: project.uuid,
            name: project.name,
            description: project.description,
            client: project.client,
            category: project.category,
            startDate: project.start_date,
            endDate: project.end_date,
            budget: project.budget,
            status: project.status,
            createdAt: project.created_at,
            updatedAt: project.updated_at
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update Project
   * Updates project information for authenticated user
   */
  static async updateProject(req, res, next) {
    try {
      const userId = req.user.id;
      const { projectId } = req.params;
      const updateData = req.body;

      const updatedProject = await projectModel.updateProject(
        parseInt(projectId), 
        updateData, 
        userId
      );

      if (!updatedProject) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }

      res.json({
        success: true,
        message: 'Project updated successfully',
        data: {
          project: {
            id: updatedProject.id,
            uuid: updatedProject.uuid,
            name: updatedProject.name,
            description: updatedProject.description,
            client: updatedProject.client,
            category: updatedProject.category,
            startDate: updatedProject.start_date,
            endDate: updatedProject.end_date,
            budget: updatedProject.budget,
            status: updatedProject.status,
            updatedAt: updatedProject.updated_at
          }
        }
      });
    } catch (error) {
      if (error.message.includes('Project not found') || 
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
   * Get Project Statistics
   * Returns project statistics including worker and attendance counts
   */
  static async getProjectStats(req, res, next) {
    try {
      const userId = req.user.id;
      const { projectId } = req.params;

      const stats = await projectModel.getProjectStats(parseInt(projectId), userId);

      res.json({
        success: true,
        message: 'Project statistics retrieved successfully',
        data: stats
      });
    } catch (error) {
      if (error.message.includes('Project not found') || 
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
   * Assign Supervisor to Project
   * Assigns a supervisor (worker) to a project
   */
  static async assignSupervisor(req, res, next) {
    try {
      const userId = req.user.id;
      const { projectId, supervisorId } = req.body;

      const assignment = await projectModel.assignSupervisor(
        parseInt(projectId), 
        parseInt(supervisorId), 
        userId
      );

      res.status(201).json({
        success: true,
        message: 'Supervisor assigned successfully',
        data: {
          assignment: {
            id: assignment.id,
            projectId: assignment.project_id,
            supervisorId: assignment.supervisor_id,
            assignedAt: assignment.assigned_at
          }
        }
      });
    } catch (error) {
      if (error.message.includes('not found') || 
          error.message.includes('access denied') ||
          error.message.includes('already assigned')) {
        return res.status(error.message.includes('already assigned') ? 409 : 404).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Create Position
   * Creates a new position for authenticated user
   */
  static async createPosition(req, res, next) {
    try {
      const userId = req.user.id;
      const positionData = { ...req.body, userId };

      const position = await positionModel.createPosition(positionData);

      res.status(201).json({
        success: true,
        message: 'Position created successfully',
        data: {
          position: {
            id: position.id,
            uuid: position.uuid,
            name: position.name,
            description: position.description,
            defaultDailyRate: position.default_daily_rate,
            createdAt: position.created_at
          }
        }
      });
    } catch (error) {
      if (error.message.includes('User not found') || 
          error.message.includes('already exists')) {
        return res.status(error.message.includes('not found') ? 404 : 409).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Get User Positions
   * Returns authenticated user's positions
   */
  static async getUserPositions(req, res, next) {
    try {
      const userId = req.user.id;
      const { page, limit } = req.query;
      
      const filters = { userId };

      const result = await positionModel.getPositions(
        filters, 
        { page: parseInt(page), limit: parseInt(limit) }
      );

      res.json({
        success: true,
        message: 'Positions retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Request Material
   * Creates a new material request for a project
   */
  static async requestMaterial(req, res, next) {
    try {
      const userId = req.user.id;
      const requestData = { ...req.body, userId };

      const materialRequest = await materialRequestModel.createMaterialRequest(requestData);

      res.status(201).json({
        success: true,
        message: 'Material request created successfully',
        data: {
          materialRequest: {
            id: materialRequest.id,
            uuid: materialRequest.uuid,
            requestId: materialRequest.request_id,
            projectId: materialRequest.project_id,
            materialName: materialRequest.material_name,
            quantity: materialRequest.quantity,
            unit: materialRequest.unit,
            estimatedCost: materialRequest.estimated_cost,
            urgency: materialRequest.urgency,
            description: materialRequest.description,
            status: materialRequest.status,
            createdAt: materialRequest.created_at
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
   * Approve Material Request
   * Approves a material request
   */
  static async approveMaterialRequest(req, res, next) {
    try {
      const userId = req.user.id;
      const { requestId } = req.body;

      const updatedRequest = await materialRequestModel.approveMaterialRequest(
        requestId, 
        userId
      );

      res.json({
        success: true,
        message: 'Material request approved successfully',
        data: {
          materialRequest: {
            id: updatedRequest.id,
            requestId: updatedRequest.request_id,
            status: updatedRequest.status,
            approvedBy: updatedRequest.approved_by,
            approvedAt: updatedRequest.approved_at
          }
        }
      });
    } catch (error) {
      if (error.message.includes('not found') || 
          error.message.includes('Only pending')) {
        return res.status(error.message.includes('not found') ? 404 : 400).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Get Material Requests
   * Returns material requests with filters
   */
  static async getMaterialRequests(req, res, next) {
    try {
      const userId = req.user.id;
      const { page, limit, projectId, status, urgency } = req.query;
      
      const filters = { userId };
      if (projectId) filters.projectId = parseInt(projectId);
      if (status) filters.status = status;
      if (urgency) filters.urgency = urgency;

      const result = await materialRequestModel.getMaterialRequests(
        filters, 
        { page: parseInt(page), limit: parseInt(limit) }
      );

      res.json({
        success: true,
        message: 'Material requests retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ProjectController;