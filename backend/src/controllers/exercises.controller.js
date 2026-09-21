const { query } = require('../config/db');
const { uploadBuffer, deleteBlob } = require('../utils/blob');
const { generateGradebookExcel } = require('../utils/excelReport');

async function listExercises(req, res) {
  if (req.user.role !== 'student') {
    const isAdmin = req.user.role === 'admin';
    const params = [];
    const conditions = [];
    if (!isAdmin) {
      params.push(req.user.id);
      conditions.push(`e.teacher_id = $${params.length}`);
    }
    if (req.query.class_id) {
      params.push(req.query.class_id);
      conditions.push(`e.class_id = $${params.length}`);
    }
    const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
    const rows = await query(
      `select e.*, c.name as class_name,
              (select count(*) from exercise_submissions where exercise_id = e.id) as submission_count,
              (select count(*) from exercise_submissions where exercise_id = e.id and grade is null) as pending_grading
       from exercises e
       join classes c on c.id = e.class_id
       ${where}
       order by e.created_at desc`,
      params
    );
    return res.json({ exercises: rows });
  }

  const rows = await query(
    `select e.*, c.name as class_name,
            s.id as submission_id, s.file_name as submission_file_name, s.submitted_at, s.grade, s.feedback
     from exercises e
     join classes c on c.id = e.class_id
     left join exercise_submissions s on s.exercise_id = e.id and s.student_id = $2
     where e.class_id = $1
     order by e.created_at desc`,
    [req.user.class_id, req.user.id]
  );
  res.json({ exercises: rows });
}

async function getExercise(req, res) {
  const rows = await query(
    `select e.*, c.name as class_name from exercises e join classes c on c.id = e.class_id where e.id = $1`,
    [req.params.id]
  );
  const exercise = rows[0];
  if (!exercise) return res.status(404).json({ error: 'Exercise not found' });

  if (req.user.role !== 'student') {
    if (req.user.role !== 'admin' && exercise.teacher_id !== req.user.id) return res.status(403).json({ error: 'You can only view exercises you created' });
    const submissions = await query(
      `select s.*, u.full_name, u.email
       from exercise_submissions s
       join users u on u.id = s.student_id
       where s.exercise_id = $1
       order by s.submitted_at desc`,
      [req.params.id]
    );
    return res.json({ exercise, submissions });
  }

  if (exercise.class_id !== req.user.class_id) return res.status(403).json({ error: 'This exercise is not available to you' });
  const submissionRows = await query(
    'select * from exercise_submissions where exercise_id = $1 and student_id = $2',
    [req.params.id, req.user.id]
  );
  res.json({ exercise, submission: submissionRows[0] || null });
}

