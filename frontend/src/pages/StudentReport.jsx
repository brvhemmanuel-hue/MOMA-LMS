import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import Badge from '../components/Badge';
import { formatDateTime } from '../utils/date';

export default function StudentReport() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .studentReport(id)
      .then((d) => {
        setData(d);
        document.title = `${d.student.full_name} - Scores - MOMA LMS`;
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="text-sm text-[var(--color-bad)]">{error}</p>;
  if (!data) return <p className="text-sm text-[var(--color-muted)]">Loading...</p>;

  const gradedQuizzes = data.quiz_attempts.filter((a) => a.status === 'graded');
  const avgQuizPct = gradedQuizzes.length
    ? (gradedQuizzes.reduce((sum, a) => sum + (Number(a.score) / Number(a.max_score)) * 100, 0) / gradedQuizzes.length).toFixed(1)
    : null;
  const gradedExercises = data.exercise_grades.filter((e) => e.grade !== null);
  const avgExercisePct = gradedExercises.length
    ? (gradedExercises.reduce((sum, e) => sum + (Number(e.grade) / Number(e.max_score)) * 100, 0) / gradedExercises.length).toFixed(1)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl text-[var(--color-navy)]">{data.student.full_name}</h1>
          <p className="text-sm text-[var(--color-muted)] mt-1">{data.student.email} · {data.student.class_name || 'No class'}</p>
        </div>
        <Link to="/students" className="text-sm text-[var(--color-muted)] hover:underline">← Back to students</Link>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-[var(--color-line)] p-4">
          <p className="text-xs uppercase text-[var(--color-muted)]">Avg. quiz score</p>
          <p className="font-display text-2xl text-[var(--color-navy)] mt-1">{avgQuizPct !== null ? `${avgQuizPct}%` : '-'}</p>
        </div>
        <div className="bg-white rounded-2xl border border-[var(--color-line)] p-4">
          <p className="text-xs uppercase text-[var(--color-muted)]">Avg. exercise score</p>
          <p className="font-display text-2xl text-[var(--color-navy)] mt-1">{avgExercisePct !== null ? `${avgExercisePct}%` : '-'}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[var(--color-line)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-line)]">
          <h2 className="font-display text-lg text-[var(--color-navy)]">Quiz attempts</h2>
        </div>
        {data.quiz_attempts.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[var(--color-muted)]">No quiz attempts yet.</p>
        ) : (
          <div className="divide-y divide-[var(--color-line)]">
            {data.quiz_attempts.map((a, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{a.title}</p>
                  <p className="text-xs text-[var(--color-muted)]">Attempt {a.attempt_number} · {formatDateTime(a.submitted_at)}</p>
                </div>
                <Badge tone={a.status === 'graded' ? 'good' : 'warn'}>
                  {a.status === 'graded' ? `${a.score} / ${a.max_score}` : 'Pending grading'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-[var(--color-line)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-line)]">
          <h2 className="font-display text-lg text-[var(--color-navy)]">Exercise grades</h2>
        </div>
        {data.exercise_grades.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[var(--color-muted)]">No exercise submissions yet.</p>
        ) : (
          <div className="divide-y divide-[var(--color-line)]">
            {data.exercise_grades.map((e, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{e.title}</p>
                  <p className="text-xs text-[var(--color-muted)]">Submitted {formatDateTime(e.submitted_at)}</p>
                </div>
                <Badge tone={e.grade !== null ? 'good' : 'warn'}>
                  {e.grade !== null ? `${e.grade} / ${e.max_score}` : 'Pending grading'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
