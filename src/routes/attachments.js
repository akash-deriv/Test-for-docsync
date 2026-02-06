const express = require('express');
const router = express.Router();
const attachmentController = require('../controllers/attachmentController');
const { authenticateToken } = require('../middleware/auth');
const { upload, handleUploadError } = require('../middleware/upload');

router.use(authenticateToken);

// Get user's recent attachments
router.get('/user/attachments', attachmentController.getUserAttachments);

// Task attachment routes
router.post(
  '/tasks/:taskId/attachments',
  upload.array('files', 5),
  handleUploadError,
  attachmentController.uploadAttachments
);

router.get('/tasks/:taskId/attachments', attachmentController.getAttachments);

router.get(
  '/tasks/:taskId/attachments/:attachmentId/download',
  attachmentController.downloadAttachment
);

router.delete(
  '/tasks/:taskId/attachments/:attachmentId',
  attachmentController.deleteAttachment
);

module.exports = router;
