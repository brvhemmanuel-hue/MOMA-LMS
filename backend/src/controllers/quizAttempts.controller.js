const { query, withTransaction } = require('../config/db');
const { generateGradebookExcel } = require('../utils/excelReport');
const { orderForAttempt } = require('../utils/shuffle');
const { fetchImage } = require('../utils/images');

function withinWindow(quiz) {
  const now = new Date();
  if (quiz.available_from && now < new Date(quiz.available_from)) {
    return `This quiz opens on ${new Date(quiz.available_from).toLocaleString()}`;
  }
  if (quiz.available_until && now > new Date(quiz.available_until)) {
    return `This quiz closed on ${new Date(quiz.available_until).toLocaleString()}`;
  }
  return null;
}

/** Milliseconds left for an attempt (null when the quiz is untimed). Can be zero or negative. */
function remainingMs(attempt, quiz) {
  if (!quiz.time_limit_minutes) return null;
  const deadline = attempt.deadline_at
    ? new Date(attempt.deadline_at).getTime()
    : new Date(attempt.started_at).getTime() + quiz.time_limit_minutes * 60000;
  return deadline - Date.now();
}

/**
 * Starts a new attempt, or resumes an in-progress one. Enforces
 * max_attempts and the quiz's availability window - but only when
 * creating a brand new attempt. A student who already has an in-progress
 * attempt can always resume and submit it, even if the window has since
 * closed or they're now "out of attempts" - otherwise a slow student (or
 * one who started right before the deadline) could lose access to a quiz
 * they're already halfway through, which would look exactly like
 * "the questions don't show" from their side.
 */
async function startAttempt(req, res) {
  const quizRows = await query('select * from quizzes where id = $1', [req.params.id]);
  const quiz = quizRows[0];
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
  if (quiz.status !== 'published' || quiz.class_id !== req.user.class_id) {
    return res.status(403).json({ error: 'This quiz is not available to you' });
  }

  const existingAttempts = await query(
    'select * from quiz_attempts where quiz_id = $1 and student_id = $2 order by attempt_number desc',
    [req.params.id, req.user.id]
  );

  const inProgress = existingAttempts.find((a) => a.status === 'in_progress');
  if (inProgress) {
    const questions = await query(
      'select id, order_index, question_text, question_type, options, points, image_url from quiz_questions where quiz_id = $1 order by order_index asc',
      [req.params.id]
    );
    return res.json({ attempt: inProgress, questions: orderForAttempt(questions, inProgress.id, quiz.shuffle_questions), resumed: true, remaining_ms: remainingMs(inProgress, quiz) });
  }

  // Only a fresh attempt is subject to the window and attempt-limit checks.
  const windowError = withinWindow(quiz);
  if (windowError) return res.status(403).json({ error: windowError });

  if (quiz.max_attempts && existingAttempts.length >= quiz.max_attempts) {
    return res.status(403).json({ error: `You have used all ${quiz.max_attempts} attempt${quiz.max_attempts > 1 ? 's' : ''} for this quiz.` });
  }

  // The deadline for this attempt. Normally it is the student's own start time plus the limit.
  // With a shared clock it is set by whoever starts first, so a student who begins later only
  // gets the time that is left, and cannot start at all once the time has run out.
  let deadline = null;
  if (quiz.time_limit_minutes) {
    const limitMs = quiz.time_limit_minutes * 60000;
    if (quiz.shared_timer) {
      // One atomic statement: the first student to get here starts the clock, everyone else reads it.
      const clock = await query(
        'update quizzes set timer_started_at = coalesce(timer_started_at, now()) where id = $1 returning timer_started_at',
        [req.params.id]
      );
      deadline = new Date(new Date(clock[0].timer_started_at).getTime() + limitMs);
      if (deadline.getTime() <= Date.now()) {
        return res.status(403).json({
          error: 'The time for this quiz has ended. Everyone sits it on the same clock, so it can no longer be started. Ask your teacher if you need another chance.',
        });
      }
    } else {
      deadline = new Date(Date.now() + limitMs);
    }
  }

  const attemptRows = await query(
    `insert into quiz_attempts (quiz_id, student_id, attempt_number, deadline_at) values ($1, $2, $3, $4) returning *`,
    [req.params.id, req.user.id, existingAttempts.length + 1, deadline]
  );

  const questions = await query(
    'select id, order_index, question_text, question_type, options, points, image_url from quiz_questions where quiz_id = $1 order by order_index asc',
    [req.params.id]
  );

  res.status(201).json({ attempt: attemptRows[0], questions: orderForAttempt(questions, attemptRows[0].id, quiz.shuffle_questions), resumed: false, remaining_ms: remainingMs(attemptRows[0], quiz) });
}

