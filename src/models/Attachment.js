const { query } = require('../database/connection');

class Attachment {
  async create({ taskId, userId, fileName, originalName, mimeType, fileSize, filePath }) {
    const result = await query(
      `INSERT INTO attachments (task_id, user_id, file_name, original_name, mime_type, file_size, file_path, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [taskId, userId, fileName, originalName, mimeType, fileSize, filePath]
    );
    return this.mapAttachment(result.rows[0]);
  }

  async findById(id) {
    const result = await query(
      `SELECT a.*,
              u.first_name as uploader_first_name,
              u.last_name as uploader_last_name,
              u.email as uploader_email
       FROM attachments a
       JOIN users u ON a.user_id = u.id
       WHERE a.id = $1`,
      [id]
    );
    return result.rows[0] ? this.mapAttachment(result.rows[0]) : null;
  }

  async findByTaskId(taskId, { page = 1, limit = 50 }) {
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT a.*,
              u.first_name as uploader_first_name,
              u.last_name as uploader_last_name,
              u.email as uploader_email
       FROM attachments a
       JOIN users u ON a.user_id = u.id
       WHERE a.task_id = $1
       ORDER BY a.created_at DESC
       LIMIT $2 OFFSET $3`,
      [taskId, limit, offset]
    );

    return result.rows.map(row => this.mapAttachment(row));
  }

  async count(taskId) {
    const result = await query(
      'SELECT COUNT(*) FROM attachments WHERE task_id = $1',
      [taskId]
    );
    return parseInt(result.rows[0].count);
  }

  async delete(id) {
    const result = await query(
      'DELETE FROM attachments WHERE id = $1 RETURNING file_path, file_name',
      [id]
    );
    return result.rows[0];
  }

  async deleteByTaskId(taskId) {
    const result = await query(
      'DELETE FROM attachments WHERE task_id = $1 RETURNING file_path, file_name',
      [taskId]
    );
    return result.rows;
  }

  async getTotalSizeByUser(userId) {
    const result = await query(
      'SELECT COALESCE(SUM(file_size), 0) as total_size FROM attachments WHERE user_id = $1',
      [userId]
    );
    return parseInt(result.rows[0].total_size);
  }

  async getTotalSizeByTask(taskId) {
    const result = await query(
      'SELECT COALESCE(SUM(file_size), 0) as total_size FROM attachments WHERE task_id = $1',
      [taskId]
    );
    return parseInt(result.rows[0].total_size);
  }

  async getRecentByUser(userId, limit = 10) {
    const result = await query(
      `SELECT a.*,
              t.title as task_title
       FROM attachments a
       JOIN tasks t ON a.task_id = t.id
       WHERE a.user_id = $1
       ORDER BY a.created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows.map(row => this.mapAttachment(row));
  }

  mapAttachment(row) {
    const attachment = {
      id: row.id,
      taskId: row.task_id,
      userId: row.user_id,
      fileName: row.file_name,
      originalName: row.original_name,
      mimeType: row.mime_type,
      fileSize: row.file_size,
      filePath: row.file_path,
      createdAt: row.created_at,
    };

    if (row.uploader_first_name) {
      attachment.uploader = {
        firstName: row.uploader_first_name,
        lastName: row.uploader_last_name,
        email: row.uploader_email,
      };
    }

    if (row.task_title) {
      attachment.taskTitle = row.task_title;
    }

    return attachment;
  }
}

module.exports = new Attachment();
