const { query } = require('../database/connection');

class Template {
  async create({ userId, name, description, title, taskDescription, priority, tags, checklistItems, isPublic }) {
    const result = await query(
      `INSERT INTO templates (user_id, name, description, title, task_description, priority, tags, checklist_items, is_public, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING *`,
      [userId, name, description, title, taskDescription, priority, tags, checklistItems, isPublic || false]
    );
    return this.mapTemplate(result.rows[0]);
  }

  async findById(id) {
    const result = await query(
      `SELECT t.*,
              u.first_name as creator_first_name,
              u.last_name as creator_last_name,
              u.email as creator_email
       FROM templates t
       JOIN users u ON t.user_id = u.id
       WHERE t.id = $1`,
      [id]
    );
    return result.rows[0] ? this.mapTemplate(result.rows[0]) : null;
  }

  async findByUserId(userId, { page = 1, limit = 20, includePublic = false }) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const values = [userId];
    let paramCount = 2;

    if (includePublic) {
      conditions.push(`(t.user_id = $1 OR t.is_public = true)`);
    } else {
      conditions.push(`t.user_id = $1`);
    }

    const whereClause = conditions.join(' AND ');

    const result = await query(
      `SELECT t.*,
              u.first_name as creator_first_name,
              u.last_name as creator_last_name,
              u.email as creator_email
       FROM templates t
       JOIN users u ON t.user_id = u.id
       WHERE ${whereClause}
       ORDER BY t.created_at DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      [...values, limit, offset]
    );

    return result.rows.map(row => this.mapTemplate(row));
  }

  async findPublicTemplates({ page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT t.*,
              u.first_name as creator_first_name,
              u.last_name as creator_last_name,
              COUNT(tu.id) as usage_count
       FROM templates t
       JOIN users u ON t.user_id = u.id
       LEFT JOIN template_usage tu ON t.id = tu.template_id
       WHERE t.is_public = true
       GROUP BY t.id, u.first_name, u.last_name
       ORDER BY usage_count DESC, t.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return result.rows.map(row => this.mapTemplate(row));
  }

  async count(userId, includePublic = false) {
    if (includePublic) {
      const result = await query(
        'SELECT COUNT(*) FROM templates WHERE user_id = $1 OR is_public = true',
        [userId]
      );
      return parseInt(result.rows[0].count);
    } else {
      const result = await query(
        'SELECT COUNT(*) FROM templates WHERE user_id = $1',
        [userId]
      );
      return parseInt(result.rows[0].count);
    }
  }

  async update(id, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = ['name', 'description', 'title', 'task_description', 'priority', 'tags', 'checklist_items', 'is_public'];

    for (const field of allowedFields) {
      const snakeField = field;
      if (updates[this.camelToSnake(field)] !== undefined) {
        fields.push(`${snakeField} = $${paramCount++}`);
        values.push(updates[this.camelToSnake(field)]);
      }
    }

    if (fields.length === 0) {
      const template = await this.findById(id);
      return template;
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query(
      `UPDATE templates SET ${fields.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    return this.mapTemplate(result.rows[0]);
  }

  async delete(id) {
    await query('DELETE FROM templates WHERE id = $1', [id]);
  }

  async logUsage(templateId, userId, taskId) {
    await query(
      `INSERT INTO template_usage (template_id, user_id, task_id, used_at)
       VALUES ($1, $2, $3, NOW())`,
      [templateId, userId, taskId]
    );

    // Update usage count on template
    await query(
      `UPDATE templates
       SET usage_count = usage_count + 1
       WHERE id = $1`,
      [templateId]
    );
  }

  async getUsageStats(templateId) {
    const result = await query(
      `SELECT
        COUNT(*) as total_uses,
        COUNT(DISTINCT user_id) as unique_users,
        MAX(used_at) as last_used
       FROM template_usage
       WHERE template_id = $1`,
      [templateId]
    );

    return {
      totalUses: parseInt(result.rows[0].total_uses),
      uniqueUsers: parseInt(result.rows[0].unique_users),
      lastUsed: result.rows[0].last_used,
    };
  }

  async search(searchTerm, { page = 1, limit = 20, publicOnly = false, userId = null }) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const values = [];
    let paramCount = 1;

    conditions.push(`(t.name ILIKE $${paramCount} OR t.description ILIKE $${paramCount} OR t.title ILIKE $${paramCount})`);
    values.push(`%${searchTerm}%`);
    paramCount++;

    if (publicOnly) {
      conditions.push(`t.is_public = true`);
    } else if (userId) {
      conditions.push(`(t.user_id = $${paramCount} OR t.is_public = true)`);
      values.push(userId);
      paramCount++;
    }

    const whereClause = conditions.join(' AND ');

    const result = await query(
      `SELECT t.*,
              u.first_name as creator_first_name,
              u.last_name as creator_last_name
       FROM templates t
       JOIN users u ON t.user_id = u.id
       WHERE ${whereClause}
       ORDER BY t.usage_count DESC, t.created_at DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      [...values, limit, offset]
    );

    return result.rows.map(row => this.mapTemplate(row));
  }

  camelToSnake(str) {
    const snakeMap = {
      name: 'name',
      description: 'description',
      title: 'title',
      taskDescription: 'task_description',
      priority: 'priority',
      tags: 'tags',
      checklistItems: 'checklist_items',
      isPublic: 'is_public'
    };
    return snakeMap[str] || str;
  }

  mapTemplate(row) {
    const template = {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      title: row.title,
      taskDescription: row.task_description,
      priority: row.priority,
      tags: row.tags || [],
      checklistItems: row.checklist_items || [],
      isPublic: row.is_public,
      usageCount: row.usage_count || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    if (row.creator_first_name) {
      template.creator = {
        firstName: row.creator_first_name,
        lastName: row.creator_last_name,
        email: row.creator_email,
      };
    }

    return template;
  }
}

module.exports = new Template();
