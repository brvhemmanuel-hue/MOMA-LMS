const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/exercises.controller');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const upload = require('../middleware/upload');

router.use(requireAuth);

router.get('/', asyncHandler(ctrl.listExercises));
router.post('/', requireRole('teacher'), upload.single('attachment'), asyncHandler(ctrl.createExercise));

router.get('/:id', asyncHandler(ctrl.getExercise));
router.put('/:id', requireRole('teacher', 'admin'), upload.single('attachment'), asyncHandler(ctrl.updateExercise));
router.delete('/:id', requireRole('teacher', 'admin'), asyncHandler(ctrl.deleteExercise));

router.get('/:id/export', requireRole('teacher', 'admin'), asyncHandler(ctrl.exportGrades));
router.post('/:id/submissions', requireRole('student'), upload.single('file'), asyncHandler(ctrl.submitExercise));
router.put('/:id/submissions/:submissionId', requireRole('teacher', 'admin'), asyncHandler(ctrl.gradeSubmission));

module.exports = router;
