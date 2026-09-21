const { query, withTransaction } = require('../config/db');
const { parseQuizDocx } = require('../utils/docxQuizParser');
const { generateQuizTemplate } = require('../utils/docxTemplateGenerator');

/**
 * List quizzes. Teachers see the ones they created (optionally filtered to
 * one class); students see published quizzes for their own class, each
 * annotated with their own attempt count/best score so the list can show
 * "Not started" / "In progress" / "Completed" without a second request.
 */
async function listQuizzes(req, res) {
  if (req.user.role !== 'student') {
    const isAdmin = req.user.role === 'admin';
    const params = [];
    const conditions = [];
    if (!isAdmin) {
      params.push(req.user.id);
      conditions.push(`q.teacher_id = $${params.length}`);
    }
    if (req.query.class_id) {
      params.push(req.query.class_id);
      conditions.push(`q.class_id = $${params.length}`);
    }
    const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
    const rows = await query(
      `select q.*, c.name as class_name,
              (select count(*) from quiz_questions where quiz_id = q.id) as question_count,
              (select count(distinct student_id) from quiz_attempts where quiz_id = q.id) as attempted_count,
              (select count(*) from quiz_attempts qa
                 join quiz_answers qan on qan.attempt_id = qa.id
                 join quiz_questions qq on qq.id = qan.question_id
                 where qa.quiz_id = q.id and qq.question_type = 'short_answer' and qan.is_correct is null) as pending_grading
       from quizzes q
       join classes c on c.id = q.class_id
       ${where}
       order by q.created_at desc`,
      params
    );
    return res.json({ quizzes: rows });
  }

  // student
  const rows = await query(
    `select q.*, c.name as class_name,
            (select count(*) from quiz_questions where quiz_id = q.id) as question_count,
            (select count(*) from quiz_attempts where quiz_id = q.id and student_id = $2) as attempts_used,
            (select max(score) from quiz_attempts where quiz_id = q.id and student_id = $2) as best_score,
            (select max_score from quiz_attempts where quiz_id = q.id and student_id = $2 order by score desc nulls last limit 1) as max_score
     from quizzes q
     join classes c on c.id = q.class_id
     where q.class_id = $1 and q.status = 'published'
     order by q.created_at desc`,
    [req.user.class_id, req.user.id]
  );
  res.json({ quizzes: rows });
}

async function getQuiz(req, res) {
  const quizRows = await query(
    `select q.*, c.name as class_name from quizzes q join classes c on c.id = q.class_id where q.id = $1`,
    [req.params.id]
  );
  const quiz = quizRows[0];
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

  if (req.user.role !== 'student') {
    if (req.user.role !== 'admin' && quiz.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only view quizzes you created' });
    }
    const questions = await query(
      'select * from quiz_questions where quiz_id = $1 order by order_index asc',
      [req.params.id]
    );
    return res.json({ quiz, questions });
  }

  // student: must be their class, must be published
  if (quiz.class_id !== req.user.class_id || quiz.status !== 'published') {
    return res.status(403).json({ error: 'This quiz is not available to you' });
  }
  const questions = await query(
    'select id, quiz_id, order_index, question_text, question_type, options, points from quiz_questions where quiz_id = $1 order by order_index asc',
    [req.params.id]
  );
  const attempts = await query(
    'select * from quiz_attempts where quiz_id = $1 and student_id = $2 order by attempt_number desc',
    [req.params.id, req.user.id]
  );
  res.json({ quiz, questions, attempts });
}

function validateQuestions(questions) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return 'At least one question is required';
  }
  for (const q of questions) {
    if (!q.question_text || !q.question_text.trim()) return 'Every question needs question text';
    if (!['multiple_choice', 'true_false', 'short_answer'].includes(q.question_type)) {
      return `Unrecognized question type: ${q.question_type}`;
    }
    if (q.question_type === 'multiple_choice') {
      if (!Array.isArray(q.options) || q.options.length < 2) return 'Multiple choice questions need at least 2 options';
      if (!q.correct_answer || !q.options.includes(q.correct_answer)) {
        return 'Multiple choice questions need a correct_answer matching one of the options';
      }
    }
    if (q.question_type === 'true_false' && !['True', 'False'].includes(q.correct_answer)) {
      return 'True/False questions need correct_answer of "True" or "False"';
    }
  }
  return null;
}

