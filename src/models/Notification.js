const { query } = require('../database/connection');

class Notification {
  async create({ userId, type, title, message, relatedTaskId, relatedCommentId, actionUrl }) {
    const result = await query(
      `INSERT INTO notifications (user_id, type, title, message, related_task_id, related_comment_id, action_url, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [userId, type, title, message, relatedTaskId, relatedCommentId, actionUrl]
    );
    return this.mapNotification(result.rows[0]);
  }

  async findById(id) {
    const result = await query(
      `SELECT n.*,
              t.title as task_title
       FROM notifications n
       LEFT JOIN tasks t ON n.related_task_id = t.id
       WHERE n.id = $1`,
      [id]
    );
    return result.rows[0] ? this.mapNotification(result.rows[0]) : null;
  }

  async findByUserId(userId, { page = 1, limit = 20, unreadOnly = false }) {
    const offset = (page - 1) * limit;
    const conditions = ['user_id = $1'];
    const values = [userId];
    let paramCount = 2;

    if (unreadOnly) {
      conditions.push('read = false');
    }

    const whereClause = conditions.join(' AND ');

    const result = await query(
      `SELECT n.*,
              t.title as task_title
       FROM notifications n
       LEFT JOIN tasks t ON n.related_task_id = t.id
       WHERE ${whereClause}
       ORDER BY n.created_at DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      [...values, limit, offset]
    );

    return result.rows.map(row => this.mapNotification(row));
  }

  async count(userId, unreadOnly = false) {
    const conditions = ['user_id = $1'];
    const values = [userId];

    if (unreadOnly) {
      conditions.push('read = false');
    }

    const whereClause = conditions.join(' AND ');

    const result = await query(
      `SELECT COUNT(*) FROM notifications WHERE ${whereClause}`,
      values
    );

    return parseInt(result.rows[0].count);
  }

  async markAsRead(id) {
    const result = await query(
      `UPDATE notifications
       SET read = true, read_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return result.rows[0] ? this.mapNotification(result.rows[0]) : null;
  }

  async markAllAsRead(userId) {
    await query(
      `UPDATE notifications
       SET read = true, read_at = NOW()
       WHERE user_id = $1 AND read = false`,
      [userId]
    );
  }

  async delete(id) {
    await query('DELETE FROM notifications WHERE id = $1', [id]);
  }

  async deleteAllForUser(userId) {
    await query('DELETE FROM notifications WHERE user_id = $1', [userId]);
  }

  async deleteOld(daysOld = 30) {
    await query(
      `DELETE FROM notifications
       WHERE created_at < NOW() - INTERVAL '${daysOld} days'`,
      []
    );
  }

  mapNotification(row) {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      message: row.message,
      relatedTaskId: row.related_task_id,
      relatedCommentId: row.related_comment_id,
      actionUrl: row.action_url,
      read: row.read,
      readAt: row.read_at,
      createdAt: row.created_at,
      taskTitle: row.task_title,
    };
  }
}

module.exports = new Notification();
