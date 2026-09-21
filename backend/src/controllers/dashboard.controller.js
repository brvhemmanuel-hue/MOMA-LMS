const { query } = require('../config/db');

async function teacherDashboard(req, res) {
  const teacherId = req.user.id;

  const [classCountRows, quizCountRows, exerciseCountRows, materialCountRows, pendingQuizGradingRows, pendingExerciseGradingRows, recentSubmissionsRows] = await Promise.all([
    query(
      `select count(distinct id) as count from (
         select id from classes where created_by = $1
         union
         select class_id as id from quizzes where teacher_id = $1
         union
         select class_id as id from exercises where teacher_id = $1
       ) t`,
      [teacherId]
    ),
    query('select count(*) as count from quizzes where teacher_id = $1', [teacherId]),
    query('select count(*) as count from exercises where teacher_id = $1', [teacherId]),
    query('select count(*) as count from materials where teacher_id = $1', [teacherId]),
    query(
      `select count(*) as count from quiz_answers qan
       join quiz_questions qq on qq.id = qan.question_id
       join quizzes q on q.id = qq.quiz_id
       where q.teacher_id = $1 and qq.question_type = 'short_answer' and qan.is_correct is null`,
      [teacherId]
    ),
    query(
      `select count(*) as count from exercise_submissions s
       join exercises e on e.id = s.exercise_id
       where e.teacher_id = $1 and s.grade is null`,
      [teacherId]
    ),
    query(
      `select 'exercise' as kind, e.title, u.full_name as student_name, s.submitted_at as at, e.id as ref_id
       from exercise_submissions s
       join exercises e on e.id = s.exercise_id
       join users u on u.id = s.student_id
       where e.teacher_id = $1
       union all
       select 'quiz' as kind, q.title, u.full_name as student_name, qa.submitted_at as at, q.id as ref_id
       from quiz_attempts qa
       join quizzes q on q.id = qa.quiz_id
       join users u on u.id = qa.student_id
       where q.teacher_id = $1 and qa.submitted_at is not null
       order by at desc
       limit 8`,
      [teacherId]
    ),
  ]);

  res.json({
    class_count: Number(classCountRows[0].count),
    quiz_count: Number(quizCountRows[0].count),
    exercise_count: Number(exerciseCountRows[0].count),
    material_count: Number(materialCountRows[0].count),
    pending_grading: Number(pendingQuizGradingRows[0].count) + Number(pendingExerciseGradingRows[0].count),
    recent_activity: recentSubmissionsRows,
  });
}

async function studentDashboard(req, res) {
  const { id: studentId, class_id: classId } = req.user;

  if (!classId) {
    return res.json({
      upcoming_quizzes: [],
      upcoming_exercises: [],
      recent_materials: [],
      recent_grades: [],
      no_class: true,
    });
  }

  const [quizzes, exercises, materials, quizGrades, exerciseGrades] = await Promise.all([
    query(
      `select q.*, 
              (select count(*) from quiz_attempts where quiz_id = q.id and student_id = $2) as attempts_used
       from quizzes q
       where q.class_id = $1 and q.status = 'published'
         and (q.available_until is null or q.available_until > now())
       order by coalesce(q.available_from, q.created_at) asc
       limit 5`,
      [classId, studentId]
    ),
    query(
      `select e.*,
              (select id from exercise_submissions where exercise_id = e.id and student_id = $2) as submission_id
       from exercises e
       where e.class_id = $1
       order by coalesce(e.due_date, e.created_at) asc
       limit 5`,
      [classId, studentId]
    ),
    query('select * from materials where class_id = $1 order by created_at desc limit 5', [classId]),
    query(
      `select q.title, qa.score, qa.max_score, qa.submitted_at as at
       from quiz_attempts qa join quizzes q on q.id = qa.quiz_id
       where qa.student_id = $1 and qa.status = 'graded'
       order by qa.submitted_at desc limit 5`,
      [studentId]
    ),
    query(
      `select e.title, s.grade, e.max_score, s.graded_at as at
       from exercise_submissions s join exercises e on e.id = s.exercise_id
       where s.student_id = $1 and s.grade is not null
       order by s.graded_at desc limit 5`,
      [studentId]
    ),
  ]);

  const recent_grades = [...quizGrades.map((g) => ({ ...g, kind: 'quiz' })), ...exerciseGrades.map((g) => ({ ...g, kind: 'exercise' }))]
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 5);

  res.json({
    upcoming_quizzes: quizzes.filter((q) => !q.max_attempts || Number(q.attempts_used) < q.max_attempts),
    upcoming_exercises: exercises.filter((e) => !e.submission_id),
    recent_materials: materials,
    recent_grades,
  });
}

/** School-wide view for the admin account: nothing scoped to "my" content, everything is everyone's. */
async function adminDashboard(req, res) {
  const [teacherCount, studentCount, classCount, quizCount, exerciseCount, materialCount, recentActivity] = await Promise.all([
    query("select count(*) as count from users where role = 'teacher'"),
    query("select count(*) as count from users where role = 'student'"),
    query('select count(*) as count from classes'),
    query('select count(*) as count from quizzes'),
    query('select count(*) as count from exercises'),
    query('select count(*) as count from materials'),
    query(
      `select 'exercise' as kind, e.title, u.full_name as student_name, s.submitted_at as at
       from exercise_submissions s
       join exercises e on e.id = s.exercise_id
       join users u on u.id = s.student_id
       union all
       select 'quiz' as kind, q.title, u.full_name as student_name, qa.submitted_at as at
       from quiz_attempts qa
       join quizzes q on q.id = qa.quiz_id
       join users u on u.id = qa.student_id
       where qa.submitted_at is not null
       order by at desc
       limit 10`
    ),
  ]);

  res.json({
    teacher_count: Number(teacherCount[0].count),
    student_count: Number(studentCount[0].count),
    class_count: Number(classCount[0].count),
    quiz_count: Number(quizCount[0].count),
    exercise_count: Number(exerciseCount[0].count),
    material_count: Number(materialCount[0].count),
    recent_activity: recentActivity,
  });
}

module.exports = { teacherDashboard, studentDashboard, adminDashboard };
