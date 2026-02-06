const request = require('supertest');
const { app } = require('../src/index');
const Comment = require('../src/models/Comment');
const Task = require('../src/models/Task');

describe('Comment API', () => {
  let authToken;
  let userId;
  let taskId;

  beforeAll(async () => {
    // Setup: Register and login user
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'Test1234',
        firstName: 'Test',
        lastName: 'User'
      });

    authToken = registerRes.body.token;
    userId = registerRes.body.user.id;

    // Create a test task
    const taskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Test Task',
        description: 'Test task for comments',
        priority: 'high'
      });

    taskId = taskRes.body.id;
  });

  describe('POST /api/tasks/:taskId/comments', () => {
    it('should create a new comment', async () => {
      const response = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'This is a test comment'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.content).toBe('This is a test comment');
      expect(response.body.type).toBe('comment');
    });

    it('should reject empty comment', async () => {
      const response = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: '   '
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Comment content is required');
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .send({
          content: 'Test comment'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/tasks/:taskId/comments', () => {
    beforeAll(async () => {
      // Create multiple comments
      await Comment.create({
        taskId,
        userId,
        content: 'First comment',
        type: 'comment'
      });

      await Comment.create({
        taskId,
        userId,
        content: 'Second comment',
        type: 'comment'
      });
    });

    it('should retrieve all comments for a task', async () => {
      const response = await request(app)
        .get(`/api/tasks/${taskId}/comments`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('comments');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.comments)).toBe(true);
      expect(response.body.comments.length).toBeGreaterThan(0);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get(`/api/tasks/${taskId}/comments?page=1&limit=2`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(2);
    });
  });

  describe('GET /api/tasks/:taskId/activity', () => {
    it('should retrieve activity log for a task', async () => {
      const response = await request(app)
        .get(`/api/tasks/${taskId}/activity`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('activities');
      expect(Array.isArray(response.body.activities)).toBe(true);
    });
  });

  describe('PUT /api/tasks/:taskId/comments/:commentId', () => {
    let commentId;

    beforeAll(async () => {
      const comment = await Comment.create({
        taskId,
        userId,
        content: 'Original comment',
        type: 'comment'
      });
      commentId = comment.id;
    });

    it('should update a comment', async () => {
      const response = await request(app)
        .put(`/api/tasks/${taskId}/comments/${commentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Updated comment content'
        });

      expect(response.status).toBe(200);
      expect(response.body.content).toBe('Updated comment content');
      expect(response.body.edited).toBe(true);
    });

    it('should not allow updating other users comments', async () => {
      // Create another user
      const otherUserRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'other@example.com',
          password: 'Test1234',
          firstName: 'Other',
          lastName: 'User'
        });

      const otherToken = otherUserRes.body.token;

      const response = await request(app)
        .put(`/api/tasks/${taskId}/comments/${commentId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          content: 'Trying to update'
        });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/tasks/:taskId/comments/:commentId', () => {
    let commentId;

    beforeAll(async () => {
      const comment = await Comment.create({
        taskId,
        userId,
        content: 'Comment to delete',
        type: 'comment'
      });
      commentId = comment.id;
    });

    it('should delete a comment', async () => {
      const response = await request(app)
        .delete(`/api/tasks/${taskId}/comments/${commentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(204);
    });

    it('should not delete non-existent comment', async () => {
      const response = await request(app)
        .delete(`/api/tasks/${taskId}/comments/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('Activity Logging', () => {
    it('should log activity when task status changes', async () => {
      const response = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'in_progress'
        });

      expect(response.status).toBe(200);

      // Check activity log
      const activityRes = await request(app)
        .get(`/api/tasks/${taskId}/activity`)
        .set('Authorization', `Bearer ${authToken}`);

      const statusChangeActivity = activityRes.body.activities.find(
        a => a.content.includes('status')
      );

      expect(statusChangeActivity).toBeDefined();
    });

    it('should log activity when task is completed', async () => {
      const response = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'completed'
        });

      expect(response.status).toBe(200);

      // Check for completion activity
      const activityRes = await request(app)
        .get(`/api/tasks/${taskId}/activity`)
        .set('Authorization', `Bearer ${authToken}`);

      const completedActivity = activityRes.body.activities.find(
        a => a.content.includes('completed')
      );

      expect(completedActivity).toBeDefined();
    });
  });
});
