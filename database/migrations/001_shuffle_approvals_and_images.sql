-- Adds (1) the "shuffle questions" option on quizzes, (2) admin approval of new accounts,
-- (3) pictures on quiz questions, and (4) the read-only copy mode and shared quiz clock.
-- Only needed if you already have a live database: run this once in the Neon SQL editor
-- BEFORE deploying the new code. Fresh installs get all three from schema.sql and do not
-- need this file. Safe to run more than once. Every existing account stays approved.

alter table quizzes add column if not exists shuffle_questions boolean not null default false;

alter table users add column if not exists status text not null default 'approved';
alter table users drop constraint if exists users_status_check;
alter table users add constraint users_status_check check (status in ('pending', 'approved'));

alter table quiz_questions add column if not exists image_url text;

-- read-only copy mode and the shared quiz clock
alter table quizzes add column if not exists allow_copy boolean not null default false;
alter table quizzes add column if not exists shared_timer boolean not null default false;
alter table quizzes add column if not exists timer_started_at timestamptz;
alter table quiz_attempts add column if not exists deadline_at timestamptz;
