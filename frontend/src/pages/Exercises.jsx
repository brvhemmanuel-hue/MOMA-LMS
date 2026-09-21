import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Badge from '../components/Badge';
import Button from '../components/Button';
import { formatDate, isPast } from '../utils/date';

export default function Exercises() {
  const { isTeacher, isAdmin } = useAuth();
  const [exercises, setExercises] = useState(null);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  function refresh() {
    api.listExercises().then((d) => setExercises(d.exercises)).catch((e) => setError(e.message));
  }
  useEffect(refresh, []);

  async function handleDelete(ex) {
    if (!confirm(`Delete "${ex.title}"? This cannot be undone.`)) return;
    setDeletingId(ex.id);
    try {
      await api.deleteExercise(ex.id);
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
        <h1 className="font-display text-2xl text-[var(--color-navy)]">Exercises</h1>
        {isTeacher && <Link to="/exercises/new"><Button variant="accent">+ New exercise</Button></Link>}
      </div>

      {error && <p className="text-sm text-[var(--color-bad)]">{error}</p>}

      {exercises === null ? (
        <p className="text-sm text-[var(--color-muted)]">Loading...</p>
      ) : exercises.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[var(--color-line)] px-5 py-10 text-center text-sm text-[var(--color-muted)]">
          {isTeacher ? 'No exercises yet. Create your first one above.' : isAdmin ? 'No exercises have been created yet.' : 'No exercises have been set for your class yet.'}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {exercises.map((ex) =>
            (isTeacher || isAdmin) ? (
              <div key={ex.id} className="bg-white rounded-2xl border border-[var(--color-line)] p-5 flex flex-col gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-[var(--color-ink)] truncate">{ex.title}</p>
                  <p className="text-xs text-[var(--color-muted)]">{ex.class_name}{ex.due_date ? ` · Due ${formatDate(ex.due_date)}` : ''}</p>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-muted)]">
                  <span>{ex.submission_count} submitted</span>
                  {Number(ex.pending_grading) > 0 && <span className="text-[var(--color-warn)] font-medium">{ex.pending_grading} pending grading</span>}
                </div>
                <div className="flex flex-wrap gap-2 mt-auto pt-2">
                  <Link to={`/exercises/${ex.id}`}><Button variant="outline" className="text-xs px-3 py-1.5">View submissions</Button></Link>
                  <button onClick={() => handleDelete(ex)} disabled={deletingId === ex.id} className="text-xs text-[var(--color-bad)] px-3 py-1.5 hover:bg-[var(--color-bad-soft)] rounded-lg">
                    {deletingId === ex.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            ) : (
              <StudentExerciseCard key={ex.id} ex={ex} />
            )
          )}
        </div>
      )}
    </div>
  );
}

function StudentExerciseCard({ ex }) {
  const overdue = isPast(ex.due_date) && !ex.submission_id;
  let tone = 'muted';
  let label = 'Not submitted';
  if (ex.submission_id) {
    tone = ex.grade !== null ? 'good' : 'navy';
    label = ex.grade !== null ? `Graded: ${ex.grade}/${ex.max_score}` : 'Submitted';
  } else if (overdue) {
    tone = 'bad';
    label = 'Overdue';
  }

  return (
    <div className="bg-white rounded-2xl border border-[var(--color-line)] p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-[var(--color-ink)] truncate">{ex.title}</p>
          <p className="text-xs text-[var(--color-muted)]">{ex.class_name}{ex.due_date ? ` · Due ${formatDate(ex.due_date)}` : ''}</p>
        </div>
        <Badge tone={tone}>{label}</Badge>
      </div>
      <div className="mt-auto pt-2">
        <Link to={`/exercises/${ex.id}`}><Button variant={ex.submission_id ? 'outline' : 'accent'} className="text-xs px-3 py-1.5">
          {ex.submission_id ? 'View' : 'Submit work'}
        </Button></Link>
      </div>
    </div>
  );
}
