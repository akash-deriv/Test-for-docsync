const Task = require('../models/Task');
const Comment = require('../models/Comment');
const logger = require('../utils/logger');
const { cacheGet, cacheSet, cacheDelete } = require('../cache/redis');
const { emitTaskUpdate } = require('../websocket/handler');
const notificationService = require('../services/notificationService');

class TaskController {
  async createTask(req, res) {
    try {
      const { title, description, priority, dueDate, tags, assignedTo } = req.body;
      const userId = req.user.id;

      const task = await Task.create({
        title,
        description,
        priority: priority || 'medium',
        status: 'todo',
        dueDate,
        tags: tags || [],
        createdBy: userId,
        assignedTo: assignedTo || userId,
      });

      // Log task creation activity
      await Comment.logActivity(task.id, userId, 'task_created');

      // Send notification if assigned to someone else
      if (assignedTo && assignedTo !== userId) {
        await notificationService.notifyTaskAssignment(
          task.id,
          task.title,
          assignedTo,
          userId
        );
      }

      await cacheDelete(`user:${userId}:tasks`);
      emitTaskUpdate('task:created', task);

      logger.info(`Task created: ${task.id} by user ${userId}`);

      res.status(201).json(task);
    } catch (error) {
      logger.error('Task creation error:', error);
      res.status(500).json({ error: 'Failed to create task' });
    }
  }

  async getTasks(req, res) {
    try {
      const userId = req.user.id;
      const { status, priority, search, page = 1, limit = 20 } = req.query;

      const cacheKey = `user:${userId}:tasks:${status}:${priority}:${search}:${page}`;
      const cached = await cacheGet(cacheKey);

      if (cached) {
        return res.json(JSON.parse(cached));
      }

      const filters = { userId };
      if (status) filters.status = status;
      if (priority) filters.priority = priority;
      if (search) filters.search = search;

      const tasks = await Task.findAll(filters, { page, limit });
      const total = await Task.count(filters);

      const response = {
        tasks,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      };

      await cacheSet(cacheKey, JSON.stringify(response), 300);

      res.json(response);
    } catch (error) {
      logger.error('Get tasks error:', error);
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  }

  async getTaskById(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const task = await Task.findById(id);

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      if (task.createdBy !== userId && task.assignedTo !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json(task);
    } catch (error) {
      logger.error('Get task error:', error);
      res.status(500).json({ error: 'Failed to fetch task' });
    }
  }

  async updateTask(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const updates = req.body;

      const task = await Task.findById(id);

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      if (task.createdBy !== userId && task.assignedTo !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const updatedTask = await Task.update(id, updates);

      // Log activity for specific changes
      if (updates.status && updates.status !== task.status) {
        await Comment.logActivity(id, userId, 'status_changed', {
          oldStatus: task.status,
          newStatus: updates.status
        });

        // Notify about status change
        await notificationService.notifyTaskStatusChange(
          id,
          task.title,
          updates.status,
          userId,
          task.createdBy,
          task.assignedTo
        );

        if (updates.status === 'completed') {
          await Comment.logActivity(id, userId, 'task_completed');

          // Notify task creator about completion
          await notificationService.notifyTaskCompleted(
            id,
            task.title,
            userId,
            task.createdBy
          );
        }
      }

      if (updates.priority && updates.priority !== task.priority) {
        await Comment.logActivity(id, userId, 'priority_changed', {
          oldPriority: task.priority,
          newPriority: updates.priority
        });
      }

      if (updates.assignedTo && updates.assignedTo !== task.assignedTo) {
        await Comment.logActivity(id, userId, 'assigned', {
          assigneeName: 'User'
        });

        // Notify new assignee
        await notificationService.notifyTaskAssignment(
          id,
          task.title,
          updates.assignedTo,
          userId
        );
      }

      if (updates.dueDate && updates.dueDate !== task.dueDate) {
        await Comment.logActivity(id, userId, 'due_date_changed', {
          newDueDate: updates.dueDate
        });
      }

      await cacheDelete(`user:${userId}:tasks`);
      emitTaskUpdate('task:updated', updatedTask);

      logger.info(`Task updated: ${id} by user ${userId}`);

      res.json(updatedTask);
    } catch (error) {
      logger.error('Update task error:', error);
      res.status(500).json({ error: 'Failed to update task' });
    }
  }

  async deleteTask(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const task = await Task.findById(id);

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      if (task.createdBy !== userId) {
        return res.status(403).json({ error: 'Only task creator can delete' });
      }

      await Task.delete(id);

      await cacheDelete(`user:${userId}:tasks`);
      emitTaskUpdate('task:deleted', { id });

      logger.info(`Task deleted: ${id} by user ${userId}`);

      res.status(204).send();
    } catch (error) {
      logger.error('Delete task error:', error);
      res.status(500).json({ error: 'Failed to delete task' });
    }
  }
}

module.exports = new TaskController();
