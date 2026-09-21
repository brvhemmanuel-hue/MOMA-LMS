import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Field, Input, Select, TextArea } from '../components/Input';
import Button from '../components/Button';
import FileDropzone from '../components/FileDropzone';
import { formatDate } from '../utils/date';

export default function Materials() {
  const { isTeacher, isAdmin } = useAuth();
  const [materials, setMaterials] = useState(null);
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', class_id: '' });
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  function refresh() {
    api.listMaterials().then((d) => setMaterials(d.materials)).catch((e) => setError(e.message));
  }
  useEffect(() => {
    refresh();
    if (isTeacher || isAdmin) api.listClasses().then((d) => setClasses(d.classes)).catch(() => {});
  }, [isTeacher, isAdmin]);

  async function handleUpload(e) {
    e.preventDefault();
    setError('');
    if (!file) return setError('Please choose a file');
    if (!form.class_id) return setError('Please select a class');

    const formData = new FormData();
    formData.append('title', form.title);
    formData.append('description', form.description);
    formData.append('class_id', form.class_id);
    formData.append('file', file);

    setSubmitting(true);
    try {
      await api.createMaterial(formData);
      setForm({ title: '', description: '', class_id: '' });
      setFile(null);
      setShowForm(false);
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(m) {
    if (!confirm(`Delete "${m.title}"?`)) return;
    setDeletingId(m.id);
    try {
      await api.deleteMaterial(m.id);
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
        <h1 className="font-display text-2xl text-[var(--color-navy)]">Learning materials</h1>
        {isTeacher && <Button variant="accent" onClick={() => setShowForm((v) => !v)}>{showForm ? 'Cancel' : '+ Share material'}</Button>}
      </div>

      {error && <p className="text-sm text-[var(--color-bad)]">{error}</p>}

      {showForm && (
        <form onSubmit={handleUpload} className="bg-white rounded-2xl border border-[var(--color-line)] p-5 space-y-4">
          <Field label="Title">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required autoFocus />
          </Field>
          <Field label="Description (optional)">
            <TextArea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label="Class">
            <Select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} required>
              <option value="">Select a class</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="File">
            <FileDropzone fileName={file?.name} onFileSelect={setFile} />
          </Field>
          <Button type="submit" variant="accent" disabled={submitting}>
            {submitting ? 'Uploading...' : 'Share with class'}
          </Button>
        </form>
      )}

      {materials === null ? (
        <p className="text-sm text-[var(--color-muted)]">Loading...</p>
      ) : materials.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[var(--color-line)] px-5 py-10 text-center text-sm text-[var(--color-muted)]">
          {(isTeacher || isAdmin) ? 'Nothing shared yet.' : 'No materials have been shared with your class yet.'}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {materials.map((m) => (
            <div key={m.id} className="bg-white rounded-2xl border border-[var(--color-line)] p-5 flex flex-col gap-2">
              <p className="font-medium truncate">{m.title}</p>
              {m.description && <p className="text-xs text-[var(--color-ink-soft)]">{m.description}</p>}
              <p className="text-xs text-[var(--color-muted)]">
                {m.class_name} · {formatDate(m.created_at)}{m.teacher_name ? ` · ${m.teacher_name}` : ''}
              </p>
              <div className="flex items-center justify-between mt-auto pt-2">
                <a href={m.file_url} target="_blank" rel="noreferrer" className="text-xs font-medium text-[var(--color-navy)] hover:underline">
                  📎 {m.file_name}
                </a>
                {(isTeacher || isAdmin) && (
                  <button onClick={() => handleDelete(m)} disabled={deletingId === m.id} className="text-xs text-[var(--color-bad)] px-2 py-1 hover:bg-[var(--color-bad-soft)] rounded">
                    {deletingId === m.id ? 'Deleting...' : 'Delete'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
