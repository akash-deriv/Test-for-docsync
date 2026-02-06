const request = require('supertest');
const fs = require('fs').promises;
const path = require('path');
const { app } = require('../src/index');
const Attachment = require('../src/models/Attachment');
const { UPLOAD_DIR } = require('../src/utils/fileUtils');

describe('Attachment API', () => {
  let authToken;
  let userId;
  let taskId;

  beforeAll(async () => {
    // Setup: Register and login user
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'attachtest@example.com',
        password: 'Test1234',
        firstName: 'Attach',
        lastName: 'Test'
      });

    authToken = registerRes.body.token;
    userId = registerRes.body.user.id;

    // Create a test task
    const taskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Test Task for Attachments',
        description: 'Test task',
        priority: 'medium'
      });

    taskId = taskRes.body.id;

    // Ensure upload directory exists
    try {
      await fs.access(UPLOAD_DIR);
    } catch {
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
    }
  });

  describe('POST /api/tasks/:taskId/attachments', () => {
    it('should upload a file to a task', async () => {
      const testFilePath = path.join(__dirname, 'test-file.txt');
      await fs.writeFile(testFilePath, 'This is a test file content');

      const response = await request(app)
        .post(`/api/tasks/${taskId}/attachments`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('files', testFilePath);

      expect(response.status).toBe(201);
      expect(response.body.attachments).toHaveLength(1);
      expect(response.body.attachments[0]).toHaveProperty('id');
      expect(response.body.attachments[0].originalName).toBe('test-file.txt');
      expect(response.body.attachments[0].mimeType).toBe('text/plain');

      // Cleanup test file
      await fs.unlink(testFilePath);
    });

    it('should upload multiple files', async () => {
      const testFile1 = path.join(__dirname, 'test-file1.txt');
      const testFile2 = path.join(__dirname, 'test-file2.txt');

      await fs.writeFile(testFile1, 'File 1 content');
      await fs.writeFile(testFile2, 'File 2 content');

      const response = await request(app)
        .post(`/api/tasks/${taskId}/attachments`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('files', testFile1)
        .attach('files', testFile2);

      expect(response.status).toBe(201);
      expect(response.body.attachments).toHaveLength(2);

      // Cleanup test files
      await fs.unlink(testFile1);
      await fs.unlink(testFile2);
    });

    it('should reject upload without files', async () => {
      const response = await request(app)
        .post(`/api/tasks/${taskId}/attachments`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No files uploaded');
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .post(`/api/tasks/${taskId}/attachments`);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/tasks/:taskId/attachments', () => {
    beforeAll(async () => {
      // Upload a test file
      const testFilePath = path.join(__dirname, 'test-get.txt');
      await fs.writeFile(testFilePath, 'Test content');

      await request(app)
        .post(`/api/tasks/${taskId}/attachments`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('files', testFilePath);

      await fs.unlink(testFilePath);
    });

    it('should get all attachments for a task', async () => {
      const response = await request(app)
        .get(`/api/tasks/${taskId}/attachments`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('attachments');
      expect(response.body).toHaveProperty('totalSize');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.attachments)).toBe(true);
      expect(response.body.attachments.length).toBeGreaterThan(0);
    });

    it('should include file metadata', async () => {
      const response = await request(app)
        .get(`/api/tasks/${taskId}/attachments`)
        .set('Authorization', `Bearer ${authToken}`);

      const attachment = response.body.attachments[0];
      expect(attachment).toHaveProperty('fileName');
      expect(attachment).toHaveProperty('originalName');
      expect(attachment).toHaveProperty('mimeType');
      expect(attachment).toHaveProperty('fileSize');
      expect(attachment).toHaveProperty('formattedSize');
      expect(attachment).toHaveProperty('icon');
      expect(attachment).toHaveProperty('uploader');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get(`/api/tasks/${taskId}/attachments?page=1&limit=5`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(5);
    });
  });

  describe('GET /api/tasks/:taskId/attachments/:attachmentId/download', () => {
    let attachmentId;

    beforeAll(async () => {
      const testFilePath = path.join(__dirname, 'test-download.txt');
      await fs.writeFile(testFilePath, 'Download test content');

      const uploadRes = await request(app)
        .post(`/api/tasks/${taskId}/attachments`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('files', testFilePath);

      attachmentId = uploadRes.body.attachments[0].id;

      await fs.unlink(testFilePath);
    });

    it('should download an attachment', async () => {
      const response = await request(app)
        .get(`/api/tasks/${taskId}/attachments/${attachmentId}/download`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
    });

    it('should return 404 for non-existent attachment', async () => {
      const response = await request(app)
        .get(`/api/tasks/${taskId}/attachments/00000000-0000-0000-0000-000000000000/download`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/tasks/:taskId/attachments/:attachmentId', () => {
    let attachmentId;

    beforeEach(async () => {
      const testFilePath = path.join(__dirname, 'test-delete.txt');
      await fs.writeFile(testFilePath, 'Delete test content');

      const uploadRes = await request(app)
        .post(`/api/tasks/${taskId}/attachments`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('files', testFilePath);

      attachmentId = uploadRes.body.attachments[0].id;

      await fs.unlink(testFilePath);
    });

    it('should delete an attachment', async () => {
      const response = await request(app)
        .delete(`/api/tasks/${taskId}/attachments/${attachmentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(204);

      // Verify attachment is deleted
      const attachment = await Attachment.findById(attachmentId);
      expect(attachment).toBeNull();
    });

    it('should return 404 for non-existent attachment', async () => {
      const response = await request(app)
        .delete(`/api/tasks/${taskId}/attachments/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/user/attachments', () => {
    it('should get recent attachments for the user', async () => {
      const response = await request(app)
        .get('/api/user/attachments?limit=10')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('attachments');
      expect(response.body).toHaveProperty('totalSize');
      expect(response.body).toHaveProperty('formattedTotalSize');
      expect(Array.isArray(response.body.attachments)).toBe(true);
    });
  });

  describe('File Validation', () => {
    it('should reject disallowed file types', async () => {
      const testFilePath = path.join(__dirname, 'test-exe.exe');
      await fs.writeFile(testFilePath, 'fake executable');

      const response = await request(app)
        .post(`/api/tasks/${taskId}/attachments`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('files', testFilePath);

      expect(response.status).toBe(400);

      await fs.unlink(testFilePath);
    });
  });
});
