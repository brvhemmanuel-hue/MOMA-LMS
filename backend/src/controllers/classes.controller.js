const { query } = require('../config/db');

/**
 * Public on purpose: a new student needs to see the class list to pick
 * one before they have an account/token at all. Nothing sensitive is
 * exposed here - just names and descriptions.
 */
async function listClasses(req, res) {
  const rows = await query(
    `select c.*, count(u.id) filter (where u.role = 'student') as student_count
     from classes c
     left join users u on u.class_id = c.id
     group by c.id
     order by c.name asc`,
    []
  );
  res.json({ classes: rows });
}

async function createClass(req, res) {
  const { name, description } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Class name is required' });

  try {
    const rows = await query(
      `insert into classes (name, description, created_by) values ($1, $2, $3) returning *`,
      [name.trim(), description || null, req.user.id]
    );
    res.status(201).json({ class: rows[0] });
  } catch (error) {
    if (error.message.includes('duplicate key')) {
      return res.status(409).json({ error: `A class named "${name.trim()}" already exists` });
    }
    res.status(400).json({ error: error.message });
  }
}

async function updateClass(req, res) {
  const { name, description } = req.body;
  const update = {};
  if (name !== undefined) update.name = name.trim();
  if (description !== undefined) update.description = description;

  const fields = Object.keys(update);
  if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update' });

  const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
  const values = fields.map((f) => update[f]);
  values.push(req.params.id);

  try {
    const rows = await query(`update classes set ${setClause} where id = $${values.length} returning *`, values);
    if (!rows[0]) return res.status(404).json({ error: 'Class not found' });
    res.json({ class: rows[0] });
  } catch (error) {
    if (error.message.includes('duplicate key')) {
      return res.status(409).json({ error: 'A class with that name already exists' });
    }
    res.status(400).json({ error: error.message });
  }
}

/** Blocked if the class still has students, quizzes, exercises, or materials - same safety pattern as everywhere else that could silently orphan data. */
async function deleteClass(req, res) {
  const { id } = req.params;
  const classRows = await query('select id, name from classes where id = $1', [id]);
  if (!classRows[0]) return res.status(404).json({ error: 'Class not found' });

  const [studentCount, quizCount, exerciseCount, materialCount] = await Promise.all([
    query(`select count(*) as count from users where class_id = $1 and role = 'student'`, [id]),
    query('select count(*) as count from quizzes where class_id = $1', [id]),
    query('select count(*) as count from exercises where class_id = $1', [id]),
    query('select count(*) as count from materials where class_id = $1', [id]),
  ]);
  const counts = {
    students: Number(studentCount[0].count),
    quizzes: Number(quizCount[0].count),
    exercises: Number(exerciseCount[0].count),
    materials: Number(materialCount[0].count),
  };
  const blockers = Object.entries(counts).filter(([, n]) => n > 0);
  if (blockers.length > 0) {
    const summary = blockers.map(([label, n]) => `${n} ${label}`).join(', ');
    return res.status(400).json({
      error: `Cannot delete "${classRows[0].name}" while it still has ${summary}.`,
    });
  }

  await query('delete from classes where id = $1', [id]);
  res.json({ success: true });
}

module.exports = { listClasses, createClass, updateClass, deleteClass };
