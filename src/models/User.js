const { query } = require('../database/connection');

class User {
  async create({ email, password, firstName, lastName }) {
    const result = await query(
      `INSERT INTO users (email, password, first_name, last_name, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, email, first_name as "firstName", last_name as "lastName", created_at as "createdAt"`,
      [email, password, firstName, lastName]
    );
    return result.rows[0];
  }

  async findByEmail(email) {
    const result = await query(
      `SELECT id, email, password, first_name as "firstName", last_name as "lastName",
              created_at as "createdAt", last_login as "lastLogin"
       FROM users WHERE email = $1`,
      [email]
    );
    return result.rows[0];
  }

  async findById(id) {
    const result = await query(
      `SELECT id, email, first_name as "firstName", last_name as "lastName",
              created_at as "createdAt", last_login as "lastLogin"
       FROM users WHERE id = $1`,
      [id]
    );
    return result.rows[0];
  }

  async updateLastLogin(id) {
    await query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [id]
    );
  }

  async update(id, { firstName, lastName, email }) {
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (firstName) {
      updates.push(`first_name = $${paramCount++}`);
      values.push(firstName);
    }
    if (lastName) {
      updates.push(`last_name = $${paramCount++}`);
      values.push(lastName);
    }
    if (email) {
      updates.push(`email = $${paramCount++}`);
      values.push(email);
    }

    values.push(id);

    const result = await query(
      `UPDATE users SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id, email, first_name as "firstName", last_name as "lastName"`,
      values
    );
    return result.rows[0];
  }

  async getStats(userId) {
    const result = await query(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'completed') as completed_tasks,
        COUNT(*) FILTER (WHERE status = 'todo') as pending_tasks,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_tasks
       FROM tasks WHERE assigned_to = $1`,
      [userId]
    );
    return result.rows[0];
  }
}

module.exports = new User();
