const { query } = require('../database/connection');

class Task {
  async create({ title, description, priority, status, dueDate, tags, createdBy, assignedTo }) {
    const result = await query(
      `INSERT INTO tasks (title, description, priority, status, due_date, tags, created_by, assigned_to, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING *`,
      [title, description, priority, status, dueDate, tags, createdBy, assignedTo]
    );
    return this.mapTask(result.rows[0]);
  }

  async findById(id) {
    const result = await query(
      'SELECT * FROM tasks WHERE id = $1',
      [id]
    );
    return result.rows[0] ? this.mapTask(result.rows[0]) : null;
  }

  async findAll(filters, { page = 1, limit = 20 }) {
    const conditions = [];
    const values = [];
    let paramCount = 1;

    if (filters.userId) {
      conditions.push(`(created_by = $${paramCount} OR assigned_to = $${paramCount})`);
      values.push(filters.userId);
      paramCount++;
    }

    if (filters.status) {
      conditions.push(`status = $${paramCount++}`);
      values.push(filters.status);
    }

    if (filters.priority) {
      conditions.push(`priority = $${paramCount++}`);
      values.push(filters.priority);
    }

    if (filters.search) {
      conditions.push(`(title ILIKE $${paramCount} OR description ILIKE $${paramCount})`);
      values.push(`%${filters.search}%`);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT * FROM tasks ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      [...values, limit, offset]
    );

    return result.rows.map(row => this.mapTask(row));
  }

  async count(filters) {
    const conditions = [];
    const values = [];
    let paramCount = 1;

    if (filters.userId) {
      conditions.push(`(created_by = $${paramCount} OR assigned_to = $${paramCount})`);
      values.push(filters.userId);
      paramCount++;
    }

    if (filters.status) {
      conditions.push(`status = $${paramCount++}`);
      values.push(filters.status);
    }

    if (filters.priority) {
      conditions.push(`priority = $${paramCount++}`);
      values.push(filters.priority);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT COUNT(*) FROM tasks ${whereClause}`,
      values
    );

    return parseInt(result.rows[0].count);
  }

  async update(id, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = ['title', 'description', 'priority', 'status', 'due_date', 'tags', 'assigned_to'];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        fields.push(`${field} = $${paramCount++}`);
        values.push(updates[field]);
      }
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query(
      `UPDATE tasks SET ${fields.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    return this.mapTask(result.rows[0]);
  }

  async delete(id) {
    await query('DELETE FROM tasks WHERE id = $1', [id]);
  }

  mapTask(row) {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      priority: row.priority,
      status: row.status,
      dueDate: row.due_date,
      tags: row.tags,
      createdBy: row.created_by,
      assignedTo: row.assigned_to,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

module.exports = new Task();