async function createQuiz(req, res) {
  const { title, description, class_id, time_limit_minutes, available_from, available_until, max_attempts, status, questions } = req.body;

  if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
  if (!class_id) return res.status(400).json({ error: 'class_id is required' });

  const questionError = validateQuestions(questions);
  if (questionError) return res.status(400).json({ error: questionError });

  if (max_attempts !== undefined && max_attempts !== null && (!Number.isInteger(max_attempts) || max_attempts < 1)) {
    return res.status(400).json({ error: 'max_attempts must be a positive whole number, or left blank for unlimited' });
  }

  try {
    const result = await withTransaction(async (client) => {
      const quizRows = await client.query(
        `insert into quizzes (title, description, class_id, teacher_id, time_limit_minutes, available_from, available_until, max_attempts, status)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         returning *`,
        [
          title.trim(),
          description || null,
          class_id,
          req.user.id,
          time_limit_minutes || null,
          available_from || null,
          available_until || null,
          max_attempts || null,
          status === 'published' ? 'published' : 'draft',
        ]
      );
      const quiz = quizRows.rows[0];

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        await client.query(
          `insert into quiz_questions (quiz_id, order_index, question_text, question_type, options, correct_answer, points)
           values ($1, $2, $3, $4, $5, $6, $7)`,
          [
            quiz.id,
            i,
            q.question_text.trim(),
            q.question_type,
            q.question_type === 'short_answer' ? null : JSON.stringify(q.options),
            q.correct_answer || null,
            q.points || 1,
          ]
        );
      }

      return quiz;
    });

    res.status(201).json({ quiz: result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

async function updateQuiz(req, res) {
  const existingRows = await query('select * from quizzes where id = $1', [req.params.id]);
  const existing = existingRows[0];
  if (!existing) return res.status(404).json({ error: 'Quiz not found' });
  if (req.user.role !== 'admin' && existing.teacher_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only edit quizzes you created' });
  }

  const { title, description, time_limit_minutes, available_from, available_until, max_attempts, status, questions } = req.body;

  const attemptRows = await query('select count(*) as count from quiz_attempts where quiz_id = $1', [req.params.id]);
  const hasAttempts = Number(attemptRows[0].count) > 0;

  if (questions !== undefined && hasAttempts) {
    return res.status(400).json({
      error: 'This quiz already has student attempts, so its questions can\'t be changed. You can still update the title, dates, and status.',
    });
  }

  if (max_attempts !== undefined && max_attempts !== null && (!Number.isInteger(max_attempts) || max_attempts < 1)) {
    return res.status(400).json({ error: 'max_attempts must be a positive whole number, or left blank for unlimited' });
  }

  const update = {};
  if (title !== undefined) update.title = title.trim();
  if (description !== undefined) update.description = description;
  if (time_limit_minutes !== undefined) update.time_limit_minutes = time_limit_minutes || null;
  if (available_from !== undefined) update.available_from = available_from || null;
  if (available_until !== undefined) update.available_until = available_until || null;
  if (max_attempts !== undefined) update.max_attempts = max_attempts || null;
  if (status !== undefined) update.status = status === 'published' ? 'published' : 'draft';

  try {
    const result = await withTransaction(async (client) => {
      let quiz = existing;
      const fields = Object.keys(update);
      if (fields.length > 0) {
        const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
        const values = fields.map((f) => update[f]);
        values.push(req.params.id);
        const rows = await client.query(`update quizzes set ${setClause} where id = $${values.length} returning *`, values);
        quiz = rows.rows[0];
      }

      if (questions !== undefined && !hasAttempts) {
        const questionError = validateQuestions(questions);
        if (questionError) throw new Error(questionError);

        await client.query('delete from quiz_questions where quiz_id = $1', [req.params.id]);
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          await client.query(
            `insert into quiz_questions (quiz_id, order_index, question_text, question_type, options, correct_answer, points)
             values ($1, $2, $3, $4, $5, $6, $7)`,
            [
              req.params.id,
              i,
              q.question_text.trim(),
              q.question_type,
              q.question_type === 'short_answer' ? null : JSON.stringify(q.options),
              q.correct_answer || null,
              q.points || 1,
            ]
          );
        }
      }

      return quiz;
    });

    res.json({ quiz: result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

async function deleteQuiz(req, res) {
  const rows = await query('select teacher_id from quizzes where id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Quiz not found' });
  if (req.user.role !== 'admin' && rows[0].teacher_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only delete quizzes you created' });
  }
  await query('delete from quizzes where id = $1', [req.params.id]);
  res.json({ success: true });
}

/**
 * Parses an uploaded .docx into a question list for the teacher to review
 * and edit before saving - this does NOT touch the database. The teacher
 * still calls createQuiz/updateQuiz with the (possibly edited) result.
 */
async function parseDocx(req, res) {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const name = req.file.originalname.toLowerCase();
  if (!name.endsWith('.docx')) {
    return res.status(400).json({ error: 'Please upload a .docx file (Word document)' });
  }

  try {
    const { questions, skipped } = await parseQuizDocx(req.file.buffer);
    res.json({ questions, skipped });
  } catch (error) {
    res.status(400).json({ error: `Could not read that document: ${error.message}` });
  }
}

async function downloadTemplate(req, res) {
  const buffer = await generateQuizTemplate();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', 'attachment; filename="moma-lms-quiz-template.docx"');
  res.send(Buffer.from(buffer));
}

module.exports = { listQuizzes, getQuiz, createQuiz, updateQuiz, deleteQuiz, parseDocx, downloadTemplate };
