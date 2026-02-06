const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../database/connection');

router.use(authenticateToken);

router.get('/overview', async (req, res) => {
  try {
    const result = await query(
      `SELECT
        COUNT(*) as total_tasks,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE status = 'todo') as todo,
        COUNT(*) FILTER (WHERE due_date < NOW() AND status != 'completed') as overdue
       FROM tasks
       WHERE assigned_to = $1`,
      [req.user.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

router.get('/productivity', async (req, res) => {
  try {
    const result = await query(
      `SELECT
        DATE(updated_at) as date,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_tasks
       FROM tasks
       WHERE assigned_to = $1 AND updated_at > NOW() - INTERVAL '30 days'
       GROUP BY DATE(updated_at)
       ORDER BY date DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch productivity data' });
  }
});

router.get('/trends', async (req, res) => {
  try {
    const result = await query(
      `SELECT
        priority,
        COUNT(*) as count,
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_completion_time
       FROM tasks
       WHERE assigned_to = $1 AND status = 'completed'
       GROUP BY priority`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

module.exports = router;