/** multipart/form-data with an optional 'attachment' file field. */
async function createExercise(req, res) {
  const { title, description, class_id, due_date, max_score } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
  if (!class_id) return res.status(400).json({ error: 'class_id is required' });

  let attachment_url = null;
  let attachment_name = null;
  if (req.file) {
    const uploaded = await uploadBuffer(req.file.buffer, req.file.originalname, 'exercise-attachments');
    attachment_url = uploaded.url;
    attachment_name = uploaded.name;
  }

  try {
    const rows = await query(
      `insert into exercises (title, description, class_id, teacher_id, due_date, attachment_url, attachment_name, max_score)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning *`,
      [title.trim(), description || null, class_id, req.user.id, due_date || null, attachment_url, attachment_name, max_score || 100]
    );
    res.status(201).json({ exercise: rows[0] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

async function updateExercise(req, res) {
  const existingRows = await query('select * from exercises where id = $1', [req.params.id]);
  const existing = existingRows[0];
  if (!existing) return res.status(404).json({ error: 'Exercise not found' });
  if (req.user.role !== 'admin' && existing.teacher_id !== req.user.id) return res.status(403).json({ error: 'You can only edit exercises you created' });

  const { title, description, due_date, max_score } = req.body;
  const update = {};
  if (title !== undefined) update.title = title.trim();
  if (description !== undefined) update.description = description;
  if (due_date !== undefined) update.due_date = due_date || null;
  if (max_score !== undefined) update.max_score = max_score;

  if (req.file) {
    const uploaded = await uploadBuffer(req.file.buffer, req.file.originalname, 'exercise-attachments');
    if (existing.attachment_url) await deleteBlob(existing.attachment_url);
    update.attachment_url = uploaded.url;
    update.attachment_name = uploaded.name;
  }

  const fields = Object.keys(update);
  if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update' });

  const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
  const values = fields.map((f) => update[f]);
  values.push(req.params.id);

  try {
    const rows = await query(`update exercises set ${setClause} where id = $${values.length} returning *`, values);
    res.json({ exercise: rows[0] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

async function deleteExercise(req, res) {
  const rows = await query('select teacher_id, attachment_url from exercises where id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Exercise not found' });
  if (req.user.role !== 'admin' && rows[0].teacher_id !== req.user.id) return res.status(403).json({ error: 'You can only delete exercises you created' });

  if (rows[0].attachment_url) await deleteBlob(rows[0].attachment_url);
  await query('delete from exercises where id = $1', [req.params.id]);
  res.json({ success: true });
}

/** Student submits (or resubmits) their work. multipart/form-data, field 'file'. */
async function submitExercise(req, res) {
  if (!req.file) return res.status(400).json({ error: 'Please attach a file' });

  const exerciseRows = await query('select * from exercises where id = $1', [req.params.id]);
  const exercise = exerciseRows[0];
  if (!exercise) return res.status(404).json({ error: 'Exercise not found' });
  if (exercise.class_id !== req.user.class_id) return res.status(403).json({ error: 'This exercise is not available to you' });

  const existing = await query(
    'select * from exercise_submissions where exercise_id = $1 and student_id = $2',
    [req.params.id, req.user.id]
  );
  if (existing[0] && existing[0].grade !== null) {
    return res.status(403).json({
      error: 'This submission has already been graded and can no longer be replaced. Ask your teacher if you need to resubmit.',
    });
  }

  const uploaded = await uploadBuffer(req.file.buffer, req.file.originalname, 'exercise-submissions');
  const isLate = exercise.due_date ? new Date() > new Date(exercise.due_date) : false;

  if (existing[0]?.file_url) await deleteBlob(existing[0].file_url);

  const rows = await query(
    `insert into exercise_submissions (exercise_id, student_id, file_url, file_name)
     values ($1, $2, $3, $4)
     on conflict (exercise_id, student_id) do update
       set file_url = excluded.file_url, file_name = excluded.file_name, submitted_at = now(), grade = null, feedback = null, graded_at = null
     returning *`,
    [req.params.id, req.user.id, uploaded.url, uploaded.name]
  );

  res.status(201).json({ submission: rows[0], is_late: isLate });
}

async function gradeSubmission(req, res) {
  const { grade, feedback } = req.body;
  if (grade === undefined || Number(grade) < 0) return res.status(400).json({ error: 'grade must be a non-negative number' });

  const rows = await query(
    `select s.*, e.teacher_id, e.max_score from exercise_submissions s join exercises e on e.id = s.exercise_id where s.id = $1`,
    [req.params.submissionId]
  );
  const submission = rows[0];
  if (!submission) return res.status(404).json({ error: 'Submission not found' });
  if (req.user.role !== 'admin' && submission.teacher_id !== req.user.id) return res.status(403).json({ error: 'You can only grade exercises you created' });

  const capped = Math.min(Number(grade), Number(submission.max_score));
  const updated = await query(
    `update exercise_submissions set grade = $1, feedback = $2, graded_at = now() where id = $3 returning *`,
    [capped, feedback || null, req.params.submissionId]
  );
  res.json({ submission: updated[0] });
}

async function exportGrades(req, res) {
  const exerciseRows = await query(
    `select e.*, c.name as class_name from exercises e join classes c on c.id = e.class_id where e.id = $1`,
    [req.params.id]
  );
  const exercise = exerciseRows[0];
  if (!exercise) return res.status(404).json({ error: 'Exercise not found' });
  if (req.user.role !== 'admin' && exercise.teacher_id !== req.user.id) return res.status(403).json({ error: 'You can only export exercises you created' });

  const students = await query(
    `select u.full_name, u.email, s.grade, s.submitted_at, s.file_name
     from users u
     left join exercise_submissions s on s.student_id = u.id and s.exercise_id = $1
     where u.role = 'student' and u.class_id = $2
     order by u.full_name asc`,
    [req.params.id, exercise.class_id]
  );

  const rows = students.map((s) => [
    s.full_name,
    s.email,
    s.submitted_at ? new Date(s.submitted_at).toLocaleString() : 'Not submitted',
    s.grade !== null && s.grade !== undefined ? Number(s.grade) : '-',
    exercise.max_score,
    s.grade !== null && s.grade !== undefined ? 'Graded' : s.submitted_at ? 'Pending grading' : 'Not submitted',
  ]);

  const buffer = await generateGradebookExcel({
    title: `${exercise.title} - Grades`,
    subtitle: `${exercise.class_name} - generated ${new Date().toLocaleString()}`,
    columns: ['Student Name', 'Email', 'Submitted At', 'Grade', 'Max Score', 'Status'],
    rows,
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${exercise.title.replace(/[^a-z0-9]/gi, '-')}-grades.xlsx"`);
  res.send(Buffer.from(buffer));
}

module.exports = {
  listExercises,
  getExercise,
  createExercise,
  updateExercise,
  deleteExercise,
  submitExercise,
  gradeSubmission,
  exportGrades,
};
