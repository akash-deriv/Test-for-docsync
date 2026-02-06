const Template = require('../models/Template');
const Task = require('../models/Task');
const Comment = require('../models/Comment');
const logger = require('../utils/logger');
const { cacheDelete } = require('../cache/redis');

class TemplateController {
  async createTemplate(req, res) {
    try {
      const userId = req.user.id;
      const { name, description, title, taskDescription, priority, tags, checklistItems, isPublic } = req.body;

      if (!name || name.trim().length === 0) {
        return res.status(400).json({ error: 'Template name is required' });
      }

      if (!title || title.trim().length === 0) {
        return res.status(400).json({ error: 'Task title is required' });
      }

      const template = await Template.create({
        userId,
        name: name.trim(),
        description: description?.trim() || '',
        title: title.trim(),
        taskDescription: taskDescription?.trim() || '',
        priority: priority || 'medium',
        tags: tags || [],
        checklistItems: checklistItems || [],
        isPublic: isPublic || false,
      });

      logger.info(`Template created: ${template.id} by user ${userId}`);

      res.status(201).json(template);
    } catch (error) {
      logger.error('Create template error:', error);
      res.status(500).json({ error: 'Failed to create template' });
    }
  }

  async getTemplates(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20, includePublic = false } = req.query;

      const templates = await Template.findByUserId(userId, {
        page: parseInt(page),
        limit: parseInt(limit),
        includePublic: includePublic === 'true',
      });

      const total = await Template.count(userId, includePublic === 'true');

      res.json({
        templates,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      logger.error('Get templates error:', error);
      res.status(500).json({ error: 'Failed to fetch templates' });
    }
  }

  async getPublicTemplates(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;

      const templates = await Template.findPublicTemplates({
        page: parseInt(page),
        limit: parseInt(limit),
      });

      res.json({
        templates,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
        },
      });
    } catch (error) {
      logger.error('Get public templates error:', error);
      res.status(500).json({ error: 'Failed to fetch public templates' });
    }
  }

  async getTemplateById(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const template = await Template.findById(id);

      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      // Check access: owner or public template
      if (template.userId !== userId && !template.isPublic) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Get usage stats
      const stats = await Template.getUsageStats(id);

      res.json({
        ...template,
        stats,
      });
    } catch (error) {
      logger.error('Get template error:', error);
      res.status(500).json({ error: 'Failed to fetch template' });
    }
  }

  async updateTemplate(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const updates = req.body;

      const template = await Template.findById(id);

      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      if (template.userId !== userId) {
        return res.status(403).json({ error: 'Only template owner can update' });
      }

      const updatedTemplate = await Template.update(id, updates);

      logger.info(`Template updated: ${id} by user ${userId}`);

      res.json(updatedTemplate);
    } catch (error) {
      logger.error('Update template error:', error);
      res.status(500).json({ error: 'Failed to update template' });
    }
  }

  async deleteTemplate(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const template = await Template.findById(id);

      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      if (template.userId !== userId) {
        return res.status(403).json({ error: 'Only template owner can delete' });
      }

      await Template.delete(id);

      logger.info(`Template deleted: ${id} by user ${userId}`);

      res.status(204).send();
    } catch (error) {
      logger.error('Delete template error:', error);
      res.status(500).json({ error: 'Failed to delete template' });
    }
  }

  async createTaskFromTemplate(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const { assignedTo, dueDate, customTitle, customDescription } = req.body;

      const template = await Template.findById(id);

      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      // Check access
      if (template.userId !== userId && !template.isPublic) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Create task from template
      const task = await Task.create({
        title: customTitle || template.title,
        description: customDescription || template.taskDescription,
        priority: template.priority,
        status: 'todo',
        dueDate: dueDate || null,
        tags: template.tags || [],
        createdBy: userId,
        assignedTo: assignedTo || userId,
      });

      // Log usage
      await Template.logUsage(id, userId, task.id);

      // Log activity
      await Comment.logActivity(task.id, userId, 'task_created_from_template', {
        templateName: template.name,
      });

      await cacheDelete(`user:${userId}:tasks`);

      logger.info(`Task ${task.id} created from template ${id} by user ${userId}`);

      res.status(201).json({
        task,
        template: {
          id: template.id,
          name: template.name,
          checklistItems: template.checklistItems,
        },
      });
    } catch (error) {
      logger.error('Create task from template error:', error);
      res.status(500).json({ error: 'Failed to create task from template' });
    }
  }

  async searchTemplates(req, res) {
    try {
      const { q, page = 1, limit = 20, publicOnly = false } = req.query;
      const userId = req.user.id;

      if (!q || q.trim().length === 0) {
        return res.status(400).json({ error: 'Search query is required' });
      }

      const templates = await Template.search(q.trim(), {
        page: parseInt(page),
        limit: parseInt(limit),
        publicOnly: publicOnly === 'true',
        userId: publicOnly === 'true' ? null : userId,
      });

      res.json({
        templates,
        query: q.trim(),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
        },
      });
    } catch (error) {
      logger.error('Search templates error:', error);
      res.status(500).json({ error: 'Failed to search templates' });
    }
  }

  async duplicateTemplate(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const template = await Template.findById(id);

      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      // Check access
      if (template.userId !== userId && !template.isPublic) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Create duplicate
      const duplicatedTemplate = await Template.create({
        userId,
        name: `${template.name} (Copy)`,
        description: template.description,
        title: template.title,
        taskDescription: template.taskDescription,
        priority: template.priority,
        tags: template.tags,
        checklistItems: template.checklistItems,
        isPublic: false, // Duplicates are always private
      });

      logger.info(`Template ${id} duplicated as ${duplicatedTemplate.id} by user ${userId}`);

      res.status(201).json(duplicatedTemplate);
    } catch (error) {
      logger.error('Duplicate template error:', error);
      res.status(500).json({ error: 'Failed to duplicate template' });
    }
  }
}

module.exports = new TemplateController();
