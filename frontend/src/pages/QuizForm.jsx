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
    shuffle_questions: true,
    allow_copy: false,
    shared_timer: false,
    status: 'draft',
  });
  const [locked, setLocked] = useState(false); // true once students have attempted it: questions can no longer change
  const [questions, setQuestions] = useState([emptyQuestion()]);

  const [docxFile, setDocxFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [skipped, setSkipped] = useState([]);
  const [warnings, setWarnings] = useState([]);

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
            shuffle_questions: Boolean(d.quiz.shuffle_questions),
            allow_copy: Boolean(d.quiz.allow_copy),
            shared_timer: Boolean(d.quiz.shared_timer),
            status: d.quiz.status,
          });
          setLocked(Boolean(d.has_attempts));
          setQuestions(
            d.questions.map((q) => ({
              question_text: q.question_text,
              question_type: q.question_type,
              options: q.options || (q.question_type === 'true_false' ? ['True', 'False'] : ['', '']),
              correct_answer: q.correct_answer || '',
              points: Number(q.points),
              image_url: q.image_url || '',
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
      setWarnings(result.warnings || []);
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
      shuffle_questions: form.shuffle_questions,
      allow_copy: form.allow_copy,
      shared_timer: Boolean(form.shared_timer) && Boolean(form.time_limit_minutes),
      status: publish ? 'published' : 'draft',
      ...(locked ? {} : { questions }),
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

        <div className="bg-white rounded-2xl border border-[var(--color-line)] p-5">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.shuffle_questions}
              onChange={(e) => setForm({ ...form, shuffle_questions: e.target.checked })}
              className="accent-[var(--color-navy)] mt-1 w-4 h-4"
            />
            <span>
              <span className="block text-sm font-medium text-[var(--color-ink)]">Shuffle the questions for each student</span>
              <span className="block text-xs text-[var(--color-muted)] mt-0.5">
                Every student gets the questions in a different order, which makes copying harder. Each student's questions are always numbered 1, 2, 3 in order, and their order stays the same if they refresh the page.
              </span>
            </span>
          </label>
        </div>

        <div className="bg-white rounded-2xl border border-[var(--color-line)] p-5 space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.shared_timer && Boolean(form.time_limit_minutes)}
              disabled={!form.time_limit_minutes}
              onChange={(e) => setForm({ ...form, shared_timer: e.target.checked })}
              className="accent-[var(--color-navy)] mt-1 w-4 h-4"
            />
            <span>
              <span className="block text-sm font-medium text-[var(--color-ink)]">Everyone shares one clock</span>
              <span className="block text-xs text-[var(--color-muted)] mt-0.5">
                {form.time_limit_minutes
                  ? 'The timer starts when the first student begins. A student who starts later only gets the time that is left, and nobody can start once the time has run out. Use "Reset clock" on the results page for a new sitting.'
                  : 'Enter a time limit above to use this option.'}
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.allow_copy}
              onChange={(e) => setForm({ ...form, allow_copy: e.target.checked })}
              className="accent-[var(--color-navy)] mt-1 w-4 h-4"
            />
            <span>
              <span className="block text-sm font-medium text-[var(--color-ink)]">Read-only copy mode</span>
              <span className="block text-xs text-[var(--color-muted)] mt-0.5">
                Students can switch to a read-only view that shows every question with its answer choices, and copy them (for example to answer in another document). The correct answers are never shown. When this is off, copying and selecting the quiz text is blocked.
              </span>
            </span>
          </label>
        </div>

        {locked && (
          <div className="bg-[var(--color-warn-soft)] text-[var(--color-warn)] rounded-2xl p-4 text-sm">
            Students have already attempted this quiz, so its questions are locked. You can still change the title, dates, attempts, shuffling and whether it is published.
          </div>
        )}

        <div className={`bg-white rounded-2xl border border-[var(--color-line)] p-5 space-y-3 ${locked ? 'hidden' : ''}`}>
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
          {warnings.length > 0 && (
            <div className="bg-[var(--color-warn-soft)] text-[var(--color-warn)] rounded-lg px-3 py-2 text-xs space-y-1">
              <p className="font-medium">Please note:</p>
              {warnings.map((w, i) => <p key={i}>• {w.reason}</p>)}
            </div>
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
          {locked ? (
            <p className="text-sm text-[var(--color-muted)]">The {questions.length} question{questions.length === 1 ? '' : 's'} can't be changed any more.</p>
          ) : (
            <QuestionEditor questions={questions} onChange={setQuestions} />
          )}
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
