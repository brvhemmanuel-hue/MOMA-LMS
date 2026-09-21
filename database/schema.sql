-- ============================================================
-- MOMA LMS (Mount Olivet Methodist Academy)
-- Postgres schema (Neon)
-- Run this once against your Neon database, e.g.:
--   psql "$DATABASE_URL" -f database/schema.sql
-- or paste it into the Neon console's SQL editor (Project > SQL Editor).
-- ============================================================

create extension if not exists "pgcrypto";

-- ============================================================
-- Users: teachers and students share one table, distinguished by role.
-- A student's class_id is set at signup, from the list of classes a
-- teacher has already created. A teacher's class_id is always null -
-- teachers aren't "in" a class, they teach one or more classes,
-- which is expressed through classes.created_by and the class_id on
-- each quiz/exercise/material they make, not by a membership table.
-- ============================================================
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null unique,
  password_hash text not null,
  role text not null check (role in ('teacher', 'student', 'admin')),
  class_id uuid,                  -- students only; fk added after classes exists
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,      -- e.g. "Basic 6A", "JHS 2B"
  description text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table users
  add constraint users_class_id_fkey
  foreign key (class_id) references classes(id) on delete set null;

create index if not exists idx_users_class on users(class_id);
create index if not exists idx_users_role on users(role);

-- ============================================================
-- Quizzes
-- ============================================================
create table if not exists quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  class_id uuid not null references classes(id) on delete cascade,
  teacher_id uuid not null references users(id) on delete cascade,
  time_limit_minutes integer,          -- null = untimed
  available_from timestamptz,          -- null = available immediately
  available_until timestamptz,         -- null = no deadline
  max_attempts integer,                -- null = unlimited attempts; otherwise a positive integer
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now()
);

create table if not exists quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  order_index integer not null default 0,
  question_text text not null,
  question_type text not null check (question_type in ('multiple_choice', 'true_false', 'short_answer')),
  options jsonb,                        -- ["Option A", "Option B", ...] for multiple_choice
  correct_answer text,                  -- exact match target for auto-grading; null for short_answer
  points numeric(6,2) not null default 1
);

create table if not exists quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  student_id uuid not null references users(id) on delete cascade,
  attempt_number integer not null default 1,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score numeric(6,2),
  max_score numeric(6,2),
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'graded')),
  unique (quiz_id, student_id, attempt_number)
);

create table if not exists quiz_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references quiz_attempts(id) on delete cascade,
  question_id uuid not null references quiz_questions(id) on delete cascade,
  answer_text text,
  is_correct boolean,                   -- null until graded (always null for short_answer until a teacher grades it)
  points_awarded numeric(6,2) default 0,
  unique (attempt_id, question_id)
);

create index if not exists idx_quizzes_class on quizzes(class_id);
create index if not exists idx_quizzes_teacher on quizzes(teacher_id);
create index if not exists idx_quiz_questions_quiz on quiz_questions(quiz_id);
create index if not exists idx_quiz_attempts_quiz on quiz_attempts(quiz_id);
create index if not exists idx_quiz_attempts_student on quiz_attempts(student_id);
create index if not exists idx_quiz_answers_attempt on quiz_answers(attempt_id);

-- ============================================================
-- Exercises (class exercises / assignments)
-- ============================================================
create table if not exists exercises (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  class_id uuid not null references classes(id) on delete cascade,
  teacher_id uuid not null references users(id) on delete cascade,
  due_date timestamptz,
  attachment_url text,                  -- the teacher's brief/handout, if any
  attachment_name text,
  max_score numeric(6,2) not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists exercise_submissions (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references exercises(id) on delete cascade,
  student_id uuid not null references users(id) on delete cascade,
  file_url text not null,
  file_name text not null,
  submitted_at timestamptz not null default now(),
  grade numeric(6,2),
  feedback text,
  graded_at timestamptz,
  unique (exercise_id, student_id)
);

create index if not exists idx_exercises_class on exercises(class_id);
create index if not exists idx_exercises_teacher on exercises(teacher_id);
create index if not exists idx_exercise_submissions_exercise on exercise_submissions(exercise_id);
create index if not exists idx_exercise_submissions_student on exercise_submissions(student_id);

-- ============================================================
-- Learning materials (notes, slides, past questions, etc.)
-- ============================================================
create table if not exists materials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  class_id uuid not null references classes(id) on delete cascade,
  teacher_id uuid not null references users(id) on delete cascade,
  file_url text not null,
  file_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_materials_class on materials(class_id);
create index if not exists idx_materials_teacher on materials(teacher_id);

-- ============================================================
-- Row Level Security
-- The backend connects with the role that owns these tables (the role
-- from your DATABASE_URL), and table owners bypass RLS by default in
-- Postgres, so the app works out of the box. RLS is still enabled with
-- a locked-down policy so that if you ever add a second, more limited
-- Postgres role for some other purpose, it can't read or write anything
-- here. All role and class scoping is enforced in the backend API, not
-- here.
-- ============================================================
alter table users enable row level security;
alter table classes enable row level security;
alter table quizzes enable row level security;
alter table quiz_questions enable row level security;
alter table quiz_attempts enable row level security;
alter table quiz_answers enable row level security;
alter table exercises enable row level security;
alter table exercise_submissions enable row level security;
alter table materials enable row level security;

create policy deny_all_users on users using (false);
create policy deny_all_classes on classes using (false);
create policy deny_all_quizzes on quizzes using (false);
create policy deny_all_quiz_questions on quiz_questions using (false);
create policy deny_all_quiz_attempts on quiz_attempts using (false);
create policy deny_all_quiz_answers on quiz_answers using (false);
create policy deny_all_exercises on exercises using (false);
create policy deny_all_exercise_submissions on exercise_submissions using (false);
create policy deny_all_materials on materials using (false);

-- ============================================================
-- Seed: one demo class so a fresh install isn't completely empty.
-- Delete this once you've created your school's real classes.
-- ============================================================
insert into classes (name, description)
values ('Demo Class', 'A starter class - rename, or delete once you add your real classes.')
on conflict (name) do nothing;

-- ============================================================
-- Seed: the school admin account.
-- Login: admin@gmail.com / admin123 - change this password immediately
-- after your first login (Settings > Change password).
-- ============================================================
insert into users (full_name, email, password_hash, role, class_id, is_active)
values ('School Admin', 'admin@gmail.com', '$2a$10$4sDtqvnWFSLaS1K0yfuv9uIR2koBj.ir6PgWLDMeGoaaj1pzeMRii', 'admin', null, true)
on conflict (email) do nothing;
