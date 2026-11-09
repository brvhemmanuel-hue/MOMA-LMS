import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import Badge from '../components/Badge';
import CountdownTimer from '../components/CountdownTimer';
import { TextArea } from '../components/Input';
import { formatDateTime, isPast } from '../utils/date';

const attemptKey = (attemptId) => `moma_attempt_${attemptId}`;

export default function QuizTake() {
  const { id } = useParams();
  const { isTeacher, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [pastAttempts, setPastAttempts] = useState([]);
  const [activeAttempt, setActiveAttempt] = useState(null); // the in-progress attempt being taken right now
  const [lastResult, setLastResult] = useState(null); // most recently submitted attempt, shown as a result screen
  const [reviewing, setReviewing] = useState(false);
  const [timer, setTimer] = useState(null); // the shared clock's state, as reported by the server
  const [expiresAt, setExpiresAt] = useState(null); // when this attempt must be finished
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

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
        setTimer(d.timer || null);
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
      setQuestions(data.questions); // already in this attempt's order
      // The server says how much time is left, so a late starter on a shared clock gets only what remains.
      setExpiresAt(data.remaining_ms == null ? null : new Date(Date.now() + data.remaining_ms));
      setLastResult(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  }

  const handleSubmit = useCallback(
    async (answers) => {
      if (!activeAttempt || submittingRef.current) return;
      submittingRef.current = true;
      setSubmitting(true);
      setError('');
      try {
        const answerList = questions.map((q) => ({ question_id: q.id, answer_text: answers[q.id] || '' }));
        const data = await api.submitQuizAttempt(id, { attempt_id: activeAttempt.id, answers: answerList });
        try {
          localStorage.removeItem(attemptKey(activeAttempt.id));
        } catch {
          // storage unavailable: nothing to clean up
        }
        setLastResult(data.attempt);
        setActiveAttempt(null);
        load();
      } catch (err) {
        setError(err.message);
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeAttempt, questions, id]
  );

  if (loading) return <p className="text-sm text-[var(--color-muted)]">Loading...</p>;
  if (error && !quiz) return <p className="text-sm text-[var(--color-bad)]">{error}</p>;
  if (!quiz) return null;

  // ---- Taking the quiz right now ----
  if (activeAttempt) {
    return <TakingQuiz key={activeAttempt.id} quiz={quiz} attempt={activeAttempt} questions={questions} expiresAt={expiresAt} onSubmit={handleSubmit} submitting={submitting} error={error} />;
  }

  // ---- Reviewing past attempt(s). Checked before the "just submitted" screen, because that
  // screen's own "Review your answers" button sets this flag but lastResult stays truthy. ----
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
        <div className="flex gap-3 flex-wrap">
          <PdfButton quizId={id} attemptId={lastResult.id} quizTitle={quiz.title} />
          <Button variant="outline" onClick={() => setReviewing(true)}>Review your answers</Button>
          <Button variant="ghost" onClick={() => navigate('/quizzes')}>Back to quizzes</Button>
        </div>
      </div>
    );
  }

  // ---- Landing / start screen ----
  const attemptsUsed = pastAttempts.length;
  const outOfAttempts = quiz.max_attempts && attemptsUsed >= quiz.max_attempts;
  const notYetOpen = quiz.available_from && !isPast(quiz.available_from);
  const closed = isPast(quiz.available_until);
  const clockEnded = Boolean(timer?.shared && timer.running && timer.remaining_ms <= 0);
  const clockRunning = Boolean(timer?.shared && timer.running && timer.remaining_ms > 0);
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
        {timer?.shared && (
          <p className="text-xs text-[var(--color-warn)] bg-[var(--color-warn-soft)] rounded-lg px-3 py-2">
            Everyone sits this quiz on one shared clock.{' '}
            {clockEnded
              ? 'The time has ended, so it can no longer be started.'
              : clockRunning
              ? `It is already running, with about ${Math.max(1, Math.ceil(timer.remaining_ms / 60000))} minute(s) left. If you start now you only get the time that remains.`
              : 'It starts when the first student begins, and everyone finishes at the same time.'}
          </p>
        )}
        <p className="text-xs text-[var(--color-muted)] pt-1">You will see one question at a time and can move back and forward before you submit.</p>
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
      ) : clockEnded ? (
        <Badge tone="bad">The time for this quiz has ended</Badge>
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

/** A question's picture, opening full size in a new tab when tapped. */
function QuestionPicture({ url }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block mb-4">
      <img src={url} alt="Illustration for this question" className="max-h-72 max-w-full w-auto rounded-xl border border-[var(--color-line)] bg-white" />
    </a>
  );
}

