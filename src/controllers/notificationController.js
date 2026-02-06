const Notification = require('../models/Notification');
const logger = require('../utils/logger');
const { emitToUser } = require('../websocket/handler');

class NotificationController {
  async getNotifications(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20, unreadOnly = false } = req.query;

      const notifications = await Notification.findByUserId(userId, {
        page: parseInt(page),
        limit: parseInt(limit),
        unreadOnly: unreadOnly === 'true',
      });

      const total = await Notification.count(userId, unreadOnly === 'true');
      const unreadCount = await Notification.count(userId, true);

      res.json({
        notifications,
        unreadCount,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      logger.error('Get notifications error:', error);
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  }

  async getUnreadCount(req, res) {
    try {
      const userId = req.user.id;
      const count = await Notification.count(userId, true);

      res.json({ unreadCount: count });
    } catch (error) {
      logger.error('Get unread count error:', error);
      res.status(500).json({ error: 'Failed to fetch unread count' });
    }
  }

  async markAsRead(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const notification = await Notification.findById(id);

      if (!notification) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      if (notification.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const updatedNotification = await Notification.markAsRead(id);

      logger.info(`Notification ${id} marked as read by user ${userId}`);

      res.json(updatedNotification);
    } catch (error) {
      logger.error('Mark notification as read error:', error);
      res.status(500).json({ error: 'Failed to mark notification as read' });
    }
  }

  async markAllAsRead(req, res) {
    try {
      const userId = req.user.id;

      await Notification.markAllAsRead(userId);

      logger.info(`All notifications marked as read for user ${userId}`);

      res.json({ message: 'All notifications marked as read' });
    } catch (error) {
      logger.error('Mark all as read error:', error);
      res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
  }

  async deleteNotification(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const notification = await Notification.findById(id);

      if (!notification) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      if (notification.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await Notification.delete(id);

      logger.info(`Notification ${id} deleted by user ${userId}`);

      res.status(204).send();
    } catch (error) {
      logger.error('Delete notification error:', error);
      res.status(500).json({ error: 'Failed to delete notification' });
    }
  }

  async deleteAllNotifications(req, res) {
    try {
      const userId = req.user.id;

      await Notification.deleteAllForUser(userId);

      logger.info(`All notifications deleted for user ${userId}`);

      res.json({ message: 'All notifications deleted' });
    } catch (error) {
      logger.error('Delete all notifications error:', error);
      res.status(500).json({ error: 'Failed to delete all notifications' });
    }
  }
}

module.exports = new NotificationController();
