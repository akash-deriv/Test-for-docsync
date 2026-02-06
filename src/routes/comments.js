const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// Comment routes for a specific task
router.post('/tasks/:taskId/comments', commentController.createComment);
router.get('/tasks/:taskId/comments', commentController.getComments);
router.get('/tasks/:taskId/activity', commentController.getActivityLog);
router.put('/tasks/:taskId/comments/:commentId', commentController.updateComment);
router.delete('/tasks/:taskId/comments/:commentId', commentController.deleteComment);

module.exports = router;
