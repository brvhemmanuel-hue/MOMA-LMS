import { useEffect, useState } from 'react';
import { api } from '../api/client';
import Badge from '../components/Badge';
import { formatDate } from '../utils/date';

export default function Teachers() {
  const [teachers, setTeachers] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Teachers - MOMA LMS';
    api.listTeachers().then((d) => setTeachers(d.teachers)).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-navy)]">Teachers</h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">Every teacher account registered, and how much they've created.</p>
      </div>

      {error && <p className="text-sm text-[var(--color-bad)]">{error}</p>}

      <div className="bg-white rounded-2xl border border-[var(--color-line)] overflow-hidden">
        {teachers === null ? (
          <p className="px-5 py-8 text-center text-sm text-[var(--color-muted)]">Loading...</p>
        ) : teachers.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[var(--color-muted)]">No teachers registered yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-left text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
                  <th className="px-5 py-2.5 font-medium">Name</th>
                  <th className="px-3 py-2.5 font-medium">Email</th>
                  <th className="px-3 py-2.5 font-medium">Joined</th>
                  <th className="px-3 py-2.5 font-medium">Quizzes</th>
                  <th className="px-3 py-2.5 font-medium">Exercises</th>
                  <th className="px-3 py-2.5 font-medium">Materials</th>
                  <th className="px-5 py-2.5 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {teachers.map((t) => (
                  <tr key={t.id}>
                    <td className="px-5 py-3 font-medium">{t.full_name}</td>
                    <td className="px-3 py-3 text-[var(--color-ink-soft)]">{t.email}</td>
                    <td className="px-3 py-3 text-[var(--color-ink-soft)]">{formatDate(t.created_at)}</td>
                    <td className="px-3 py-3 text-[var(--color-ink-soft)]">{t.quiz_count}</td>
                    <td className="px-3 py-3 text-[var(--color-ink-soft)]">{t.exercise_count}</td>
                    <td className="px-3 py-3 text-[var(--color-ink-soft)]">{t.material_count}</td>
                    <td className="px-5 py-3 text-right">
                      <Badge tone={t.is_active ? 'good' : 'bad'}>{t.is_active ? 'Active' : 'Inactive'}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
