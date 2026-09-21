const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/classes.controller');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

// Public: a new student needs to see the class list before they have an account.
router.get('/', asyncHandler(ctrl.listClasses));

router.post('/', requireAuth, requireRole('teacher', 'admin'), asyncHandler(ctrl.createClass));
router.put('/:id', requireAuth, requireRole('teacher', 'admin'), asyncHandler(ctrl.updateClass));
router.delete('/:id', requireAuth, requireRole('teacher', 'admin'), asyncHandler(ctrl.deleteClass));

module.exports = router;
