import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import Badge from '../components/Badge';
import Button from '../components/Button';
import { Input } from '../components/Input';
import { formatDateTime } from '../utils/date';

export default function QuizGradebook() {
  const { id } = useParams();
  const [quiz, setQuiz] = useState(null);
  const [students, setStudents] = useState([]);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [activeStudent, setActiveStudent] = useState(null);

  function refresh() {
    api
      .quizGradebook(id)
      .then((d) => {
        setQuiz(d.quiz);
        setStudents(d.students);
        document.title = `${d.quiz.title} results - MOMA LMS`;
      })
      .catch((e) => setError(e.message));
  }
  useEffect(refresh, [id]);

  async function handleExport() {
    setExporting(true);
    try {
      await api.exportQuizGradebook(id, quiz.title);
    } catch (err) {
      alert(err.message);
    } finally {
      setExporting(false);
    }
  }

  if (error) return <p className="text-sm text-[var(--color-bad)]">{error}</p>;
  if (!quiz) return <p className="text-sm text-[var(--color-muted)]">Loading...</p>;

  const attempted = students.filter((s) => Number(s.attempts_used) > 0);
  const avgScore = attempted.length
    ? (attempted.reduce((sum, s) => sum + Number(s.best_score || 0), 0) / attempted.length).toFixed(1)
    : '-';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl text-[var(--color-navy)]">{quiz.title} - Results</h1>
          <p className="text-sm text-[var(--color-muted)] mt-1">{quiz.class_name}</p>
        </div>
        <div className="flex gap-2">
          <Link to={`/quizzes/${id}/edit`}><Button variant="outline">Edit quiz</Button></Link>
          <Button variant="gold" onClick={handleExport} disabled={exporting}>
            {exporting ? 'Preparing...' : '⬇ Download Excel report'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-[var(--color-line)] p-4">
          <p className="text-xs uppercase text-[var(--color-muted)]">Students</p>
          <p className="font-display text-2xl text-[var(--color-navy)] mt-1">{students.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-[var(--color-line)] p-4">
          <p className="text-xs uppercase text-[var(--color-muted)]">Attempted</p>
          <p className="font-display text-2xl text-[var(--color-navy)] mt-1">{attempted.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-[var(--color-line)] p-4">
          <p className="text-xs uppercase text-[var(--color-muted)]">Average score</p>
          <p className="font-display text-2xl text-[var(--color-navy)] mt-1">{avgScore}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[var(--color-line)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-[var(--color-line)] text-left text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
                <th className="px-5 py-2.5 font-medium">Student</th>
                <th className="px-3 py-2.5 font-medium">Attempts</th>
                <th className="px-3 py-2.5 font-medium">Best score</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-5 py-2.5 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {students.map((s) => {
                const attempts = Number(s.attempts_used);
                return (
                  <tr key={s.student_id}>
                    <td className="px-5 py-3">
                      <p className="font-medium">{s.full_name}</p>
                      <p className="text-xs text-[var(--color-muted)]">{s.email}</p>
                    </td>
                    <td className="px-3 py-3">{attempts}</td>
                    <td className="px-3 py-3">{attempts > 0 ? `${s.best_score} / ${s.max_score}` : '-'}</td>
                    <td className="px-3 py-3">
                      {attempts === 0 ? (
                        <Badge tone="muted">Not attempted</Badge>
                      ) : s.has_pending_grading ? (
                        <Badge tone="warn">Pending grading</Badge>
                      ) : (
                        <Badge tone="good">Graded</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {attempts > 0 && (
                        <button onClick={() => setActiveStudent(s)} className="text-xs font-medium text-[var(--color-navy)] hover:underline">
                          {s.has_pending_grading ? 'Grade' : 'View'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {activeStudent && (
        <GradingPanel
          quizId={id}
          student={activeStudent}
          onClose={() => setActiveStudent(null)}
          onGraded={() => { refresh(); }}
        />
      )}
    </div>
  );
}

function GradingPanel({ quizId, student, onClose, onGraded }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [pointsInputs, setPointsInputs] = useState({});

  useEffect(() => {
    api
      .quizStudentAttempt(quizId, student.student_id)
      .then((d) => {
        setData(d);
        const initial = {};
        d.answers.forEach((a) => { initial[a.id] = a.points_awarded ?? 0; });
        setPointsInputs(initial);
      })
      .catch((e) => setError(e.message));
  }, [quizId, student.student_id]);

  async function saveGrade(answer) {
    setSavingId(answer.id);
    try {
      await api.gradeQuizAnswer(quizId, data.attempt.id, answer.id, { points_awarded: Number(pointsInputs[answer.id]) });
      const refreshed = await api.quizStudentAttempt(quizId, student.student_id);
      setData(refreshed);
      onGraded();
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[85vh] flex flex-col">
        <div className="px-5 py-4 border-b border-[var(--color-line)] flex items-center justify-between">
          <div>
            <p className="font-display text-lg text-[var(--color-navy)]">{student.full_name}</p>
            {data && <p className="text-xs text-[var(--color-muted)]">Attempt {data.attempt.attempt_number} · Score: {data.attempt.score} / {data.attempt.max_score}</p>}
          </div>
          <button onClick={onClose} className="text-[var(--color-muted)] hover:text-[var(--color-ink)] text-xl leading-none px-1">✕</button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4">
          {error && <p className="text-sm text-[var(--color-bad)]">{error}</p>}
          {!data ? (
            <p className="text-sm text-[var(--color-muted)]">Loading...</p>
          ) : (
            data.answers.map((a, i) => (
              <div key={a.id} className="border border-[var(--color-line)] rounded-xl p-4">
                <p className="text-sm font-medium mb-2">{i + 1}. {a.question_text} <span className="text-xs text-[var(--color-muted)] font-normal">({a.points} pts)</span></p>
                <p className="text-sm text-[var(--color-ink-soft)] bg-[var(--color-bg)] rounded-lg px-3 py-2 mb-2 whitespace-pre-wrap">{a.answer_text || <em className="text-[var(--color-muted)]">No answer given</em>}</p>

                {a.question_type === 'short_answer' ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--color-muted)]">Points:</span>
                    <Input
                      type="number"
                      min="0"
                      max={a.points}
                      step="0.5"
                      value={pointsInputs[a.id] ?? 0}
                      onChange={(e) => setPointsInputs({ ...pointsInputs, [a.id]: e.target.value })}
                      className="w-20"
                    />
                    <Button variant="outline" className="text-xs px-3 py-1.5" onClick={() => saveGrade(a)} disabled={savingId === a.id}>
                      {savingId === a.id ? 'Saving...' : 'Save'}
                    </Button>
                    {a.is_correct !== null && <Badge tone={a.is_correct ? 'good' : 'muted'}>{a.is_correct ? 'Full marks' : 'Graded'}</Badge>}
                  </div>
                ) : (
                  <Badge tone={a.is_correct ? 'good' : 'bad'}>
                    {a.is_correct ? `Correct (+${a.points_awarded})` : `Incorrect - correct answer: ${a.correct_answer}`}
                  </Badge>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
