const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/quizzes.controller');
const attempts = require('../controllers/quizAttempts.controller');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const upload = require('../middleware/upload');

router.use(requireAuth);

// Fixed sub-paths first, so they aren't swallowed by the "/:id" pattern below.
router.get('/template.docx', requireRole('teacher'), asyncHandler(ctrl.downloadTemplate));
router.post('/parse-docx', requireRole('teacher'), upload.single('file'), asyncHandler(ctrl.parseDocx));

router.get('/', asyncHandler(ctrl.listQuizzes));
router.post('/', requireRole('teacher'), asyncHandler(ctrl.createQuiz));

router.get('/:id', asyncHandler(ctrl.getQuiz));
router.put('/:id', requireRole('teacher', 'admin'), asyncHandler(ctrl.updateQuiz));
router.delete('/:id', requireRole('teacher', 'admin'), asyncHandler(ctrl.deleteQuiz));

router.post('/:id/attempts', requireRole('student'), asyncHandler(attempts.startAttempt));
router.post('/:id/attempts/submit', requireRole('student'), asyncHandler(attempts.submitAttempt));
router.get('/:id/attempts/mine', requireRole('student'), asyncHandler(attempts.myAttempts));
router.get('/:id/attempts/export', requireRole('teacher', 'admin'), asyncHandler(attempts.exportGradebook));
router.get('/:id/attempts/student/:studentId', requireRole('teacher', 'admin'), asyncHandler(attempts.studentAttemptDetail));
router.get('/:id/attempts', requireRole('teacher', 'admin'), asyncHandler(attempts.gradebook));
router.put('/:id/attempts/:attemptId/answers/:answerId', requireRole('teacher', 'admin'), asyncHandler(attempts.gradeAnswer));

module.exports = router;
