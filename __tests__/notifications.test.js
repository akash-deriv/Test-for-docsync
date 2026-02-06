const request = require('supertest');
const { app } = require('../src/index');
const Notification = require('../src/models/Notification');
const Task = require('../src/models/Task');

describe('Notification API', () => {
  let authToken;
  let userId;
  let otherUserToken;
  let otherUserId;

  beforeAll(async () => {
    // Setup: Register first user
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'user1@example.com',
        password: 'Test1234',
        firstName: 'User',
        lastName: 'One'
      });

    authToken = registerRes.body.token;
    userId = registerRes.body.user.id;

    // Register second user
    const otherUserRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'user2@example.com',
        password: 'Test1234',
        firstName: 'User',
        lastName: 'Two'
      });

    otherUserToken = otherUserRes.body.token;
    otherUserId = otherUserRes.body.user.id;
  });

  describe('GET /api/notifications', () => {
    beforeAll(async () => {
      // Create some test notifications
      await Notification.create({
        userId,
        type: 'task_assigned',
        title: 'New Task',
        message: 'You have been assigned a new task',
        relatedTaskId: null,
        actionUrl: '/tasks/123',
      });

      await Notification.create({
        userId,
        type: 'new_comment',
        title: 'New Comment',
        message: 'Someone commented on your task',
        relatedTaskId: null,
        actionUrl: '/tasks/456',
      });
    });

    it('should get all notifications for the user', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('notifications');
      expect(response.body).toHaveProperty('unreadCount');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.notifications)).toBe(true);
      expect(response.body.notifications.length).toBeGreaterThan(0);
    });

    it('should filter unread notifications only', async () => {
      const response = await request(app)
        .get('/api/notifications?unreadOnly=true')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.notifications.every(n => !n.read)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/notifications?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(5);
    });
  });

  describe('GET /api/notifications/unread-count', () => {
    it('should get unread notification count', async () => {
      const response = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('unreadCount');
      expect(typeof response.body.unreadCount).toBe('number');
    });
  });

  describe('PUT /api/notifications/:id/read', () => {
    let notificationId;

    beforeAll(async () => {
      const notification = await Notification.create({
        userId,
        type: 'task_assigned',
        title: 'Test Notification',
        message: 'This is a test notification',
        relatedTaskId: null,
        actionUrl: '/tasks/test',
      });
      notificationId = notification.id;
    });

    it('should mark notification as read', async () => {
      const response = await request(app)
        .put(`/api/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.read).toBe(true);
      expect(response.body.readAt).toBeTruthy();
    });

    it('should not allow marking others notifications as read', async () => {
      const response = await request(app)
        .put(`/api/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('PUT /api/notifications/read-all', () => {
    it('should mark all notifications as read', async () => {
      const response = await request(app)
        .put('/api/notifications/read-all')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('All notifications marked as read');

      // Verify all are read
      const notificationsRes = await request(app)
        .get('/api/notifications?unreadOnly=true')
        .set('Authorization', `Bearer ${authToken}`);

      expect(notificationsRes.body.notifications.length).toBe(0);
    });
  });

  describe('DELETE /api/notifications/:id', () => {
    let notificationId;

    beforeAll(async () => {
      const notification = await Notification.create({
        userId,
        type: 'task_assigned',
        title: 'To be deleted',
        message: 'This notification will be deleted',
        relatedTaskId: null,
        actionUrl: '/tasks/delete',
      });
      notificationId = notification.id;
    });

    it('should delete a notification', async () => {
      const response = await request(app)
        .delete(`/api/notifications/${notificationId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(204);
    });

    it('should return 404 for non-existent notification', async () => {
      const response = await request(app)
        .delete(`/api/notifications/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('Notification Triggers', () => {
    it('should create notification when task is assigned', async () => {
      const taskRes = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Task for Assignment',
          description: 'Test description',
          assignedTo: otherUserId,
        });

      expect(taskRes.status).toBe(201);

      // Check if notification was created for other user
      const notificationsRes = await request(app)
        .get('/api/notifications?unreadOnly=true')
        .set('Authorization', `Bearer ${otherUserToken}`);

      const assignmentNotification = notificationsRes.body.notifications.find(
        n => n.type === 'task_assigned' && n.relatedTaskId === taskRes.body.id
      );

      expect(assignmentNotification).toBeDefined();
    });

    it('should create notification when comment is added', async () => {
      // Create a task assigned to other user
      const taskRes = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Task for Comment Test',
          assignedTo: otherUserId,
        });

      const taskId = taskRes.body.id;

      // Add a comment as the other user
      await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({
          content: 'This is a test comment',
        });

      // Check if creator got notification
      const notificationsRes = await request(app)
        .get('/api/notifications?unreadOnly=true')
        .set('Authorization', `Bearer ${authToken}`);

      const commentNotification = notificationsRes.body.notifications.find(
        n => n.type === 'new_comment' && n.relatedTaskId === taskId
      );

      expect(commentNotification).toBeDefined();
    });

    it('should create notification when task status changes', async () => {
      // Create a task
      const taskRes = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Task for Status Change',
          assignedTo: otherUserId,
        });

      const taskId = taskRes.body.id;

      // Update status as other user
      await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({
          status: 'in_progress',
        });

      // Check if creator got notification
      const notificationsRes = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`);

      const statusNotification = notificationsRes.body.notifications.find(
        n => n.type === 'task_status_changed' && n.relatedTaskId === taskId
      );

      expect(statusNotification).toBeDefined();
    });
  });
});