function answersMatch(given, correct) {
  if (given == null || correct == null) return false;
  return String(given).trim().toLowerCase() === String(correct).trim().toLowerCase();
}

/** Body: { attempt_id, answers: [{ question_id, answer_text }] } */
async function submitAttempt(req, res) {
  const { attempt_id, answers } = req.body;
  if (!attempt_id || !Array.isArray(answers)) {
    return res.status(400).json({ error: 'attempt_id and answers are required' });
  }

  const attemptRows = await query('select * from quiz_attempts where id = $1', [attempt_id]);
  const attempt = attemptRows[0];
  if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
  if (attempt.student_id !== req.user.id) return res.status(403).json({ error: 'This is not your attempt' });
  if (attempt.status !== 'in_progress') return res.status(400).json({ error: 'This attempt has already been submitted' });

  const questions = await query('select * from quiz_questions where quiz_id = $1', [attempt.quiz_id]);
  const questionMap = Object.fromEntries(questions.map((q) => [q.id, q]));

  try {
    const result = await withTransaction(async (client) => {
      let score = 0;
      let hasUngraded = false;

      for (const a of answers) {
        const q = questionMap[a.question_id];
        if (!q) continue;

        let is_correct = null;
        let points_awarded = 0;

        if (q.question_type === 'short_answer') {
          hasUngraded = true;
        } else {
          is_correct = answersMatch(a.answer_text, q.correct_answer);
          points_awarded = is_correct ? Number(q.points) : 0;
          score += points_awarded;
        }

        await client.query(
          `insert into quiz_answers (attempt_id, question_id, answer_text, is_correct, points_awarded)
           values ($1, $2, $3, $4, $5)
           on conflict (attempt_id, question_id) do update
             set answer_text = excluded.answer_text, is_correct = excluded.is_correct, points_awarded = excluded.points_awarded`,
          [attempt_id, a.question_id, a.answer_text ?? '', is_correct, points_awarded]
        );
      }

      const max_score = questions.reduce((sum, q) => sum + Number(q.points), 0);
      const status = hasUngraded ? 'submitted' : 'graded';

      const updated = await client.query(
        `update quiz_attempts set submitted_at = now(), score = $1, max_score = $2, status = $3 where id = $4 returning *`,
        [score, max_score, status, attempt_id]
      );
      return updated.rows[0];
    });

    res.json({ attempt: result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

/** A student's own attempts + per-question breakdown, for reviewing results. */
async function myAttempts(req, res) {
  const quizRows = await query('select shuffle_questions from quizzes where id = $1', [req.params.id]);
  const shuffle = Boolean(quizRows[0]?.shuffle_questions);
  const attempts = await query(
    'select * from quiz_attempts where quiz_id = $1 and student_id = $2 order by attempt_number asc',
    [req.params.id, req.user.id]
  );

  const attemptIds = attempts.map((a) => a.id);
  let answersByAttempt = {};
  if (attemptIds.length > 0) {
    const answers = await query(
      `select qa.*, qq.question_text, qq.question_type, qq.options, qq.correct_answer, qq.points, qq.order_index, qq.image_url
       from quiz_answers qa
       join quiz_questions qq on qq.id = qa.question_id
       where qa.attempt_id = any($1::uuid[])
       order by qq.order_index asc`,
      [attemptIds]
    );
    answersByAttempt = answers.reduce((acc, a) => {
      (acc[a.attempt_id] = acc[a.attempt_id] || []).push(a);
      return acc;
    }, {});
    for (const a of attempts) {
      if (answersByAttempt[a.id]) answersByAttempt[a.id] = orderForAttempt(answersByAttempt[a.id], a.id, shuffle);
    }
  }

  res.json({
    attempts: attempts.map((a) => ({ ...a, answers: answersByAttempt[a.id] || [] })),
  });
}

/** Teacher's gradebook: every student in the class, their best attempt, attempts used. */
async function gradebook(req, res) {
  const quizRows = await query('select * from quizzes where id = $1', [req.params.id]);
  const quiz = quizRows[0];
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
  if (req.user.role !== 'admin' && quiz.teacher_id !== req.user.id) return res.status(403).json({ error: 'You can only view results for quizzes you created' });

  const rows = await query(
    `select u.id as student_id, u.full_name, u.email,
            count(qa.id) as attempts_used,
            max(qa.score) as best_score,
            max(qa.max_score) as max_score,
            bool_or(qa.status = 'submitted') as has_pending_grading,
            max(qa.submitted_at) as last_submitted_at
     from users u
     left join quiz_attempts qa on qa.student_id = u.id and qa.quiz_id = $1
     where u.role = 'student' and u.status = 'approved' and u.class_id = $2
     group by u.id, u.full_name, u.email
     order by u.full_name asc`,
    [req.params.id, quiz.class_id]
  );

  res.json({ quiz, students: rows });
}

/** Teacher grades one short-answer response; recomputes the attempt's total. */
async function gradeAnswer(req, res) {
  const { points_awarded } = req.body;
  if (points_awarded === undefined || Number(points_awarded) < 0) {
    return res.status(400).json({ error: 'points_awarded must be a non-negative number' });
  }

  const answerRows = await query(
    `select qan.*, qq.points as question_points, qq.quiz_id
     from quiz_answers qan
     join quiz_questions qq on qq.id = qan.question_id
     where qan.id = $1 and qan.attempt_id = $2`,
    [req.params.answerId, req.params.attemptId]
  );
  const answer = answerRows[0];
  if (!answer) return res.status(404).json({ error: 'Answer not found' });

  const quizRows = await query('select teacher_id from quizzes where id = $1', [answer.quiz_id]);
  if (req.user.role !== 'admin' && quizRows[0]?.teacher_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only grade quizzes you created' });
  }

  const capped = Math.min(Number(points_awarded), Number(answer.question_points));
  const is_correct = capped >= Number(answer.question_points);

  try {
    const result = await withTransaction(async (client) => {
      await client.query(
        'update quiz_answers set points_awarded = $1, is_correct = $2 where id = $3',
        [capped, is_correct, req.params.answerId]
      );

      const allAnswers = await client.query('select * from quiz_answers where attempt_id = $1', [req.params.attemptId]);
      const score = allAnswers.rows.reduce((sum, a) => sum + Number(a.points_awarded || 0), 0);
      const allGraded = allAnswers.rows.every((a) => a.is_correct !== null);

      const updated = await client.query(
        `update quiz_attempts set score = $1, status = $2 where id = $3 returning *`,
        [score, allGraded ? 'graded' : 'submitted', req.params.attemptId]
      );
      return updated.rows[0];
    });

    res.json({ attempt: result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

async function exportGradebook(req, res) {
  const quizRows = await query(
    `select q.*, c.name as class_name from quizzes q join classes c on c.id = q.class_id where q.id = $1`,
    [req.params.id]
  );
  const quiz = quizRows[0];
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
  if (req.user.role !== 'admin' && quiz.teacher_id !== req.user.id) return res.status(403).json({ error: 'You can only export quizzes you created' });

  const students = await query(
    `select u.full_name, u.email,
            count(qa.id) as attempts_used,
            max(qa.score) as best_score,
            max(qa.max_score) as max_score,
            bool_or(qa.status = 'submitted') as has_pending_grading
     from users u
     left join quiz_attempts qa on qa.student_id = u.id and qa.quiz_id = $1
     where u.role = 'student' and u.status = 'approved' and u.class_id = $2
     group by u.id, u.full_name, u.email
     order by u.full_name asc`,
    [req.params.id, quiz.class_id]
  );

  const rows = students.map((s) => {
    const attempted = Number(s.attempts_used) > 0;
    const pct = attempted && s.max_score > 0 ? ((Number(s.best_score) / Number(s.max_score)) * 100).toFixed(1) + '%' : '-';
    return [
      s.full_name,
      s.email,
      attempted ? Number(s.attempts_used) : 0,
      attempted ? Number(s.best_score) : '-',
      attempted ? Number(s.max_score) : '-',
      pct,
      !attempted ? 'Not attempted' : s.has_pending_grading ? 'Pending grading' : 'Graded',
    ];
  });

  const buffer = await generateGradebookExcel({
    title: `${quiz.title} - Results`,
    subtitle: `${quiz.class_name} - generated ${new Date().toLocaleString()}`,
    columns: ['Student Name', 'Email', 'Attempts Used', 'Best Score', 'Max Score', 'Percentage', 'Status'],
    rows,
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${quiz.title.replace(/[^a-z0-9]/gi, '-')}-results.xlsx"`);
  res.send(Buffer.from(buffer));
}

/** Teacher views one student's most recent attempt in full, to grade any short answers. */
async function studentAttemptDetail(req, res) {
  const quizRows = await query('select * from quizzes where id = $1', [req.params.id]);
  const quiz = quizRows[0];
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
  if (req.user.role !== 'admin' && quiz.teacher_id !== req.user.id) return res.status(403).json({ error: 'You can only view results for quizzes you created' });

  const attemptRows = await query(
    'select * from quiz_attempts where quiz_id = $1 and student_id = $2 order by attempt_number desc limit 1',
    [req.params.id, req.params.studentId]
  );
  const attempt = attemptRows[0];
  if (!attempt) return res.status(404).json({ error: 'This student has not attempted this quiz yet' });

  const answers = await query(
    `select qa.*, qq.question_text, qq.question_type, qq.options, qq.correct_answer, qq.points, qq.order_index, qq.image_url
     from quiz_answers qa
     join quiz_questions qq on qq.id = qa.question_id
     where qa.attempt_id = $1
     order by qq.order_index asc`,
    [attempt.id]
  );

  res.json({ attempt, answers });
}

/**
 * A student's own results and corrections as a PDF: the letterhead, their name and the quiz title,
 * their score, then every question in the order they answered it with the right answers marked.
 */
async function attemptPdf(req, res) {
  const { id: quizId, attemptId } = req.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(attemptId)) {
    return res.status(404).json({ error: 'Attempt not found' });
  }

  const attemptRows = await query(
    `select a.*, q.title as quiz_title, q.max_attempts, q.shuffle_questions, t.full_name as teacher_name
     from quiz_attempts a
     join quizzes q on q.id = a.quiz_id
     left join users t on t.id = q.teacher_id
     where a.id = $1 and a.quiz_id = $2`,
    [attemptId, quizId]
  );
  const attempt = attemptRows[0];
  // Someone else's attempt looks exactly like one that does not exist.
  if (!attempt || attempt.student_id !== req.user.id) return res.status(404).json({ error: 'Attempt not found' });
  if (attempt.status === 'in_progress') return res.status(400).json({ error: 'Submit the quiz first, then you can download your results.' });

  const studentRows = await query(
    'select u.full_name, c.name as class_name from users u left join classes c on c.id = u.class_id where u.id = $1',
    [req.user.id]
  );
  const rows = await query(
    `select qq.id, qq.order_index, qq.question_text, qq.question_type, qq.options, qq.correct_answer, qq.points, qq.image_url,
            qa.answer_text, qa.is_correct, qa.points_awarded
     from quiz_questions qq
     left join quiz_answers qa on qa.question_id = qq.id and qa.attempt_id = $1
     where qq.quiz_id = $2`,
    [attemptId, quizId]
  );
  const questions = orderForAttempt(rows, attemptId, attempt.shuffle_questions);

  // Pictures are fetched from storage so they can be printed with the questions.
  const pictures = await Promise.all(questions.map((q) => fetchImage(q.image_url)));
  questions.forEach((q, i) => (q.image_buffer = pictures[i]));

  const { buildAttemptPdf } = require('../utils/attemptPdf');
  const pdf = await buildAttemptPdf({
    student: { full_name: studentRows[0]?.full_name || req.user.full_name, class_name: studentRows[0]?.class_name || '' },
    quiz: { title: attempt.quiz_title, teacher_name: attempt.teacher_name, max_attempts: attempt.max_attempts },
    attempt,
    questions,
  });

  const safe = (v) => String(v).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'quiz';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safe(attempt.quiz_title)}-${safe(studentRows[0]?.full_name || 'results')}-results.pdf"`);
  res.send(pdf);
}

module.exports = {
  attemptPdf, startAttempt, submitAttempt, myAttempts, gradebook, gradeAnswer, exportGradebook, studentAttemptDetail };
