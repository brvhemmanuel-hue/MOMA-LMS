import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Field, Input } from '../components/Input';
import Button from '../components/Button';
import Badge from '../components/Badge';
import { formatDate } from '../utils/date';

export default function Teachers() {
  const [teachers, setTeachers] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  function refresh() {
    api.listTeachers().then((d) => setTeachers(d.teachers)).catch((e) => setError(e.message));
  }

  useEffect(() => {
    document.title = 'Teachers - MOMA LMS';
    refresh();
  }, []);

  async function handleDelete(t) {
    const content = `${t.quiz_count} quiz${t.quiz_count === '1' ? '' : 'zes'}, ${t.exercise_count} exercise${t.exercise_count === '1' ? '' : 's'} and ${t.material_count} material${t.material_count === '1' ? '' : 's'}`;
    const message =
      `Delete ${t.full_name}'s account?\n\n` +
      `This also permanently deletes everything they created (${content}), ` +
      `including all student attempts, submissions and grades attached to them. ` +
      `Classes they created are kept.\n\nThis cannot be undone.`;
    if (!confirm(message)) return;

    setDeletingId(t.id);
    try {
      await api.deleteTeacher(t.id);
      refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setDeletingId(null);
    }
  }

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
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium text-right">Actions</th>
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
                    <td className="px-3 py-3">
                      <Badge tone={t.is_active ? 'good' : 'bad'}>{t.is_active ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <button onClick={() => setEditing(t)} className="text-xs font-medium text-[var(--color-navy)] hover:underline mr-3">
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(t)}
                        disabled={deletingId === t.id}
                        className="text-xs text-[var(--color-bad)] hover:underline"
                      >
                        {deletingId === t.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <EditTeacherModal teacher={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />
      )}
    </div>
  );
}

function EditTeacherModal({ teacher, onClose, onSaved }) {
  const [form, setForm] = useState({
    full_name: teacher.full_name,
    email: teacher.email,
    is_active: teacher.is_active,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.updateTeacher(teacher.id, form);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <form onSubmit={handleSave} className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-[var(--color-navy)]">Edit teacher</h2>
          <button type="button" onClick={onClose} className="text-[var(--color-muted)] hover:text-[var(--color-ink)] text-xl leading-none px-1">✕</button>
        </div>

        {error && <p className="text-sm text-[var(--color-bad)] bg-[var(--color-bad-soft)] rounded-lg px-3 py-2">{error}</p>}

        <Field label="Full name">
          <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
        </Field>
        <Field label="Email">
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="accent-[var(--color-navy)]" />
          Account active
        </label>

        <div className="flex gap-2">
          <Button type="submit" variant="accent" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</Button>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
