const Attachment = require('../models/Attachment');
const Task = require('../models/Task');
const Comment = require('../models/Comment');
const logger = require('../utils/logger');
const { saveFile, deleteFile, generateFileName, formatFileSize, getFileIcon } = require('../utils/fileUtils');
const { emitToTask } = require('../websocket/handler');
const notificationService = require('../services/notificationService');

class AttachmentController {
  async uploadAttachments(req, res) {
    try {
      const { taskId } = req.params;
      const userId = req.user.id;
      const files = req.files;

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      // Verify task exists and user has access
      const task = await Task.findById(taskId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      if (task.createdBy !== userId && task.assignedTo !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const uploadedAttachments = [];

      for (const file of files) {
        const fileName = generateFileName(file.originalname);
        const filePath = await saveFile(file.buffer, fileName);

        const attachment = await Attachment.create({
          taskId,
          userId,
          fileName,
          originalName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          filePath,
        });

        uploadedAttachments.push({
          ...attachment,
          formattedSize: formatFileSize(file.size),
          icon: getFileIcon(file.mimetype),
        });
      }

      // Log activity
      const fileNames = uploadedAttachments.map(a => a.originalName).join(', ');
      await Comment.logActivity(
        taskId,
        userId,
        'files_uploaded',
        { count: uploadedAttachments.length, files: fileNames }
      );

      // Emit WebSocket event
      emitToTask(taskId, 'attachments:uploaded', {
        taskId,
        attachments: uploadedAttachments,
      });

      logger.info(`${uploadedAttachments.length} file(s) uploaded to task ${taskId} by user ${userId}`);

      res.status(201).json({
        message: `${uploadedAttachments.length} file(s) uploaded successfully`,
        attachments: uploadedAttachments,
      });
    } catch (error) {
      logger.error('Upload attachments error:', error);
      res.status(500).json({ error: 'Failed to upload files' });
    }
  }

  async getAttachments(req, res) {
    try {
      const { taskId } = req.params;
      const { page = 1, limit = 50 } = req.query;
      const userId = req.user.id;

      // Verify task exists and user has access
      const task = await Task.findById(taskId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      if (task.createdBy !== userId && task.assignedTo !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const attachments = await Attachment.findByTaskId(taskId, { page, limit });
      const total = await Attachment.count(taskId);
      const totalSize = await Attachment.getTotalSizeByTask(taskId);

      // Add formatted info to each attachment
      const enrichedAttachments = attachments.map(att => ({
        ...att,
        formattedSize: formatFileSize(att.fileSize),
        icon: getFileIcon(att.mimeType),
      }));

      res.json({
        attachments: enrichedAttachments,
        totalSize: totalSize,
        formattedTotalSize: formatFileSize(totalSize),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      logger.error('Get attachments error:', error);
      res.status(500).json({ error: 'Failed to fetch attachments' });
    }
  }

  async downloadAttachment(req, res) {
    try {
      const { taskId, attachmentId } = req.params;
      const userId = req.user.id;

      // Verify task exists and user has access
      const task = await Task.findById(taskId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      if (task.createdBy !== userId && task.assignedTo !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const attachment = await Attachment.findById(attachmentId);
      if (!attachment) {
        return res.status(404).json({ error: 'Attachment not found' });
      }

      if (attachment.taskId !== taskId) {
        return res.status(403).json({ error: 'Attachment does not belong to this task' });
      }

      logger.info(`File ${attachment.originalName} downloaded by user ${userId}`);

      res.download(attachment.filePath, attachment.originalName, (err) => {
        if (err) {
          logger.error('File download error:', err);
          if (!res.headersSent) {
            res.status(404).json({ error: 'File not found on server' });
          }
        }
      });
    } catch (error) {
      logger.error('Download attachment error:', error);
      res.status(500).json({ error: 'Failed to download file' });
    }
  }

  async deleteAttachment(req, res) {
    try {
      const { taskId, attachmentId } = req.params;
      const userId = req.user.id;

      // Verify task exists and user has access
      const task = await Task.findById(taskId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const attachment = await Attachment.findById(attachmentId);
      if (!attachment) {
        return res.status(404).json({ error: 'Attachment not found' });
      }

      if (attachment.taskId !== taskId) {
        return res.status(403).json({ error: 'Attachment does not belong to this task' });
      }

      // Only the uploader or task creator can delete attachments
      if (attachment.userId !== userId && task.createdBy !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Delete file from disk
      await deleteFile(attachment.filePath);

      // Delete from database
      await Attachment.delete(attachmentId);

      // Log activity
      await Comment.logActivity(
        taskId,
        userId,
        'file_deleted',
        { fileName: attachment.originalName }
      );

      // Emit WebSocket event
      emitToTask(taskId, 'attachment:deleted', {
        taskId,
        attachmentId,
      });

      logger.info(`Attachment ${attachmentId} deleted by user ${userId}`);

      res.status(204).send();
    } catch (error) {
      logger.error('Delete attachment error:', error);
      res.status(500).json({ error: 'Failed to delete attachment' });
    }
  }

  async getUserAttachments(req, res) {
    try {
      const userId = req.user.id;
      const { limit = 10 } = req.query;

      const recentAttachments = await Attachment.getRecentByUser(userId, parseInt(limit));
      const totalSize = await Attachment.getTotalSizeByUser(userId);

      const enrichedAttachments = recentAttachments.map(att => ({
        ...att,
        formattedSize: formatFileSize(att.fileSize),
        icon: getFileIcon(att.mimeType),
      }));

      res.json({
        attachments: enrichedAttachments,
        totalSize: totalSize,
        formattedTotalSize: formatFileSize(totalSize),
      });
    } catch (error) {
      logger.error('Get user attachments error:', error);
      res.status(500).json({ error: 'Failed to fetch user attachments' });
    }
  }
}

module.exports = new AttachmentController();
