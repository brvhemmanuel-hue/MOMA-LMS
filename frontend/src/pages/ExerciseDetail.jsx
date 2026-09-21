import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Field, Input, TextArea } from '../components/Input';
import Button from '../components/Button';
import Badge from '../components/Badge';
import FileDropzone from '../components/FileDropzone';
import { formatDate, formatDateTime, isPast } from '../utils/date';

export default function ExerciseDetail() {
  const { id } = useParams();
  const { isTeacher, isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  function refresh() {
    api
      .getExercise(id)
      .then((d) => {
        setData(d);
        document.title = `${d.exercise.title} - MOMA LMS`;
      })
      .catch((e) => setError(e.message));
  }
  useEffect(refresh, [id]);

  if (error) return <p className="text-sm text-[var(--color-bad)]">{error}</p>;
  if (!data) return <p className="text-sm text-[var(--color-muted)]">Loading...</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-navy)]">{data.exercise.title}</h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          {data.exercise.class_name}{data.exercise.due_date ? ` · Due ${formatDateTime(data.exercise.due_date)}` : ''} · {data.exercise.max_score} points
        </p>
      </div>

      {data.exercise.description && (
        <div className="bg-white rounded-2xl border border-[var(--color-line)] p-5">
          <p className="text-sm text-[var(--color-ink-soft)] whitespace-pre-wrap">{data.exercise.description}</p>
        </div>
      )}

      {data.exercise.attachment_url && (
        <a href={data.exercise.attachment_url} target="_blank" rel="noreferrer" className="inline-block">
          <Button variant="outline">📎 Download instructions: {data.exercise.attachment_name}</Button>
        </a>
      )}

      {(isTeacher || isAdmin) ? <TeacherView exercise={data.exercise} submissions={data.submissions} onGraded={refresh} /> : <StudentView exercise={data.exercise} submission={data.submission} onSubmitted={refresh} />}
    </div>
  );
}

function TeacherView({ exercise, submissions, onGraded }) {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      await api.exportExerciseGrades(exercise.id, exercise.title);
    } catch (err) {
      alert(err.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-[var(--color-navy)]">Submissions ({submissions.length})</h2>
        <Button variant="gold" onClick={handleExport} disabled={exporting}>
          {exporting ? 'Preparing...' : '⬇ Download Excel report'}
        </Button>
      </div>

      {submissions.length === 0 ? (
        <p className="bg-white rounded-2xl border border-[var(--color-line)] px-5 py-8 text-center text-sm text-[var(--color-muted)]">No submissions yet.</p>
      ) : (
        <div className="space-y-3">
          {submissions.map((s) => (
            <SubmissionRow key={s.id} exerciseId={exercise.id} submission={s} maxScore={exercise.max_score} onGraded={onGraded} />
          ))}
        </div>
      )}
    </div>
  );
}

function SubmissionRow({ exerciseId, submission, maxScore, onGraded }) {
  const [grade, setGrade] = useState(submission.grade ?? '');
  const [feedback, setFeedback] = useState(submission.feedback ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (grade === '' || Number(grade) < 0) return alert('Please enter a grade');
    setSaving(true);
    try {
      await api.gradeExerciseSubmission(exerciseId, submission.id, { grade: Number(grade), feedback });
      onGraded();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-[var(--color-line)] p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm font-medium">{submission.full_name}</p>
          <p className="text-xs text-[var(--color-muted)]">{submission.email} · Submitted {formatDateTime(submission.submitted_at)}</p>
        </div>
        <a href={submission.file_url} target="_blank" rel="noreferrer" className="text-xs font-medium text-[var(--color-navy)] hover:underline">
          📎 {submission.file_name}
        </a>
      </div>
      <div className="grid sm:grid-cols-[100px_1fr_auto] gap-2 items-end">
        <Field label="Grade">
          <Input type="number" min="0" max={maxScore} value={grade} onChange={(e) => setGrade(e.target.value)} />
        </Field>
        <Field label="Feedback (optional)">
          <Input value={feedback} onChange={(e) => setFeedback(e.target.value)} />
        </Field>
        <Button variant="outline" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
      {submission.grade !== null && <Badge tone="good">Graded: {submission.grade} / {maxScore}</Badge>}
    </div>
  );
}

function StudentView({ exercise, submission, onSubmitted }) {
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const overdue = isPast(exercise.due_date);

  async function handleSubmit() {
    if (!file) return setError('Please choose a file first');
    setError('');
    const formData = new FormData();
    formData.append('file', file);
    setSubmitting(true);
    try {
      await api.submitExercise(exercise.id, formData);
      onSubmitted();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-[var(--color-line)] p-5 space-y-4">
      {submission ? (
        <>
          <p className="text-sm font-medium">Your submission</p>
          <a href={submission.file_url} target="_blank" rel="noreferrer" className="text-sm text-[var(--color-navy)] hover:underline block">
            📎 {submission.file_name}
          </a>
          <p className="text-xs text-[var(--color-muted)]">Submitted {formatDateTime(submission.submitted_at)}</p>
          {submission.grade !== null ? (
            <div className="bg-[var(--color-good-soft)] text-[var(--color-good)] rounded-lg p-3 text-sm">
              <p className="font-medium">Grade: {submission.grade} / {exercise.max_score}</p>
              {submission.feedback && <p className="mt-1">{submission.feedback}</p>}
            </div>
          ) : (
            <Badge tone="navy">Awaiting grading</Badge>
          )}
          <div>
            <p className="text-xs text-[var(--color-muted)] mb-2">Want to replace your submission?</p>
            <FileDropzone fileName={file?.name} onFileSelect={setFile} />
            {file && (
              <Button variant="outline" className="mt-2" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Uploading...' : 'Replace submission'}
              </Button>
            )}
          </div>
        </>
      ) : (
        <>
          {overdue && <Badge tone="warn">Past due date - you can still submit, but let your teacher know</Badge>}
          {error && <p className="text-sm text-[var(--color-bad)]">{error}</p>}
          <FileDropzone fileName={file?.name} onFileSelect={setFile} />
          <Button variant="accent" onClick={handleSubmit} disabled={submitting || !file}>
            {submitting ? 'Uploading...' : 'Submit work'}
          </Button>
        </>
      )}
    </div>
  );
}
