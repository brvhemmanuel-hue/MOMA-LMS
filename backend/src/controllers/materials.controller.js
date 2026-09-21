const { query } = require('../config/db');
const { uploadBuffer, deleteBlob } = require('../utils/blob');

async function listMaterials(req, res) {
  if (req.user.role !== 'student') {
    const isAdmin = req.user.role === 'admin';
    const params = [];
    const conditions = [];
    if (!isAdmin) {
      params.push(req.user.id);
      conditions.push(`m.teacher_id = $${params.length}`);
    }
    if (req.query.class_id) {
      params.push(req.query.class_id);
      conditions.push(`m.class_id = $${params.length}`);
    }
    const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
    const rows = await query(
      `select m.*, c.name as class_name from materials m join classes c on c.id = m.class_id ${where} order by m.created_at desc`,
      params
    );
    return res.json({ materials: rows });
  }

  const rows = await query(
    `select m.*, c.name as class_name, u.full_name as teacher_name
     from materials m
     join classes c on c.id = m.class_id
     join users u on u.id = m.teacher_id
     where m.class_id = $1
     order by m.created_at desc`,
    [req.user.class_id]
  );
  res.json({ materials: rows });
}

/** multipart/form-data, field 'file'. */
async function createMaterial(req, res) {
  if (!req.file) return res.status(400).json({ error: 'Please attach a file' });

  const { title, description, class_id } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
  if (!class_id) return res.status(400).json({ error: 'class_id is required' });

  const uploaded = await uploadBuffer(req.file.buffer, req.file.originalname, 'materials');

  try {
    const rows = await query(
      `insert into materials (title, description, class_id, teacher_id, file_url, file_name)
       values ($1, $2, $3, $4, $5, $6)
       returning *`,
      [title.trim(), description || null, class_id, req.user.id, uploaded.url, uploaded.name]
    );
    res.status(201).json({ material: rows[0] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

async function deleteMaterial(req, res) {
  const rows = await query('select teacher_id, file_url from materials where id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Material not found' });
  if (req.user.role !== 'admin' && rows[0].teacher_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only delete materials you uploaded' });
  }

  await deleteBlob(rows[0].file_url);
  await query('delete from materials where id = $1', [req.params.id]);
  res.json({ success: true });
}

module.exports = { listMaterials, createMaterial, deleteMaterial };
