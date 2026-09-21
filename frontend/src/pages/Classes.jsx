import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Field, Input, TextArea } from '../components/Input';
import Button from '../components/Button';

export default function Classes() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  function refresh() {
    setLoading(true);
    api.listClasses().then((d) => setClasses(d.classes)).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }
  useEffect(refresh, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.createClass(form);
      setForm({ name: '', description: '' });
      setShowForm(false);
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(c) {
    if (!confirm(`Delete "${c.name}"? This cannot be undone.`)) return;
    setDeletingId(c.id);
    try {
      await api.deleteClass(c.id);
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
        <div>
          <h1 className="font-display text-2xl text-[var(--color-navy)]">Classes</h1>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Classes you create here appear automatically in the class dropdown when students sign up.
          </p>
        </div>
        <Button variant="accent" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : '+ New class'}
        </Button>
      </div>

      {error && <p className="text-sm text-[var(--color-bad)]">{error}</p>}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl border border-[var(--color-line)] p-5 space-y-4">
          <Field label="Class name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Basic 6A, JHS 2B" required autoFocus />
          </Field>
          <Field label="Description (optional)">
            <TextArea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Button type="submit" variant="accent" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create class'}
          </Button>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-[var(--color-line)] overflow-hidden">
        {loading ? (
          <p className="px-5 py-8 text-center text-sm text-[var(--color-muted)]">Loading...</p>
        ) : classes.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[var(--color-muted)]">No classes yet. Create the first one above.</p>
        ) : (
          <div className="divide-y divide-[var(--color-line)]">
            {classes.map((c) => (
              <div key={c.id} className="px-5 py-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{c.name}</p>
                  {c.description && <p className="text-xs text-[var(--color-muted)] mt-0.5">{c.description}</p>}
                  <p className="text-xs text-[var(--color-navy)] mt-1">{c.student_count} student{c.student_count === '1' ? '' : 's'}</p>
                </div>
                <button
                  onClick={() => handleDelete(c)}
                  disabled={deletingId === c.id}
                  className="text-xs text-[var(--color-bad)] px-2 py-1 hover:bg-[var(--color-bad-soft)] rounded shrink-0"
                >
                  {deletingId === c.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
