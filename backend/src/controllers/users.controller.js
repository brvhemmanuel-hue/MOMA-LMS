const { query } = require('../config/db');

/** Class ids a teacher is associated with: classes they created, or have used for a quiz/exercise/material. */
async function teacherClassIds(teacherId) {
  const rows = await query(
    `select distinct id from (
       select id from classes where created_by = $1
       union
       select class_id as id from quizzes where teacher_id = $1
       union
       select class_id as id from exercises where teacher_id = $1
       union
       select class_id as id from materials where teacher_id = $1
     ) t`,
    [teacherId]
  );
  return rows.map((r) => r.id);
}

/**
 * Lists students. Admins see everyone; teachers see students only in the
 * classes they're associated with (created, or used for their content).
 */
async function listStudents(req, res) {
  const { class_id } = req.query;
  const isAdmin = req.user.role === 'admin';

  let allowedClassIds = null;
  if (!isAdmin) {
    allowedClassIds = await teacherClassIds(req.user.id);
    if (class_id && !allowedClassIds.includes(class_id)) {
      return res.status(403).json({ error: 'You do not have access to this class' });
    }
    if (!class_id && allowedClassIds.length === 0) {
      return res.json({ students: [] });
    }
  }

  const conditions = [`u.role = 'student'`];
  const params = [];
  if (class_id) {
    params.push(class_id);
    conditions.push(`u.class_id = $${params.length}`);
  } else if (!isAdmin) {
    params.push(allowedClassIds);
    conditions.push(`u.class_id = any($${params.length}::uuid[])`);
  }

  const rows = await query(
    `select u.id, u.full_name, u.email, u.class_id, u.is_active, u.created_at, c.name as class_name
     from users u
     left join classes c on c.id = u.class_id
     where ${conditions.join(' and ')}
     order by u.full_name asc`,
    params
  );
  res.json({ students: rows });
}

async function assertStudentAccess(req, target) {
  if (req.user.role === 'admin') return null;
  const allowed = await teacherClassIds(req.user.id);
  if (!allowed.includes(target.class_id)) return 'You do not have access to this student';
  return { allowed };
}

async function updateStudent(req, res) {
  const targetRows = await query("select * from users where id = $1 and role = 'student'", [req.params.id]);
  const target = targetRows[0];
  if (!target) return res.status(404).json({ error: 'Student not found' });

  const { full_name, email, class_id, is_active } = req.body;

  if (req.user.role !== 'admin') {
    const access = await assertStudentAccess(req, target);
    if (typeof access === 'string') return res.status(403).json({ error: access });
    if (class_id && !access.allowed.includes(class_id)) {
      return res.status(403).json({ error: 'You do not have access to that class' });
    }
  }

  const update = {};
  if (full_name !== undefined) update.full_name = full_name.trim();
  if (email !== undefined) update.email = email.trim().toLowerCase();
  if (class_id !== undefined) update.class_id = class_id;
  if (is_active !== undefined) update.is_active = is_active;

  const fields = Object.keys(update);
  if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update' });

  const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
  const values = fields.map((f) => update[f]);
  values.push(req.params.id);

  try {
    const rows = await query(
      `update users set ${setClause} where id = $${values.length}
       returning id, full_name, email, class_id, is_active, created_at`,
      values
    );
    res.json({ student: rows[0] });
  } catch (error) {
    if (error.message.includes('duplicate key')) return res.status(409).json({ error: 'That email is already in use' });
    res.status(400).json({ error: error.message });
  }
}

async function deleteStudent(req, res) {
  const targetRows = await query("select * from users where id = $1 and role = 'student'", [req.params.id]);
  const target = targetRows[0];
  if (!target) return res.status(404).json({ error: 'Student not found' });

  if (req.user.role !== 'admin') {
    const access = await assertStudentAccess(req, target);
    if (typeof access === 'string') return res.status(403).json({ error: access });
  }

  await query('delete from users where id = $1', [req.params.id]);
  res.json({ success: true });
}

/** Admin only: an oversight list of every teacher and how much content they've created. */
async function listTeachers(req, res) {
  const rows = await query(
    `select u.id, u.full_name, u.email, u.is_active, u.created_at,
            (select count(*) from quizzes where teacher_id = u.id) as quiz_count,
            (select count(*) from exercises where teacher_id = u.id) as exercise_count,
            (select count(*) from materials where teacher_id = u.id) as material_count
     from users u
     where u.role = 'teacher'
     order by u.full_name asc`
  );
  res.json({ teachers: rows });
}

/** Full quiz + exercise score history for one student, for a teacher (scoped) or admin (unrestricted). */
async function studentReport(req, res) {
  const targetRows = await query(
    "select id, full_name, email, class_id, created_at from users where id = $1 and role = 'student'",
    [req.params.id]
  );
  const target = targetRows[0];
  if (!target) return res.status(404).json({ error: 'Student not found' });

  if (req.user.role !== 'admin') {
    const access = await assertStudentAccess(req, target);
    if (typeof access === 'string') return res.status(403).json({ error: access });
  }

  const [classRows, quizAttempts, exerciseGrades] = await Promise.all([
    target.class_id ? query('select name from classes where id = $1', [target.class_id]) : Promise.resolve([]),
    query(
      `select q.id as quiz_id, q.title, qa.attempt_number, qa.score, qa.max_score, qa.status, qa.submitted_at
       from quiz_attempts qa join quizzes q on q.id = qa.quiz_id
       where qa.student_id = $1
       order by qa.submitted_at desc nulls last`,
      [req.params.id]
    ),
    query(
      `select e.id as exercise_id, e.title, s.grade, e.max_score, s.submitted_at, s.graded_at
       from exercise_submissions s join exercises e on e.id = s.exercise_id
       where s.student_id = $1
       order by s.submitted_at desc`,
      [req.params.id]
    ),
  ]);

  res.json({
    student: { ...target, class_name: classRows[0]?.name || null },
    quiz_attempts: quizAttempts,
    exercise_grades: exerciseGrades,
  });
}

module.exports = { listStudents, updateStudent, deleteStudent, listTeachers, studentReport, teacherClassIds };
