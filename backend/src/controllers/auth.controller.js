const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');

function issueToken(user) {
  const payload = {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    role: user.role,
    class_id: user.class_id || null,
  };
  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '12h',
  });
  return { token, user: payload };
}

/**
 * Registers a new teacher or student.
 * Teachers: { full_name, email, password, role: 'teacher' }
 * Students: { full_name, email, password, role: 'student', class_id }
 * The class list a student picks from comes from GET /api/classes, which
 * is public precisely so it can populate this form before the person has
 * an account.
 */
async function register(req, res) {
  const { full_name, email, password, role, class_id } = req.body;

  if (!full_name || !email || !password || !role) {
    return res.status(400).json({ error: 'full_name, email, password and role are required' });
  }
  if (!['teacher', 'student'].includes(role)) {
    return res.status(400).json({ error: 'role must be "teacher" or "student"' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  let resolvedClassId = null;
  if (role === 'student') {
    if (!class_id) return res.status(400).json({ error: 'Please select your class' });
    const classRows = await query('select id from classes where id = $1', [class_id]);
    if (!classRows[0]) return res.status(400).json({ error: 'Selected class was not found' });
    resolvedClassId = class_id;
  }

  const existing = await query('select id from users where email = $1', [email.trim().toLowerCase()]);
  if (existing[0]) return res.status(409).json({ error: 'An account with this email already exists' });

  const password_hash = await bcrypt.hash(password, 10);

  try {
    const rows = await query(
      `insert into users (full_name, email, password_hash, role, class_id)
       values ($1, $2, $3, $4, $5)
       returning id, full_name, email, role, class_id, created_at`,
      [full_name.trim(), email.trim().toLowerCase(), password_hash, role, resolvedClassId]
    );
    const { token, user } = issueToken(rows[0]);
    res.status(201).json({ token, user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const rows = await query(
    'select * from users where email = $1 and is_active = true limit 1',
    [email.trim().toLowerCase()]
  );
  const user = rows[0];
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const matches = await bcrypt.compare(password, user.password_hash);
  if (!matches) return res.status(401).json({ error: 'Invalid email or password' });

  const { token, user: payload } = issueToken(user);
  res.json({ token, user: payload });
}

async function me(req, res) {
  let class_name = null;
  if (req.user.class_id) {
    const rows = await query('select name from classes where id = $1', [req.user.class_id]);
    class_name = rows[0]?.name || null;
  }
  res.json({ user: { ...req.user, class_name } });
}

async function changePassword(req, res) {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'current_password and new_password are required' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  const rows = await query('select * from users where id = $1', [req.user.id]);
  const user = rows[0];
  if (!user) return res.status(404).json({ error: 'Account not found' });

  const matches = await bcrypt.compare(current_password, user.password_hash);
  if (!matches) return res.status(401).json({ error: 'Current password is incorrect' });

  const password_hash = await bcrypt.hash(new_password, 10);
  await query('update users set password_hash = $1 where id = $2', [password_hash, req.user.id]);
  res.json({ success: true });
}

module.exports = { register, login, me, changePassword };
