const Comment = require('../models/Comment');
const Task = require('../models/Task');
const logger = require('../utils/logger');
const { cacheDelete } = require('../cache/redis');
const { emitCommentUpdate } = require('../websocket/handler');

class CommentController {
  async createComment(req, res) {
    try {
      const { taskId } = req.params;
      const { content } = req.body;
      const userId = req.user.id;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: 'Comment content is required' });
      }

      const task = await Task.findById(taskId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      if (task.createdBy !== userId && task.assignedTo !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const comment = await Comment.create({
        taskId,
        userId,
        content: content.trim(),
        type: 'comment'
      });

      await cacheDelete(`task:${taskId}:comments`);
      emitCommentUpdate('comment:created', comment);

      logger.info(`Comment created on task ${taskId} by user ${userId}`);

      res.status(201).json(comment);
    } catch (error) {
      logger.error('Create comment error:', error);
      res.status(500).json({ error: 'Failed to create comment' });
    }
  }

  async getComments(req, res) {
    try {
      const { taskId } = req.params;
      const { page = 1, limit = 50, includeActivity = false } = req.query;
      const userId = req.user.id;

      const task = await Task.findById(taskId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      if (task.createdBy !== userId && task.assignedTo !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      let comments;
      if (includeActivity === 'true') {
        comments = await Comment.findByTaskId(taskId, { page, limit });
      } else {
        comments = await Comment.findByTaskId(taskId, { page, limit });
        comments = comments.filter(c => c.type === 'comment');
      }

      const total = await Comment.count(taskId);

      res.json({
        comments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      logger.error('Get comments error:', error);
      res.status(500).json({ error: 'Failed to fetch comments' });
    }
  }

  async getActivityLog(req, res) {
    try {
      const { taskId } = req.params;
      const { page = 1, limit = 50 } = req.query;
      const userId = req.user.id;

      const task = await Task.findById(taskId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      if (task.createdBy !== userId && task.assignedTo !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const activities = await Comment.getActivityLog(taskId, { page, limit });

      res.json({
        activities,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
        },
      });
    } catch (error) {
      logger.error('Get activity log error:', error);
      res.status(500).json({ error: 'Failed to fetch activity log' });
    }
  }

  async updateComment(req, res) {
    try {
      const { taskId, commentId } = req.params;
      const { content } = req.body;
      const userId = req.user.id;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: 'Comment content is required' });
      }

      const comment = await Comment.findById(commentId);
      if (!comment) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      if (comment.userId !== userId) {
        return res.status(403).json({ error: 'Can only edit your own comments' });
      }

      if (comment.type === 'activity') {
        return res.status(400).json({ error: 'Cannot edit activity log entries' });
      }

      const updatedComment = await Comment.update(commentId, {
        content: content.trim()
      });

      await cacheDelete(`task:${taskId}:comments`);
      emitCommentUpdate('comment:updated', updatedComment);

      logger.info(`Comment ${commentId} updated by user ${userId}`);

      res.json(updatedComment);
    } catch (error) {
      logger.error('Update comment error:', error);
      res.status(500).json({ error: 'Failed to update comment' });
    }
  }

  async deleteComment(req, res) {
    try {
      const { taskId, commentId } = req.params;
      const userId = req.user.id;

      const comment = await Comment.findById(commentId);
      if (!comment) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      const task = await Task.findById(taskId);
      const isTaskOwner = task.createdBy === userId;
      const isCommentOwner = comment.userId === userId;

      if (!isTaskOwner && !isCommentOwner) {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (comment.type === 'activity') {
        return res.status(400).json({ error: 'Cannot delete activity log entries' });
      }

      await Comment.delete(commentId);

      await cacheDelete(`task:${taskId}:comments`);
      emitCommentUpdate('comment:deleted', { id: commentId, taskId });

      logger.info(`Comment ${commentId} deleted by user ${userId}`);

      res.status(204).send();
    } catch (error) {
      logger.error('Delete comment error:', error);
      res.status(500).json({ error: 'Failed to delete comment' });
    }
  }
}

module.exports = new CommentController();
