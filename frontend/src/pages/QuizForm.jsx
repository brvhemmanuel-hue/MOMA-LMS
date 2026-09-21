import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { Field, Input, Select, TextArea } from '../components/Input';
import Button from '../components/Button';
import FileDropzone from '../components/FileDropzone';
import QuestionEditor, { emptyQuestion } from '../components/QuestionEditor';
import { toDateTimeInput } from '../utils/date';

export default function QuizForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    class_id: '',
    available_from: '',
    available_until: '',
    time_limit_minutes: '',
    unlimited_attempts: true,
    max_attempts: 1,
    status: 'draft',
  });
  const [questions, setQuestions] = useState([emptyQuestion()]);

  const [docxFile, setDocxFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [skipped, setSkipped] = useState([]);

  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = `${isEdit ? 'Edit' : 'New'} quiz - MOMA LMS`;
    api.listClasses().then((d) => setClasses(d.classes)).catch(() => {});

    if (isEdit) {
      api
        .getQuiz(id)
        .then((d) => {
          setForm({
            title: d.quiz.title,
            description: d.quiz.description || '',
            class_id: d.quiz.class_id,
            available_from: toDateTimeInput(d.quiz.available_from),
            available_until: toDateTimeInput(d.quiz.available_until),
            time_limit_minutes: d.quiz.time_limit_minutes || '',
            unlimited_attempts: !d.quiz.max_attempts,
            max_attempts: d.quiz.max_attempts || 1,
            status: d.quiz.status,
          });
          setQuestions(
            d.questions.map((q) => ({
              question_text: q.question_text,
              question_type: q.question_type,
              options: q.options || (q.question_type === 'true_false' ? ['True', 'False'] : ['', '']),
              correct_answer: q.correct_answer || '',
              points: Number(q.points),
            }))
          );
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }
  }, [id, isEdit]);

  async function handleParseDocx() {
    if (!docxFile) return;
    setParsing(true);
    setError('');
    try {
      const result = await api.parseQuizDocx(docxFile);
      setQuestions((prev) => {
        const base = prev.length === 1 && !prev[0].question_text ? [] : prev;
        return [...base, ...result.questions];
      });
      setSkipped(result.skipped);
    } catch (err) {
      setError(err.message);
    } finally {
      setParsing(false);
    }
  }

  async function handleSubmit(e, publish) {
    e.preventDefault();
    setError('');

    if (!form.class_id) return setError('Please select a class');

    const payload = {
      title: form.title,
      description: form.description,
      class_id: form.class_id,
      available_from: form.available_from || null,
      available_until: form.available_until || null,
      time_limit_minutes: form.time_limit_minutes ? Number(form.time_limit_minutes) : null,
      max_attempts: form.unlimited_attempts ? null : Number(form.max_attempts),
      status: publish ? 'published' : 'draft',
      questions,
    };

    setSubmitting(true);
    try {
      if (isEdit) {
        await api.updateQuiz(id, payload);
      } else {
        await api.createQuiz(payload);
      }
      navigate('/quizzes');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-sm text-[var(--color-muted)]">Loading...</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display text-2xl text-[var(--color-navy)]">{isEdit ? 'Edit quiz' : 'New quiz'}</h1>
        <Link to="/quizzes" className="text-sm text-[var(--color-muted)] hover:underline">Cancel</Link>
      </div>

      {error && <p className="text-sm text-[var(--color-bad)] bg-[var(--color-bad-soft)] rounded-lg px-3 py-2">{error}</p>}

      <form className="space-y-6">
        <div className="bg-white rounded-2xl border border-[var(--color-line)] p-5 space-y-4">
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

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Opens (optional)" hint="Leave blank to open immediately">
              <Input type="datetime-local" value={form.available_from} onChange={(e) => setForm({ ...form, available_from: e.target.value })} />
            </Field>
            <Field label="Closes (optional)" hint="Leave blank for no deadline">
              <Input type="datetime-local" value={form.available_until} onChange={(e) => setForm({ ...form, available_until: e.target.value })} />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Time limit in minutes (optional)" hint="Leave blank for untimed">
              <Input type="number" min="1" value={form.time_limit_minutes} onChange={(e) => setForm({ ...form, time_limit_minutes: e.target.value })} placeholder="e.g. 30" />
            </Field>
            <Field label="Attempts allowed">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={form.unlimited_attempts}
                    onChange={(e) => setForm({ ...form, unlimited_attempts: e.target.checked })}
                    className="accent-[var(--color-navy)]"
                  />
                  Unlimited
                </label>
                {!form.unlimited_attempts && (
                  <Input
                    type="number"
                    min="1"
                    value={form.max_attempts}
                    onChange={(e) => setForm({ ...form, max_attempts: e.target.value })}
                    className="w-20"
                  />
                )}
              </div>
            </Field>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[var(--color-line)] p-5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-display text-lg text-[var(--color-navy)]">Upload questions from Word</h2>
            <button type="button" onClick={() => api.downloadQuizTemplate()} className="text-xs font-medium text-[var(--color-navy)] hover:underline">
              Download template
            </button>
          </div>
          <p className="text-xs text-[var(--color-muted)]">
            Download the template, fill in your questions following the examples, then upload it here - the questions will be added to the list below for you to review.
          </p>
          <FileDropzone accept=".docx" fileName={docxFile?.name} onFileSelect={setDocxFile} hint="Word .docx files only" />
          {docxFile && (
            <Button type="button" variant="outline" onClick={handleParseDocx} disabled={parsing}>
              {parsing ? 'Reading document...' : 'Add questions from this file'}
            </Button>
          )}
          {skipped.length > 0 && (
            <div className="bg-[var(--color-warn-soft)] text-[var(--color-warn)] rounded-lg px-3 py-2 text-xs space-y-1">
              <p className="font-medium">{skipped.length} block{skipped.length > 1 ? 's' : ''} couldn't be read:</p>
              {skipped.map((s, i) => <p key={i}>• {s.reason}</p>)}
            </div>
          )}
        </div>

        <div>
          <h2 className="font-display text-lg text-[var(--color-navy)] mb-3">Questions</h2>
          <QuestionEditor questions={questions} onChange={setQuestions} />
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="accent" onClick={(e) => handleSubmit(e, true)} disabled={submitting}>
            {submitting ? 'Saving...' : 'Save and publish'}
          </Button>
          <Button type="button" variant="outline" onClick={(e) => handleSubmit(e, false)} disabled={submitting}>
            Save as draft
          </Button>
        </div>
      </form>
    </div>
  );
}
