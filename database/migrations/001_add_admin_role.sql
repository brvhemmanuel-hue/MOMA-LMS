-- Adds the 'admin' role and seeds the school admin account.
-- Run this once against your existing Neon database (SQL Editor, or
-- `psql "$DATABASE_URL" -f database/migrations/001_add_admin_role.sql`).
-- Safe to run more than once.

alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check check (role in ('teacher', 'student', 'admin'));

-- Login: admin@gmail.com / admin123 - change this password immediately
-- after your first login (Settings > Change password).
insert into users (full_name, email, password_hash, role, class_id, is_active)
values ('School Admin', 'admin@gmail.com', '$2a$10$4sDtqvnWFSLaS1K0yfuv9uIR2koBj.ir6PgWLDMeGoaaj1pzeMRii', 'admin', null, true)
on conflict (email) do nothing;
