const express = require('express');
const router = express.Router();
const templateController = require('../controllers/templateController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// Search templates
router.get('/search', templateController.searchTemplates);

// Public templates
router.get('/public', templateController.getPublicTemplates);

// Template CRUD
router.post('/', templateController.createTemplate);
router.get('/', templateController.getTemplates);
router.get('/:id', templateController.getTemplateById);
router.put('/:id', templateController.updateTemplate);
router.delete('/:id', templateController.deleteTemplate);

// Template actions
router.post('/:id/use', templateController.createTaskFromTemplate);
router.post('/:id/duplicate', templateController.duplicateTemplate);

module.exports = router;
