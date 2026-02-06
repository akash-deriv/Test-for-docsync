const { query } = require('../database/connection');

class Comment {
  async create({ taskId, userId, content, type = 'comment' }) {
    const result = await query(
      `INSERT INTO comments (task_id, user_id, content, type, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [taskId, userId, content, type]
    );
    return this.mapComment(result.rows[0]);
  }

  async findById(id) {
    const result = await query(
      `SELECT c.*,
              u.first_name as user_first_name,
              u.last_name as user_last_name,
              u.email as user_email
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.id = $1`,
      [id]
    );
    return result.rows[0] ? this.mapComment(result.rows[0]) : null;
  }

  async findByTaskId(taskId, { page = 1, limit = 50 }) {
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT c.*,
              u.first_name as user_first_name,
              u.last_name as user_last_name,
              u.email as user_email
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.task_id = $1
       ORDER BY c.created_at DESC
       LIMIT $2 OFFSET $3`,
      [taskId, limit, offset]
    );

    return result.rows.map(row => this.mapComment(row));
  }

  async count(taskId) {
    const result = await query(
      'SELECT COUNT(*) FROM comments WHERE task_id = $1',
      [taskId]
    );
    return parseInt(result.rows[0].count);
  }

  async update(id, { content }) {
    const result = await query(
      `UPDATE comments
       SET content = $1, updated_at = NOW(), edited = true
       WHERE id = $2
       RETURNING *`,
      [content, id]
    );
    return this.mapComment(result.rows[0]);
  }

  async delete(id) {
    await query('DELETE FROM comments WHERE id = $1', [id]);
  }

  async getActivityLog(taskId, { page = 1, limit = 50 }) {
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT c.*,
              u.first_name as user_first_name,
              u.last_name as user_last_name,
              u.email as user_email
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.task_id = $1 AND c.type = 'activity'
       ORDER BY c.created_at DESC
       LIMIT $2 OFFSET $3`,
      [taskId, limit, offset]
    );

    return result.rows.map(row => this.mapComment(row));
  }

  async logActivity(taskId, userId, action, metadata = {}) {
    const content = this.formatActivityMessage(action, metadata);

    return await this.create({
      taskId,
      userId,
      content,
      type: 'activity'
    });
  }

  formatActivityMessage(action, metadata) {
    switch (action) {
      case 'status_changed':
        return `changed status from "${metadata.oldStatus}" to "${metadata.newStatus}"`;
      case 'priority_changed':
        return `changed priority from "${metadata.oldPriority}" to "${metadata.newPriority}"`;
      case 'assigned':
        return `assigned task to ${metadata.assigneeName}`;
      case 'due_date_changed':
        return `changed due date to ${metadata.newDueDate}`;
      case 'task_created':
        return 'created this task';
      case 'task_completed':
        return 'marked task as completed';
      case 'task_reopened':
        return 'reopened this task';
      case 'files_uploaded':
        return `uploaded ${metadata.count} file(s): ${metadata.files}`;
      case 'file_deleted':
        return `deleted file: ${metadata.fileName}`;
      case 'task_created_from_template':
        return `created this task from template: ${metadata.templateName}`;
      default:
        return `performed action: ${action}`;
    }
  }

  mapComment(row) {
    const comment = {
      id: row.id,
      taskId: row.task_id,
      userId: row.user_id,
      content: row.content,
      type: row.type,
      edited: row.edited || false,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    if (row.user_first_name) {
      comment.user = {
        firstName: row.user_first_name,
        lastName: row.user_last_name,
        email: row.user_email,
      };
    }

    return comment;
  }
}

module.exports = new Comment();
