import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Field, Input, Select } from '../components/Input';
import Button from '../components/Button';
import Badge from '../components/Badge';
import { formatDate } from '../utils/date';

export default function Students() {
  const { isAdmin } = useAuth();
  const [students, setStudents] = useState(null);
  const [classes, setClasses] = useState([]);
  const [classFilter, setClassFilter] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  function refresh() {
    const params = classFilter ? `?class_id=${classFilter}` : '';
    api.listStudents(params).then((d) => setStudents(d.students)).catch((e) => setError(e.message));
  }
  useEffect(refresh, [classFilter]);
  useEffect(() => {
    api.listClasses().then((d) => setClasses(d.classes)).catch(() => {});
  }, []);

  async function handleDelete(s) {
    if (!confirm(`Delete ${s.full_name}'s account? This cannot be undone.`)) return;
    setDeletingId(s.id);
    try {
      await api.deleteStudent(s.id);
      refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = (students || []).filter((s) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return s.full_name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-navy)]">Students</h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          {isAdmin ? 'Every student registered across the school.' : 'Students registered in your classes.'}
        </p>
      </div>

      {error && <p className="text-sm text-[var(--color-bad)]">{error}</p>}

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Filter by class">
          <Select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
            <option value="">All classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Search">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email" />
        </Field>
      </div>

      <div className="bg-white rounded-2xl border border-[var(--color-line)] overflow-hidden">
        {students === null ? (
          <p className="px-5 py-8 text-center text-sm text-[var(--color-muted)]">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[var(--color-muted)]">No students found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-left text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
                  <th className="px-5 py-2.5 font-medium">Name</th>
                  <th className="px-3 py-2.5 font-medium">Email</th>
                  <th className="px-3 py-2.5 font-medium">Class</th>
                  <th className="px-3 py-2.5 font-medium">Joined</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td className="px-5 py-3 font-medium">{s.full_name}</td>
                    <td className="px-3 py-3 text-[var(--color-ink-soft)]">{s.email}</td>
                    <td className="px-3 py-3 text-[var(--color-ink-soft)]">{s.class_name || '-'}</td>
                    <td className="px-3 py-3 text-[var(--color-ink-soft)]">{formatDate(s.created_at)}</td>
                    <td className="px-3 py-3">
                      <Badge tone={s.is_active ? 'good' : 'bad'}>{s.is_active ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <Link to={`/students/${s.id}/report`} className="text-xs font-medium text-[var(--color-navy)] hover:underline mr-3">
                        Scores
                      </Link>
                      <button onClick={() => setEditing(s)} className="text-xs font-medium text-[var(--color-navy)] hover:underline mr-3">
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(s)}
                        disabled={deletingId === s.id}
                        className="text-xs text-[var(--color-bad)] hover:underline"
                      >
                        {deletingId === s.id ? 'Deleting...' : 'Delete'}
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
        <EditStudentModal student={editing} classes={classes} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />
      )}
    </div>
  );
}

function EditStudentModal({ student, classes, onClose, onSaved }) {
  const [form, setForm] = useState({
    full_name: student.full_name,
    email: student.email,
    class_id: student.class_id || '',
    is_active: student.is_active,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.updateStudent(student.id, form);
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
          <h2 className="font-display text-lg text-[var(--color-navy)]">Edit student</h2>
          <button type="button" onClick={onClose} className="text-[var(--color-muted)] hover:text-[var(--color-ink)] text-xl leading-none px-1">✕</button>
        </div>

        {error && <p className="text-sm text-[var(--color-bad)] bg-[var(--color-bad-soft)] rounded-lg px-3 py-2">{error}</p>}

        <Field label="Full name">
          <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
        </Field>
        <Field label="Email">
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </Field>
        <Field label="Class">
          <Select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} required>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
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
