const Notification = require('../models/Notification');
const User = require('../models/User');
const { emitToUser } = require('../websocket/handler');
const logger = require('../utils/logger');

class NotificationService {
  async notifyTaskAssignment(taskId, taskTitle, assignedToUserId, assignedByUserId) {
    try {
      if (assignedToUserId === assignedByUserId) {
        return; // Don't notify if user assigned task to themselves
      }

      const assignedByUser = await User.findById(assignedByUserId);
      const assignerName = `${assignedByUser.firstName} ${assignedByUser.lastName}`;

      const notification = await Notification.create({
        userId: assignedToUserId,
        type: 'task_assigned',
        title: 'New Task Assignment',
        message: `${assignerName} assigned you to "${taskTitle}"`,
        relatedTaskId: taskId,
        actionUrl: `/tasks/${taskId}`,
      });

      emitToUser(assignedToUserId, 'notification:new', notification);
      logger.info(`Task assignment notification sent to user ${assignedToUserId}`);

      return notification;
    } catch (error) {
      logger.error('Task assignment notification error:', error);
    }
  }

  async notifyTaskStatusChange(taskId, taskTitle, newStatus, userId, taskCreatorId, taskAssignedToId) {
    try {
      const user = await User.findById(userId);
      const userName = `${user.firstName} ${user.lastName}`;

      const recipients = new Set([taskCreatorId, taskAssignedToId]);
      recipients.delete(userId); // Don't notify the user who made the change

      for (const recipientId of recipients) {
        if (recipientId) {
          const notification = await Notification.create({
            userId: recipientId,
            type: 'task_status_changed',
            title: 'Task Status Updated',
            message: `${userName} changed "${taskTitle}" status to ${newStatus}`,
            relatedTaskId: taskId,
            actionUrl: `/tasks/${taskId}`,
          });

          emitToUser(recipientId, 'notification:new', notification);
        }
      }

      logger.info(`Task status change notifications sent for task ${taskId}`);
    } catch (error) {
      logger.error('Task status change notification error:', error);
    }
  }

  async notifyNewComment(taskId, taskTitle, commentContent, commenterId, taskCreatorId, taskAssignedToId) {
    try {
      const commenter = await User.findById(commenterId);
      const commenterName = `${commenter.firstName} ${commenter.lastName}`;

      const recipients = new Set([taskCreatorId, taskAssignedToId]);
      recipients.delete(commenterId); // Don't notify the commenter

      const preview = commentContent.length > 50
        ? commentContent.substring(0, 50) + '...'
        : commentContent;

      for (const recipientId of recipients) {
        if (recipientId) {
          const notification = await Notification.create({
            userId: recipientId,
            type: 'new_comment',
            title: 'New Comment',
            message: `${commenterName} commented on "${taskTitle}": ${preview}`,
            relatedTaskId: taskId,
            actionUrl: `/tasks/${taskId}#comments`,
          });

          emitToUser(recipientId, 'notification:new', notification);
        }
      }

      logger.info(`New comment notifications sent for task ${taskId}`);
    } catch (error) {
      logger.error('New comment notification error:', error);
    }
  }

  async notifyTaskDueSoon(taskId, taskTitle, assignedToUserId, dueDate) {
    try {
      const notification = await Notification.create({
        userId: assignedToUserId,
        type: 'task_due_soon',
        title: 'Task Due Soon',
        message: `"${taskTitle}" is due on ${new Date(dueDate).toLocaleDateString()}`,
        relatedTaskId: taskId,
        actionUrl: `/tasks/${taskId}`,
      });

      emitToUser(assignedToUserId, 'notification:new', notification);
      logger.info(`Due soon notification sent for task ${taskId}`);

      return notification;
    } catch (error) {
      logger.error('Task due soon notification error:', error);
    }
  }

  async notifyTaskCompleted(taskId, taskTitle, completedByUserId, taskCreatorId) {
    try {
      if (completedByUserId === taskCreatorId) {
        return; // Don't notify if creator completed their own task
      }

      const completedByUser = await User.findById(completedByUserId);
      const userName = `${completedByUser.firstName} ${completedByUser.lastName}`;

      const notification = await Notification.create({
        userId: taskCreatorId,
        type: 'task_completed',
        title: 'Task Completed',
        message: `${userName} completed "${taskTitle}"`,
        relatedTaskId: taskId,
        actionUrl: `/tasks/${taskId}`,
      });

      emitToUser(taskCreatorId, 'notification:new', notification);
      logger.info(`Task completion notification sent for task ${taskId}`);

      return notification;
    } catch (error) {
      logger.error('Task completion notification error:', error);
    }
  }

  async notifyMentionInComment(taskId, taskTitle, mentionedUserId, commenterId, commentContent) {
    try {
      if (mentionedUserId === commenterId) {
        return; // Don't notify if user mentioned themselves
      }

      const commenter = await User.findById(commenterId);
      const commenterName = `${commenter.firstName} ${commenter.lastName}`;

      const preview = commentContent.length > 50
        ? commentContent.substring(0, 50) + '...'
        : commentContent;

      const notification = await Notification.create({
        userId: mentionedUserId,
        type: 'mentioned',
        title: 'You Were Mentioned',
        message: `${commenterName} mentioned you in "${taskTitle}": ${preview}`,
        relatedTaskId: taskId,
        actionUrl: `/tasks/${taskId}#comments`,
      });

      emitToUser(mentionedUserId, 'notification:new', notification);
      logger.info(`Mention notification sent to user ${mentionedUserId}`);

      return notification;
    } catch (error) {
      logger.error('Mention notification error:', error);
    }
  }
}

module.exports = new NotificationService();
