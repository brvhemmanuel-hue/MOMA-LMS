const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/materials.controller');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const upload = require('../middleware/upload');

router.use(requireAuth);

router.get('/', asyncHandler(ctrl.listMaterials));
router.post('/', requireRole('teacher'), upload.single('file'), asyncHandler(ctrl.createMaterial));
router.delete('/:id', requireRole('teacher', 'admin'), asyncHandler(ctrl.deleteMaterial));

module.exports = router;