function PdfButton({ quizId, attemptId, quizTitle, variant = 'gold' }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function download() {
    setBusy(true);
    setError('');
    try {
      const safe = (s) => String(s).replace(/[^a-z0-9]+/gi, ' ').trim();
      await api.downloadAttemptPdf(quizId, attemptId, `${safe(quizTitle)} - ${safe(user?.full_name || 'results')} - results.pdf`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Button variant={variant} onClick={download} disabled={busy}>
        {busy ? 'Preparing your PDF...' : '⬇ Download results (PDF)'}
      </Button>
      {error && <p className="text-xs text-[var(--color-bad)] mt-1.5">{error}</p>}
    </div>
  );
}

/**
 * The quiz itself: one question per page with Previous and Next. Questions are
 * numbered 1, 2, 3 ... in the order shown (which is already shuffled by the server
 * when the teacher turned shuffling on). Answers are kept in the browser as the
 * student goes, so a refresh or a dropped connection does not lose them.
 */
function TakingQuiz({ quiz, attempt, questions, expiresAt, onSubmit, submitting, error }) {
  const storageKey = attemptKey(attempt.id);
  const [state, setState] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (saved) {
        return {
          answers: saved.answers || {},
          selectedIndex: saved.selectedIndex || {},
          current: Math.max(0, Math.min(saved.current || 0, questions.length - 1)),
        };
      }
    } catch {
      // unreadable saved answers: start clean
    }
    return { answers: {}, selectedIndex: {}, current: 0 };
  });
  const { answers, selectedIndex, current } = state;
  const [confirming, setConfirming] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const allowCopy = Boolean(quiz.allow_copy);
  // When copying is not allowed, selecting, copying and the right-click menu are blocked (typing in the answer box still works).
  const guard = allowCopy ? undefined : (e) => { if (e.target.tagName !== 'TEXTAREA') e.preventDefault(); };

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // storage unavailable: the quiz still works, answers just are not kept across a refresh
    }
  }, [state, storageKey]);

  const answersRef = useRef(answers);
  answersRef.current = answers;
  const submitRef = useRef(onSubmit);
  submitRef.current = onSubmit;
  const onExpire = useCallback(() => submitRef.current(answersRef.current), []);

  const total = questions.length;
  const q = questions[current];
  const isAnswered = (question) => String(answers[question.id] ?? '').trim() !== '';
  const answeredCount = questions.filter(isAnswered).length;
  const unanswered = questions.map((x, i) => (isAnswered(x) ? null : i + 1)).filter(Boolean);

  const go = (i) => {
    setConfirming(false);
    setState((s) => ({ ...s, current: Math.max(0, Math.min(i, total - 1)) }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const choose = (text, index) =>
    setState((s) => ({ ...s, answers: { ...s.answers, [q.id]: text }, selectedIndex: { ...s.selectedIndex, [q.id]: index } }));
  const typeAnswer = (text) => setState((s) => ({ ...s, answers: { ...s.answers, [q.id]: text } }));

  if (!q) return <p className="text-sm text-[var(--color-muted)]">This quiz has no questions.</p>;
  const isLast = current === total - 1;

  return (
    <div className={`space-y-5 max-w-2xl ${allowCopy ? '' : 'select-none'}`} onCopy={guard} onCut={guard} onContextMenu={guard} onDragStart={guard}>
      <div className="sticky top-0 z-10 bg-[var(--color-bg)] pt-2 pb-3 -mx-1 px-1 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-lg sm:text-xl text-[var(--color-navy)] truncate">{quiz.title}</h1>
          {expiresAt && <CountdownTimer expiresAt={expiresAt} onExpire={onExpire} />}
        </div>
        {allowCopy && (
          <div className="inline-flex rounded-lg border border-[var(--color-line)] bg-white p-0.5 text-xs font-medium">
            <button type="button" onClick={() => setReadOnly(false)} className={`px-3 py-1.5 rounded-md transition-colors ${!readOnly ? 'bg-[var(--color-navy)] text-white' : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-bg)]'}`}>Answer mode</button>
            <button type="button" onClick={() => setReadOnly(true)} className={`px-3 py-1.5 rounded-md transition-colors ${readOnly ? 'bg-[var(--color-navy)] text-white' : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-bg)]'}`}>Read-only (copy)</button>
          </div>
        )}
        <div className="flex items-center justify-between text-xs text-[var(--color-muted)]">
          <span className="font-medium text-[var(--color-ink-soft)]">Question {current + 1} of {total}</span>
          <span>{answeredCount} of {total} answered</span>
        </div>
        <div className="h-1.5 rounded-full bg-[var(--color-line)] overflow-hidden">
          <div className="h-full bg-[var(--color-gold)] transition-all" style={{ width: `${((current + 1) / total) * 100}%` }} />
        </div>
      </div>

      {error && <p className="text-sm text-[var(--color-bad)] bg-[var(--color-bad-soft)] rounded-lg px-3 py-2">{error}</p>}

      {readOnly ? (
        <ReadOnlyView questions={questions} title={quiz.title} />
      ) : (
      <>
      <div className="bg-white rounded-2xl border border-[var(--color-line)] p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[var(--color-navy)] text-white text-sm font-semibold shrink-0">{current + 1}</span>
          <span className="text-xs text-[var(--color-muted)] mt-1.5">{q.points} {Number(q.points) === 1 ? 'mark' : 'marks'}</span>
        </div>
        <p className="text-base font-medium text-[var(--color-ink)] mb-4 whitespace-pre-wrap">{q.question_text}</p>
        <QuestionPicture url={q.image_url} />

        {q.question_type === 'multiple_choice' && (
          <div className="space-y-2">
            {q.options.map((opt, oi) => {
              const picked = selectedIndex[q.id] === oi;
              return (
                <label key={oi} className={`flex items-center gap-3 text-sm p-3 rounded-xl border cursor-pointer transition-colors ${picked ? 'border-[var(--color-navy)] bg-[var(--color-navy)]/5' : 'border-[var(--color-line)] hover:bg-[var(--color-bg)]'}`}>
                  <input type="radio" name={q.id} checked={picked} onChange={() => choose(opt, oi)} className="accent-[var(--color-navy)] w-4 h-4" />
                  <span><span className="font-semibold text-[var(--color-muted)] mr-2">{String.fromCharCode(65 + oi)}.</span>{opt}</span>
                </label>
              );
            })}
          </div>
        )}

        {q.question_type === 'true_false' && (
          <div className="grid grid-cols-2 gap-3">
            {['True', 'False'].map((opt, oi) => {
              const picked = selectedIndex[q.id] === oi;
              return (
                <label key={oi} className={`flex items-center justify-center gap-2 text-sm font-medium p-3 rounded-xl border cursor-pointer transition-colors ${picked ? 'border-[var(--color-navy)] bg-[var(--color-navy)]/5' : 'border-[var(--color-line)] hover:bg-[var(--color-bg)]'}`}>
                  <input type="radio" name={q.id} checked={picked} onChange={() => choose(opt, oi)} className="accent-[var(--color-navy)] w-4 h-4" />
                  {opt}
                </label>
              );
            })}
          </div>
        )}

        {q.question_type === 'short_answer' && (
          <div className="select-text"><TextArea rows={5} value={answers[q.id] || ''} onChange={(e) => typeAnswer(e.target.value)} placeholder="Type your answer..." /></div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" onClick={() => go(current - 1)} disabled={current === 0}>← Previous</Button>
        {isLast ? (
          <Button variant="gold" onClick={() => setConfirming(true)} disabled={submitting}>Finish and submit</Button>
        ) : (
          <Button variant="accent" onClick={() => go(current + 1)}>Next →</Button>
        )}
      </div>

      {confirming && (
        <div className="bg-white rounded-2xl border-2 border-[var(--color-gold)] p-5 space-y-3">
          <p className="font-display text-lg text-[var(--color-navy)]">Ready to submit?</p>
          <p className="text-sm text-[var(--color-ink-soft)]">
            You have answered <span className="font-semibold">{answeredCount}</span> of {total} questions.
            {unanswered.length > 0 && (
              <> Not answered yet: <span className="font-semibold text-[var(--color-warn)]">question{unanswered.length > 1 ? 's' : ''} {unanswered.join(', ')}</span>.</>
            )}
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button variant="accent" onClick={() => onSubmit(answers)} disabled={submitting}>{submitting ? 'Submitting...' : 'Yes, submit my quiz'}</Button>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={submitting}>Go back and check</Button>
            {unanswered.length > 0 && <Button variant="ghost" onClick={() => go(unanswered[0] - 1)} disabled={submitting}>Take me to question {unanswered[0]}</Button>}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-[var(--color-line)] p-4">
        <p className="text-xs font-medium text-[var(--color-muted)] mb-2">Jump to a question</p>
        <div className="flex flex-wrap gap-1.5">
          {questions.map((x, i) => (
            <button
              key={x.id}
              type="button"
              onClick={() => go(i)}
              aria-label={`Question ${i + 1}${isAnswered(x) ? ', answered' : ', not answered'}`}
              className={`w-9 h-9 rounded-lg text-xs font-semibold border transition-colors ${
                i === current
                  ? 'border-[var(--color-gold)] bg-[var(--color-navy)] text-white ring-2 ring-[var(--color-gold)]'
                  : isAnswered(x)
                  ? 'border-[var(--color-navy)] bg-[var(--color-navy)]/10 text-[var(--color-navy)]'
                  : 'border-[var(--color-line)] text-[var(--color-muted)] hover:bg-[var(--color-bg)]'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
      </>
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
        const finished = d.attempts.filter((a) => a.status !== 'in_progress');
        setAttempts(finished);
        if (finished.length > 0) setSelectedId(finished[finished.length - 1].id);
      })
      .catch((e) => setError(e.message));
  }, [quizId]);

  if (error) return <p className="text-sm text-[var(--color-bad)]">{error}</p>;
  if (!attempts) return <p className="text-sm text-[var(--color-muted)]">Loading...</p>;
  if (attempts.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[var(--color-muted)]">You have not submitted this quiz yet, so there is nothing to review.</p>
        <Button variant="outline" onClick={onBack}>Back</Button>
      </div>
    );
  }

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
          {attempt.status !== 'graded' && <div className="mt-2"><Badge tone="warn">Some answers still pending grading</Badge></div>}
        </div>
        <PdfButton quizId={quizId} attemptId={attempt.id} quizTitle={quizTitle} />
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
              <QuestionPicture url={a.image_url} />

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
                {isPending && <p className="text-xs text-[var(--color-muted)]">Your teacher hasn't graded this answer yet.</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Puts text on the clipboard, with a fallback for browsers that block the modern API. */
async function writeClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  document.body.removeChild(area);
}

function questionAsText(q, number) {
  const lines = [`${number}. ${q.question_text}`];
  if (q.image_url) lines.push(`[Picture: ${q.image_url}]`);
  if (q.question_type === 'multiple_choice') (q.options || []).forEach((o, i) => lines.push(`${String.fromCharCode(65 + i)}. ${o}`));
  else if (q.question_type === 'true_false') lines.push('True or False');
  else lines.push('(Write your answer)');
  return lines.join('\n');
}

/** Every question and its answer choices on one page, as plain selectable text. Never shows the correct answers. */
function ReadOnlyView({ questions, title }) {
  const [copied, setCopied] = useState('');

  async function copy(key, text) {
    try {
      await writeClipboard(text);
      setCopied(key);
    } catch {
      setCopied('failed');
    }
    setTimeout(() => setCopied(''), 1800);
  }

  const all = `${title}\n\n${questions.map((q, i) => questionAsText(q, i + 1)).join('\n\n')}`;

  return (
    <div className="space-y-4 select-text">
      <div className="bg-[var(--color-gold-soft)] rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-[var(--color-gold-deep)] max-w-md">
          Read-only view. Select any text to copy it, or use the copy buttons. Switch back to Answer mode when you are ready to answer and submit.
        </p>
        <Button variant="accent" onClick={() => copy('all', all)}>
          {copied === 'all' ? 'Copied!' : copied === 'failed' ? 'Copy failed. Select the text instead.' : 'Copy all questions'}
        </Button>
      </div>

      {questions.map((q, i) => (
        <div key={q.id} className="bg-white rounded-2xl border border-[var(--color-line)] p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <p className="text-sm font-medium whitespace-pre-wrap">{i + 1}. {q.question_text}</p>
            <button
              type="button"
              onClick={() => copy(q.id, questionAsText(q, i + 1))}
              className="text-xs font-medium text-[var(--color-navy)] border border-[var(--color-line)] rounded-lg px-2.5 py-1 hover:bg-[var(--color-bg)] transition-colors shrink-0"
            >
              {copied === q.id ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <QuestionPicture url={q.image_url} />
          {q.question_type === 'multiple_choice' && (
            <ul className="space-y-1.5 text-sm">
              {q.options.map((o, oi) => (
                <li key={oi}><span className="font-semibold text-[var(--color-muted)] mr-2">{String.fromCharCode(65 + oi)}.</span>{o}</li>
              ))}
            </ul>
          )}
          {q.question_type === 'true_false' && <p className="text-sm text-[var(--color-ink-soft)]">True or False</p>}
          {q.question_type === 'short_answer' && <p className="text-sm text-[var(--color-muted)]">(Write your answer)</p>}
        </div>
      ))}
    </div>
  );
}
