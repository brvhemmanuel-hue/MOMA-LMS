const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/users.controller');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.use(requireAuth);
router.use(requireRole('teacher', 'admin'));

router.get('/students', asyncHandler(ctrl.listStudents));
router.put('/students/:id', asyncHandler(ctrl.updateStudent));
router.delete('/students/:id', asyncHandler(ctrl.deleteStudent));
router.get('/students/:id/report', asyncHandler(ctrl.studentReport));

router.get('/teachers', requireRole('admin'), asyncHandler(ctrl.listTeachers));
router.put('/teachers/:id', requireRole('admin'), asyncHandler(ctrl.updateTeacher));
router.delete('/teachers/:id', requireRole('admin'), asyncHandler(ctrl.deleteTeacher));

module.exports = router;
