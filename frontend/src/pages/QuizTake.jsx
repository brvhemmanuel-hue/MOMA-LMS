import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import Badge from '../components/Badge';
import CountdownTimer from '../components/CountdownTimer';
import { TextArea } from '../components/Input';
import { formatDateTime, isPast } from '../utils/date';

export default function QuizTake() {
  const { id } = useParams();
  const { isTeacher, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [pastAttempts, setPastAttempts] = useState([]);
  const [activeAttempt, setActiveAttempt] = useState(null); // the in-progress attempt being taken right now
  const [answers, setAnswers] = useState({});
  const [selectedIndex, setSelectedIndex] = useState({}); // tracks the chosen option's position per question, not its text - keeps duplicate-worded options from being ambiguous
  const [lastResult, setLastResult] = useState(null); // most recently submitted attempt, shown as a result screen
  const [reviewing, setReviewing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isTeacher || isAdmin) {
      navigate(`/quizzes/${id}/edit`, { replace: true });
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isTeacher, isAdmin]);

  function load() {
    setLoading(true);
    setError('');
    api
      .getQuiz(id)
      .then((d) => {
        setQuiz(d.quiz);
        setQuestions(d.questions);
        setPastAttempts(d.attempts || []);
        document.title = `${d.quiz.title} - MOMA LMS`;
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  async function handleStart() {
    setStarting(true);
    setError('');
    try {
      const data = await api.startQuizAttempt(id);
      setActiveAttempt(data.attempt);
      setQuestions(data.questions);
      setAnswers({});
      setSelectedIndex({});
      setLastResult(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  }

  const handleSubmit = useCallback(async () => {
    if (!activeAttempt) return;
    setSubmitting(true);
    setError('');
    try {
      const answerList = questions.map((q) => ({ question_id: q.id, answer_text: answers[q.id] || '' }));
      const data = await api.submitQuizAttempt(id, { attempt_id: activeAttempt.id, answers: answerList });
      setLastResult(data.attempt);
      setActiveAttempt(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }, [activeAttempt, answers, questions, id]);

  if (loading) return <p className="text-sm text-[var(--color-muted)]">Loading...</p>;
  if (error && !quiz) return <p className="text-sm text-[var(--color-bad)]">{error}</p>;
  if (!quiz) return null;

  // ---- Taking the quiz right now ----
  if (activeAttempt) {
    const expiresAt = quiz.time_limit_minutes
      ? new Date(new Date(activeAttempt.started_at).getTime() + quiz.time_limit_minutes * 60000)
      : null;

    return (
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center justify-between flex-wrap gap-3 sticky top-0 bg-[var(--color-bg)] py-2 z-10">
          <h1 className="font-display text-xl text-[var(--color-navy)]">{quiz.title}</h1>
          {expiresAt && <CountdownTimer expiresAt={expiresAt} onExpire={handleSubmit} />}
        </div>

        {error && <p className="text-sm text-[var(--color-bad)] bg-[var(--color-bad-soft)] rounded-lg px-3 py-2">{error}</p>}

        <div className="space-y-4">
          {questions.map((q, i) => (
            <div key={q.id} className="bg-white rounded-2xl border border-[var(--color-line)] p-5">
              <p className="text-sm font-medium mb-3">
                {i + 1}. {q.question_text} <span className="text-xs text-[var(--color-muted)] font-normal">({q.points} pt{q.points > 1 ? 's' : ''})</span>
              </p>

              {q.question_type === 'multiple_choice' && (
                <div className="space-y-2">
                  {q.options.map((opt, oi) => (
                    <label key={oi} className="flex items-center gap-2 text-sm p-2 rounded-lg hover:bg-[var(--color-bg)] cursor-pointer">
                      <input
                        type="radio"
                        name={q.id}
                        checked={selectedIndex[q.id] === oi}
                        onChange={() => {
                          setAnswers({ ...answers, [q.id]: opt });
                          setSelectedIndex({ ...selectedIndex, [q.id]: oi });
                        }}
                        className="accent-[var(--color-navy)]"
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              )}

              {q.question_type === 'true_false' && (
                <div className="flex gap-4">
                  {['True', 'False'].map((opt, oi) => (
                    <label key={oi} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={q.id}
                        checked={selectedIndex[q.id] === oi}
                        onChange={() => {
                          setAnswers({ ...answers, [q.id]: opt });
                          setSelectedIndex({ ...selectedIndex, [q.id]: oi });
                        }}
                        className="accent-[var(--color-navy)]"
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              )}

              {q.question_type === 'short_answer' && (
                <TextArea rows={3} value={answers[q.id] || ''} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} placeholder="Type your answer..." />
              )}
            </div>
          ))}
        </div>

        <Button variant="accent" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Submitting...' : 'Submit quiz'}
        </Button>
      </div>
    );
  }

  // ---- Reviewing past attempt(s): shows every question with the student's
  // answer, whether it was right, and the correct answer where relevant.
  // Checked before the "just submitted" screen below, since that screen's
  // own "Review your answers" button sets this flag but lastResult stays
  // truthy afterwards - if lastResult were checked first, clicking the
  // button would never actually navigate anywhere. ----
  if (reviewing) {
    return <QuizReview quizTitle={quiz.title} quizId={id} onBack={() => setReviewing(false)} />;
  }

  // ---- Just-submitted result screen ----
  if (lastResult) {
    return (
      <div className="space-y-6 max-w-xl">
        <h1 className="font-display text-2xl text-[var(--color-navy)]">{quiz.title}</h1>
        <div className="bg-white rounded-2xl border border-[var(--color-line)] p-6 text-center">
          {lastResult.status === 'graded' ? (
            <>
              <p className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Your score</p>
              <p className="font-display text-4xl text-[var(--color-navy)] mt-1">{lastResult.score} / {lastResult.max_score}</p>
            </>
          ) : (
            <>
              <p className="font-display text-lg text-[var(--color-navy)]">Submitted!</p>
              <p className="text-sm text-[var(--color-muted)] mt-2">
                This quiz has short-answer questions your teacher needs to review. Your final score will appear here once it's graded.
              </p>
            </>
          )}
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate('/quizzes')}>Back to quizzes</Button>
          <Button variant="ghost" onClick={() => setReviewing(true)}>Review your answers</Button>
        </div>
      </div>
    );
  }

  // ---- Landing / start screen ----
  const attemptsUsed = pastAttempts.length;
  const outOfAttempts = quiz.max_attempts && attemptsUsed >= quiz.max_attempts;
  const notYetOpen = quiz.available_from && !isPast(quiz.available_from);
  const closed = isPast(quiz.available_until);
  const bestAttempt = pastAttempts.reduce((best, a) => (a.score !== null && (!best || a.score > best.score) ? a : best), null);

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="font-display text-2xl text-[var(--color-navy)]">{quiz.title}</h1>
      {quiz.description && <p className="text-sm text-[var(--color-ink-soft)]">{quiz.description}</p>}

      <div className="bg-white rounded-2xl border border-[var(--color-line)] p-5 space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-[var(--color-muted)]">Questions</span><span>{questions.length}</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-muted)]">Time limit</span><span>{quiz.time_limit_minutes ? `${quiz.time_limit_minutes} minutes` : 'Untimed'}</span></div>
        <div className="flex justify-between"><span className="text-[var(--color-muted)]">Attempts</span><span>{quiz.max_attempts ? `${attemptsUsed} of ${quiz.max_attempts} used` : `${attemptsUsed} so far (unlimited)`}</span></div>
        {quiz.available_until && <div className="flex justify-between"><span className="text-[var(--color-muted)]">Closes</span><span>{formatDateTime(quiz.available_until)}</span></div>}
      </div>

      {error && <p className="text-sm text-[var(--color-bad)] bg-[var(--color-bad-soft)] rounded-lg px-3 py-2">{error}</p>}

      {bestAttempt && (
        <div className="bg-[var(--color-good-soft)] text-[var(--color-good)] rounded-2xl p-4 text-sm flex items-center justify-between gap-3 flex-wrap">
          <span>Your best score so far: <span className="font-semibold">{bestAttempt.score} / {bestAttempt.max_score}</span></span>
          <button onClick={() => setReviewing(true)} className="text-xs font-medium underline hover:opacity-70 transition-opacity">Review your answers</button>
        </div>
      )}

      {closed ? (
        <Badge tone="bad">This quiz is closed</Badge>
      ) : notYetOpen ? (
        <Badge tone="muted">Opens {formatDateTime(quiz.available_from)}</Badge>
      ) : outOfAttempts ? (
        <Badge tone="warn">You've used all your attempts</Badge>
      ) : (
        <Button variant="accent" onClick={handleStart} disabled={starting}>
          {starting ? 'Starting...' : attemptsUsed > 0 ? 'Try again' : 'Start quiz'}
        </Button>
      )}
    </div>
  );
}

function QuizReview({ quizTitle, quizId, onBack }) {
  const [attempts, setAttempts] = useState(null);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    api
      .myQuizAttempts(quizId)
      .then((d) => {
        setAttempts(d.attempts);
        if (d.attempts.length > 0) setSelectedId(d.attempts[d.attempts.length - 1].id);
      })
      .catch((e) => setError(e.message));
  }, [quizId]);

  if (error) return <p className="text-sm text-[var(--color-bad)]">{error}</p>;
  if (!attempts) return <p className="text-sm text-[var(--color-muted)]">Loading...</p>;

  const attempt = attempts.find((a) => a.id === selectedId) || attempts[attempts.length - 1];

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display text-2xl text-[var(--color-navy)]">{quizTitle} - Review</h1>
        <button onClick={onBack} className="text-sm text-[var(--color-muted)] hover:underline">← Back</button>
      </div>

      {attempts.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {attempts.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelectedId(a.id)}
              className={`text-xs font-medium rounded-lg px-3 py-1.5 border transition-colors ${
                a.id === attempt.id ? 'bg-[var(--color-navy)] text-white border-[var(--color-navy)]' : 'border-[var(--color-line)] text-[var(--color-ink-soft)] hover:bg-[var(--color-bg-deep)]'
              }`}
            >
              Attempt {a.attempt_number}
            </button>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-[var(--color-line)] p-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase text-[var(--color-muted)]">
            Attempt {attempt.attempt_number} · {formatDateTime(attempt.submitted_at)}
          </p>
          <p className="font-display text-2xl text-[var(--color-navy)] mt-1">{attempt.score} / {attempt.max_score}</p>
        </div>
        {attempt.status !== 'graded' && <Badge tone="warn">Some answers still pending grading</Badge>}
      </div>

      <div className="space-y-4">
        {attempt.answers.map((a, i) => {
          const isPending = a.question_type === 'short_answer' && a.is_correct === null;
          return (
            <div key={a.id} className="bg-white rounded-2xl border border-[var(--color-line)] p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <p className="text-sm font-medium">{i + 1}. {a.question_text}</p>
                {isPending ? (
                  <Badge tone="warn">Pending</Badge>
                ) : (
                  <Badge tone={a.is_correct ? 'good' : 'bad'}>{a.is_correct ? `Correct (+${a.points_awarded})` : 'Incorrect'}</Badge>
                )}
              </div>

              <div className="space-y-1.5 text-sm">
                <p>
                  <span className="text-[var(--color-muted)]">Your answer: </span>
                  <span className={a.is_correct === false ? 'text-[var(--color-bad)]' : ''}>
                    {a.answer_text || <em className="text-[var(--color-muted)]">No answer given</em>}
                  </span>
                </p>
                {!isPending && a.is_correct === false && a.correct_answer && (
                  <p>
                    <span className="text-[var(--color-muted)]">Correct answer: </span>
                    <span className="text-[var(--color-good)] font-medium">{a.correct_answer}</span>
                  </p>
                )}
                {isPending && (
                  <p className="text-xs text-[var(--color-muted)]">Your teacher hasn't graded this answer yet.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

