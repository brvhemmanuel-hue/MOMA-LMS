const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/dashboard.controller');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.use(requireAuth);

router.get('/teacher', requireRole('teacher'), asyncHandler(ctrl.teacherDashboard));
router.get('/student', requireRole('student'), asyncHandler(ctrl.studentDashboard));
router.get('/admin', requireRole('admin'), asyncHandler(ctrl.adminDashboard));

module.exports = router;
