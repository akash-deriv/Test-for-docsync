const request = require('supertest');
const { app } = require('../src/index');
const Template = require('../src/models/Template');

describe('Template API', () => {
  let authToken;
  let userId;
  let templateId;

  beforeAll(async () => {
    // Setup: Register and login user
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'template@example.com',
        password: 'Test1234',
        firstName: 'Template',
        lastName: 'User'
      });

    authToken = registerRes.body.token;
    userId = registerRes.body.user.id;
  });

  describe('POST /api/templates', () => {
    it('should create a new template', async () => {
      const response = await request(app)
        .post('/api/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Bug Report Template',
          description: 'Template for reporting bugs',
          title: 'Bug: [Issue Description]',
          taskDescription: 'Steps to reproduce:\n1. \n2. \n\nExpected behavior:\n\nActual behavior:',
          priority: 'high',
          tags: ['bug', 'needs-review'],
          checklistItems: [
            { text: 'Verify bug reproduction', completed: false },
            { text: 'Add screenshots', completed: false },
            { text: 'Check console logs', completed: false }
          ],
          isPublic: false
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Bug Report Template');
      expect(response.body.title).toBe('Bug: [Issue Description]');
      expect(response.body.priority).toBe('high');
      expect(response.body.tags).toEqual(['bug', 'needs-review']);
      expect(response.body.checklistItems).toHaveLength(3);

      templateId = response.body.id;
    });

    it('should reject template without name', async () => {
      const response = await request(app)
        .post('/api/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Task',
          taskDescription: 'Description'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Template name is required');
    });

    it('should reject template without title', async () => {
      const response = await request(app)
        .post('/api/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Template',
          taskDescription: 'Description'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Task title is required');
    });
  });

  describe('GET /api/templates', () => {
    beforeAll(async () => {
      // Create multiple templates
      await Template.create({
        userId,
        name: 'Feature Request',
        description: 'Template for feature requests',
        title: 'Feature: New Feature',
        taskDescription: 'Description of the feature',
        priority: 'medium',
        tags: ['enhancement'],
        checklistItems: [],
        isPublic: false
      });
    });

    it('should get all templates for the user', async () => {
      const response = await request(app)
        .get('/api/templates')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('templates');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.templates)).toBe(true);
      expect(response.body.templates.length).toBeGreaterThan(0);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/templates?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(5);
    });
  });

  describe('GET /api/templates/:id', () => {
    it('should get a template by ID', async () => {
      const response = await request(app)
        .get(`/api/templates/${templateId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(templateId);
      expect(response.body).toHaveProperty('stats');
      expect(response.body.stats).toHaveProperty('totalUses');
      expect(response.body.stats).toHaveProperty('uniqueUsers');
    });

    it('should return 404 for non-existent template', async () => {
      const response = await request(app)
        .get('/api/templates/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/templates/:id', () => {
    it('should update a template', async () => {
      const response = await request(app)
        .put(`/api/templates/${templateId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Bug Report Template',
          priority: 'urgent'
        });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Bug Report Template');
      expect(response.body.priority).toBe('urgent');
    });

    it('should not allow updating others templates', async () => {
      // Create another user
      const otherUserRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'other-template@example.com',
          password: 'Test1234',
          firstName: 'Other',
          lastName: 'User'
        });

      const otherToken = otherUserRes.body.token;

      const response = await request(app)
        .put(`/api/templates/${templateId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          name: 'Trying to update'
        });

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/templates/:id/use', () => {
    it('should create a task from template', async () => {
      const response = await request(app)
        .post(`/api/templates/${templateId}/use`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customTitle: 'Bug: Login page not loading',
          customDescription: 'The login page shows a blank screen'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('task');
      expect(response.body).toHaveProperty('template');
      expect(response.body.task.title).toBe('Bug: Login page not loading');
      expect(response.body.task.description).toBe('The login page shows a blank screen');
      expect(response.body.task.priority).toBe('urgent'); // From template
      expect(response.body.template.checklistItems).toHaveLength(3);
    });

    it('should use template defaults if no custom values provided', async () => {
      const response = await request(app)
        .post(`/api/templates/${templateId}/use`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(201);
      expect(response.body.task.title).toBe('Bug: [Issue Description]'); // Template title
    });
  });

  describe('POST /api/templates/:id/duplicate', () => {
    it('should duplicate a template', async () => {
      const response = await request(app)
        .post(`/api/templates/${templateId}/duplicate`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(201);
      expect(response.body.name).toContain('(Copy)');
      expect(response.body.title).toBe('Bug: [Issue Description]');
      expect(response.body.isPublic).toBe(false); // Duplicates are private
    });
  });

  describe('GET /api/templates/search', () => {
    it('should search templates', async () => {
      const response = await request(app)
        .get('/api/templates/search?q=bug')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('templates');
      expect(response.body.query).toBe('bug');
      expect(Array.isArray(response.body.templates)).toBe(true);
    });

    it('should require search query', async () => {
      const response = await request(app)
        .get('/api/templates/search')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/templates/public', () => {
    beforeAll(async () => {
      // Create a public template
      await Template.create({
        userId,
        name: 'Public Meeting Notes',
        description: 'Template for meeting notes',
        title: 'Meeting: [Meeting Name]',
        taskDescription: 'Attendees:\n\nAgenda:\n\nNotes:\n\nAction Items:',
        priority: 'medium',
        tags: ['meeting'],
        checklistItems: [],
        isPublic: true
      });
    });

    it('should get public templates', async () => {
      const response = await request(app)
        .get('/api/templates/public')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('templates');
      expect(Array.isArray(response.body.templates)).toBe(true);
    });
  });

  describe('DELETE /api/templates/:id', () => {
    let deleteTemplateId;

    beforeEach(async () => {
      const template = await Template.create({
        userId,
        name: 'Template to Delete',
        description: 'This will be deleted',
        title: 'Task Title',
        taskDescription: 'Description',
        priority: 'low',
        tags: [],
        checklistItems: [],
        isPublic: false
      });
      deleteTemplateId = template.id;
    });

    it('should delete a template', async () => {
      const response = await request(app)
        .delete(`/api/templates/${deleteTemplateId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(204);

      // Verify deletion
      const template = await Template.findById(deleteTemplateId);
      expect(template).toBeNull();
    });

    it('should return 404 for non-existent template', async () => {
      const response = await request(app)
        .delete('/api/templates/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('Template Usage Tracking', () => {
    it('should increment usage count when template is used', async () => {
      const template = await Template.findById(templateId);
      const initialCount = template.usageCount;

      await request(app)
        .post(`/api/templates/${templateId}/use`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      const updatedTemplate = await Template.findById(templateId);
      expect(updatedTemplate.usageCount).toBe(initialCount + 1);
    });
  });
});
