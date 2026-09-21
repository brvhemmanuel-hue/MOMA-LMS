import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Badge from '../components/Badge';
import Button from '../components/Button';
import { formatDateTime, isPast } from '../utils/date';

export default function Quizzes() {
  const { isTeacher, isAdmin } = useAuth();
  const [quizzes, setQuizzes] = useState(null);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  function refresh() {
    api.listQuizzes().then((d) => setQuizzes(d.quizzes)).catch((e) => setError(e.message));
  }
  useEffect(refresh, []);

  async function handleDelete(q) {
    if (!confirm(`Delete "${q.title}"? This cannot be undone.`)) return;
    setDeletingId(q.id);
    try {
      await api.deleteQuiz(q.id);
      refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display text-2xl text-[var(--color-navy)]">Quizzes</h1>
        {isTeacher && <Link to="/quizzes/new"><Button variant="accent">+ New quiz</Button></Link>}
      </div>

      {error && <p className="text-sm text-[var(--color-bad)]">{error}</p>}

      {quizzes === null ? (
        <p className="text-sm text-[var(--color-muted)]">Loading...</p>
      ) : quizzes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[var(--color-line)] px-5 py-10 text-center text-sm text-[var(--color-muted)]">
          {isTeacher ? 'No quizzes yet. Create your first one above.' : isAdmin ? 'No quizzes have been created yet.' : 'No quizzes have been published for your class yet.'}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {quizzes.map((q) => ((isTeacher || isAdmin) ? <TeacherQuizCard key={q.id} q={q} onDelete={handleDelete} deleting={deletingId === q.id} /> : <StudentQuizCard key={q.id} q={q} />))}
        </div>
      )}
    </div>
  );
}

function TeacherQuizCard({ q, onDelete, deleting }) {
  return (
    <div className="bg-white rounded-2xl border border-[var(--color-line)] p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-[var(--color-ink)] truncate">{q.title}</p>
          <p className="text-xs text-[var(--color-muted)]">{q.class_name} · {q.question_count} question{q.question_count === '1' ? '' : 's'}</p>
        </div>
        <Badge tone={q.status === 'published' ? 'good' : 'muted'}>{q.status === 'published' ? 'Published' : 'Draft'}</Badge>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-muted)]">
        <span>{q.attempted_count} attempted</span>
        {Number(q.pending_grading) > 0 && <span className="text-[var(--color-warn)] font-medium">{q.pending_grading} pending grading</span>}
        {q.time_limit_minutes && <span>{q.time_limit_minutes} min limit</span>}
        <span>{q.max_attempts ? `${q.max_attempts} attempt${q.max_attempts > 1 ? 's' : ''} allowed` : 'Unlimited attempts'}</span>
      </div>

      <div className="flex flex-wrap gap-2 mt-auto pt-2">
        <Link to={`/quizzes/${q.id}/results`}><Button variant="outline" className="text-xs px-3 py-1.5">Results</Button></Link>
        <Link to={`/quizzes/${q.id}/edit`}><Button variant="outline" className="text-xs px-3 py-1.5">Edit</Button></Link>
        <button onClick={() => onDelete(q)} disabled={deleting} className="text-xs text-[var(--color-bad)] px-3 py-1.5 hover:bg-[var(--color-bad-soft)] rounded-lg">
          {deleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  );
}

function StudentQuizCard({ q }) {
  const attemptsUsed = Number(q.attempts_used || 0);
  const outOfAttempts = q.max_attempts && attemptsUsed >= q.max_attempts;
  const closed = isPast(q.available_until);
  const notYetOpen = q.available_from && !isPast(q.available_from);

  let statusTone = 'muted';
  let statusLabel = 'Not started';
  if (attemptsUsed > 0) {
    statusTone = 'good';
    statusLabel = q.best_score !== null ? `Best: ${q.best_score}/${q.max_score}` : 'Submitted';
  }
  if (closed) { statusTone = 'bad'; statusLabel = 'Closed'; }

  return (
    <div className="bg-white rounded-2xl border border-[var(--color-line)] p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-[var(--color-ink)] truncate">{q.title}</p>
          <p className="text-xs text-[var(--color-muted)]">{q.class_name} · {q.question_count} question{q.question_count === '1' ? '' : 's'}</p>
        </div>
        <Badge tone={statusTone}>{statusLabel}</Badge>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-muted)]">
        {q.time_limit_minutes && <span>{q.time_limit_minutes} min limit</span>}
        <span>{q.max_attempts ? `Attempt ${attemptsUsed} of ${q.max_attempts}` : `${attemptsUsed} attempt${attemptsUsed === 1 ? '' : 's'} so far`}</span>
        {q.available_until && <span>Closes {formatDateTime(q.available_until)}</span>}
      </div>

      <div className="mt-auto pt-2">
        <Link to={`/quizzes/${q.id}`}>
          <Button variant={closed || outOfAttempts || notYetOpen ? 'outline' : 'accent'} className="text-xs px-3 py-1.5">
            {closed || outOfAttempts || notYetOpen ? 'View' : attemptsUsed > 0 ? 'Try again' : 'Start quiz'}
          </Button>
        </Link>
      </div>
    </div>
  );
}
