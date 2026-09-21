import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Badge from '../components/Badge';
import Button from '../components/Button';
import { formatDate, formatDateTime, timeUntil } from '../utils/date';

export default function Dashboard() {
  const { user, isTeacher, isAdmin } = useAuth();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-navy)]">
          Welcome back, {user?.full_name?.split(' ')[0]}
        </h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          {isAdmin ? "Here's a school-wide overview." : isTeacher ? "Here's what's happening across your classes." : "Here's what's coming up for you."}
        </p>
      </div>
      {isAdmin ? <AdminDashboard /> : isTeacher ? <TeacherDashboard /> : <StudentDashboard />}
    </div>
  );
}

function StatCard({ label, value, tone = 'navy' }) {
  return (
    <div className="bg-white rounded-2xl border border-[var(--color-line)] p-5">
      <p className="text-xs uppercase tracking-wide text-[var(--color-muted)]">{label}</p>
      <p className={`font-display text-3xl mt-1 ${tone === 'gold' ? 'text-[var(--color-gold-deep)]' : 'text-[var(--color-navy)]'}`}>{value}</p>
    </div>
  );
}

function AdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.adminDashboard().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-sm text-[var(--color-bad)]">{error}</p>;
  if (!data) return <p className="text-sm text-[var(--color-muted)]">Loading...</p>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Teachers" value={data.teacher_count} />
        <StatCard label="Students" value={data.student_count} />
        <StatCard label="Classes" value={data.class_count} />
        <StatCard label="Quizzes" value={data.quiz_count} />
        <StatCard label="Exercises" value={data.exercise_count} />
        <StatCard label="Materials" value={data.material_count} tone="gold" />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to="/students"><Button variant="accent">View students</Button></Link>
        <Link to="/teachers"><Button variant="outline">View teachers</Button></Link>
        <Link to="/classes"><Button variant="outline">Manage classes</Button></Link>
      </div>

      <div className="bg-white rounded-2xl border border-[var(--color-line)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-line)]">
          <h2 className="font-display text-lg text-[var(--color-navy)]">Recent activity across the school</h2>
        </div>
        {data.recent_activity.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[var(--color-muted)]">No activity yet.</p>
        ) : (
          <div className="divide-y divide-[var(--color-line)]">
            {data.recent_activity.map((a, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {a.student_name} {a.kind === 'quiz' ? 'attempted' : 'submitted'} <span className="text-[var(--color-navy)]">{a.title}</span>
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">{formatDateTime(a.at)}</p>
                </div>
                <Badge tone={a.kind === 'quiz' ? 'navy' : 'gold'}>{a.kind === 'quiz' ? 'Quiz' : 'Exercise'}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TeacherDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.teacherDashboard().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-sm text-[var(--color-bad)]">{error}</p>;
  if (!data) return <p className="text-sm text-[var(--color-muted)]">Loading...</p>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <StatCard label="Classes" value={data.class_count} />
        <StatCard label="Quizzes" value={data.quiz_count} />
        <StatCard label="Exercises" value={data.exercise_count} />
        <StatCard label="Materials" value={data.material_count} />
        <StatCard label="Pending grading" value={data.pending_grading} tone="gold" />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to="/quizzes/new"><Button variant="accent">+ New quiz</Button></Link>
        <Link to="/exercises/new"><Button variant="outline">+ New exercise</Button></Link>
        <Link to="/materials"><Button variant="outline">+ Share material</Button></Link>
        <Link to="/classes"><Button variant="outline">+ New class</Button></Link>
      </div>

      <div className="bg-white rounded-2xl border border-[var(--color-line)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-line)]">
          <h2 className="font-display text-lg text-[var(--color-navy)]">Recent activity</h2>
        </div>
        {data.recent_activity.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[var(--color-muted)]">No student activity yet.</p>
        ) : (
          <div className="divide-y divide-[var(--color-line)]">
            {data.recent_activity.map((a, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {a.student_name} {a.kind === 'quiz' ? 'attempted' : 'submitted'} <span className="text-[var(--color-navy)]">{a.title}</span>
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">{formatDateTime(a.at)}</p>
                </div>
                <Badge tone={a.kind === 'quiz' ? 'navy' : 'gold'}>{a.kind === 'quiz' ? 'Quiz' : 'Exercise'}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StudentDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.studentDashboard().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-sm text-[var(--color-bad)]">{error}</p>;
  if (!data) return <p className="text-sm text-[var(--color-muted)]">Loading...</p>;

  if (data.no_class) {
    return (
      <div className="bg-[var(--color-warn-soft)] text-[var(--color-warn)] rounded-2xl p-5 text-sm">
        Your account isn't assigned to a class yet. Please contact your teacher.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-[var(--color-line)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--color-line)] flex items-center justify-between">
            <h2 className="font-display text-lg text-[var(--color-navy)]">Upcoming quizzes</h2>
            <Link to="/quizzes" className="text-xs font-medium text-[var(--color-navy)] hover:underline">View all</Link>
          </div>
          {data.upcoming_quizzes.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-[var(--color-muted)]">Nothing due right now.</p>
          ) : (
            <div className="divide-y divide-[var(--color-line)]">
              {data.upcoming_quizzes.map((q) => (
                <Link key={q.id} to={`/quizzes/${q.id}`} className="block px-5 py-3 hover:bg-[var(--color-bg)]">
                  <p className="text-sm font-medium">{q.title}</p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {q.available_until ? `Closes in ${timeUntil(q.available_until)}` : 'No deadline'}
                    {q.time_limit_minutes ? ` · ${q.time_limit_minutes} min` : ''}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-[var(--color-line)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--color-line)] flex items-center justify-between">
            <h2 className="font-display text-lg text-[var(--color-navy)]">Upcoming exercises</h2>
            <Link to="/exercises" className="text-xs font-medium text-[var(--color-navy)] hover:underline">View all</Link>
          </div>
          {data.upcoming_exercises.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-[var(--color-muted)]">Nothing due right now.</p>
          ) : (
            <div className="divide-y divide-[var(--color-line)]">
              {data.upcoming_exercises.map((ex) => (
                <Link key={ex.id} to={`/exercises/${ex.id}`} className="block px-5 py-3 hover:bg-[var(--color-bg)]">
                  <p className="text-sm font-medium">{ex.title}</p>
                  <p className="text-xs text-[var(--color-muted)]">{ex.due_date ? `Due ${formatDate(ex.due_date)}` : 'No due date'}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-[var(--color-line)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--color-line)] flex items-center justify-between">
            <h2 className="font-display text-lg text-[var(--color-navy)]">Recent materials</h2>
            <Link to="/materials" className="text-xs font-medium text-[var(--color-navy)] hover:underline">View all</Link>
          </div>
          {data.recent_materials.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-[var(--color-muted)]">Nothing shared yet.</p>
          ) : (
            <div className="divide-y divide-[var(--color-line)]">
              {data.recent_materials.map((m) => (
                <a key={m.id} href={m.file_url} target="_blank" rel="noreferrer" className="block px-5 py-3 hover:bg-[var(--color-bg)]">
                  <p className="text-sm font-medium truncate">{m.title}</p>
                  <p className="text-xs text-[var(--color-muted)]">{formatDate(m.created_at)}</p>
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-[var(--color-line)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--color-line)]">
            <h2 className="font-display text-lg text-[var(--color-navy)]">Recent grades</h2>
          </div>
          {data.recent_grades.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-[var(--color-muted)]">No grades yet.</p>
          ) : (
            <div className="divide-y divide-[var(--color-line)]">
              {data.recent_grades.map((g, i) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{g.title}</p>
                    <p className="text-xs text-[var(--color-muted)]">{g.kind === 'quiz' ? 'Quiz' : 'Exercise'}</p>
                  </div>
                  <Badge tone="good">
                    {g.kind === 'quiz' ? `${g.score}/${g.max_score}` : `${g.grade}/${g.max_score}`}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
