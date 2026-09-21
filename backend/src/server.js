require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const classesRoutes = require('./routes/classes.routes');
const quizzesRoutes = require('./routes/quizzes.routes');
const exercisesRoutes = require('./routes/exercises.routes');
const materialsRoutes = require('./routes/materials.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const usersRoutes = require('./routes/users.routes');

const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '5mb' }));

app.get('/', (req, res) => {
  res.json({ name: 'MOMA LMS API', status: 'ok' });
});
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/classes', classesRoutes);
app.use('/api/quizzes', quizzesRoutes);
app.use('/api/exercises', exercisesRoutes);
app.use('/api/materials', materialsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', usersRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.use((err, req, res, next) => {
  console.error(err);
  if (err.message && err.message.includes('File too large')) {
    return res.status(413).json({ error: 'File is too large (15MB max)' });
  }
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// Only bind a real port when run directly (local dev). On Vercel,
// api/index.js imports `app` and the platform handles invocation per
// request instead, so this block is skipped there.
if (require.main === module) {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`MOMA LMS API running on port ${PORT}`);
  });
}

module.exports = app;
