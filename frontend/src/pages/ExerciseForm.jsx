import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { Field, Input, Select, TextArea } from '../components/Input';
import Button from '../components/Button';
import FileDropzone from '../components/FileDropzone';

export default function ExerciseForm() {
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', class_id: '', due_date: '', max_score: 100 });
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = 'New exercise - MOMA LMS';
    api.listClasses().then((d) => setClasses(d.classes)).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.class_id) return setError('Please select a class');

    const formData = new FormData();
    formData.append('title', form.title);
    formData.append('description', form.description);
    formData.append('class_id', form.class_id);
    if (form.due_date) formData.append('due_date', form.due_date);
    formData.append('max_score', form.max_score);
    if (file) formData.append('attachment', file);

    setSubmitting(true);
    try {
      await api.createExercise(formData);
      navigate('/exercises');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display text-2xl text-[var(--color-navy)]">New exercise</h1>
        <Link to="/exercises" className="text-sm text-[var(--color-muted)] hover:underline">Cancel</Link>
      </div>

      {error && <p className="text-sm text-[var(--color-bad)] bg-[var(--color-bad-soft)] rounded-lg px-3 py-2">{error}</p>}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[var(--color-line)] p-5 space-y-4">
        <Field label="Title">
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required autoFocus />
        </Field>
        <Field label="Instructions">
          <TextArea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What should students do?" />
        </Field>
        <Field label="Class">
          <Select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} required>
            <option value="">Select a class</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Due date (optional)">
            <Input type="datetime-local" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </Field>
          <Field label="Max score">
            <Input type="number" min="1" value={form.max_score} onChange={(e) => setForm({ ...form, max_score: e.target.value })} />
          </Field>
        </div>
        <Field label="Attachment (optional)" hint="A handout or instructions document for students">
          <FileDropzone fileName={file?.name} onFileSelect={setFile} />
        </Field>

        <Button type="submit" variant="accent" disabled={submitting}>
          {submitting ? 'Creating...' : 'Create exercise'}
        </Button>
      </form>
    </div>
  );
}
