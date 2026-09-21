import { Field, Input, Select, TextArea } from './Input';
import Button from './Button';

function emptyQuestion() {
  return { question_text: '', question_type: 'multiple_choice', options: ['', ''], correct_answer: '', points: 1 };
}

export default function QuestionEditor({ questions, onChange }) {
  function updateQuestion(index, patch) {
    const next = questions.map((q, i) => (i === index ? { ...q, ...patch } : q));
    onChange(next);
  }

  function updateOption(qIndex, optIndex, value) {
    const q = questions[qIndex];
    const options = q.options.map((o, i) => (i === optIndex ? value : o));
    // if the option that was the correct answer changed text, keep correct_answer in sync
    const correct_answer = q.correct_answer === q.options[optIndex] ? value : q.correct_answer;
    updateQuestion(qIndex, { options, correct_answer });
  }

  function addOption(qIndex) {
    const q = questions[qIndex];
    updateQuestion(qIndex, { options: [...q.options, ''] });
  }

  function removeOption(qIndex, optIndex) {
    const q = questions[qIndex];
    if (q.options.length <= 2) return;
    const removed = q.options[optIndex];
    const options = q.options.filter((_, i) => i !== optIndex);
    updateQuestion(qIndex, { options, correct_answer: q.correct_answer === removed ? '' : q.correct_answer });
  }

  function changeType(qIndex, question_type) {
    if (question_type === 'multiple_choice') {
      updateQuestion(qIndex, { question_type, options: ['', ''], correct_answer: '' });
    } else if (question_type === 'true_false') {
      updateQuestion(qIndex, { question_type, options: ['True', 'False'], correct_answer: '' });
    } else {
      updateQuestion(qIndex, { question_type, options: null, correct_answer: '' });
    }
  }

  function addQuestion() {
    onChange([...questions, emptyQuestion()]);
  }

  function removeQuestion(index) {
    onChange(questions.filter((_, i) => i !== index));
  }

  function moveQuestion(index, dir) {
    const target = index + dir;
    if (target < 0 || target >= questions.length) return;
    const next = [...questions];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="space-y-4">
      {questions.map((q, i) => (
        <div key={i} className="bg-white rounded-xl border border-[var(--color-line)] p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wide">Question {i + 1}</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => moveQuestion(i, -1)} disabled={i === 0} className="text-xs text-[var(--color-muted)] disabled:opacity-30 px-1.5 py-1">↑</button>
              <button type="button" onClick={() => moveQuestion(i, 1)} disabled={i === questions.length - 1} className="text-xs text-[var(--color-muted)] disabled:opacity-30 px-1.5 py-1">↓</button>
              <button type="button" onClick={() => removeQuestion(i)} className="text-xs text-[var(--color-bad)] px-2 py-1 hover:bg-[var(--color-bad-soft)] rounded">Remove</button>
            </div>
          </div>

          <div className="grid sm:grid-cols-[1fr_auto] gap-3">
            <Field label="Question text">
              <TextArea
                rows={2}
                value={q.question_text}
                onChange={(e) => updateQuestion(i, { question_text: e.target.value })}
                placeholder="Type the question..."
              />
            </Field>
            <Field label="Points">
              <Input
                type="number"
                min="0.5"
                step="0.5"
                value={q.points}
                onChange={(e) => updateQuestion(i, { points: Number(e.target.value) })}
                className="w-24"
              />
            </Field>
          </div>

          <Field label="Question type">
            <Select value={q.question_type} onChange={(e) => changeType(i, e.target.value)}>
              <option value="multiple_choice">Multiple choice</option>
              <option value="true_false">True / False</option>
              <option value="short_answer">Short answer (you grade it)</option>
            </Select>
          </Field>

          {q.question_type === 'multiple_choice' && (
            <div className="space-y-2">
              <span className="block text-sm font-medium text-[var(--color-ink-soft)]">Options - select the correct one</span>
              {q.options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${i}`}
                    checked={q.correct_answer === opt && opt !== ''}
                    onChange={() => updateQuestion(i, { correct_answer: opt })}
                    className="shrink-0 accent-[var(--color-navy)]"
                  />
                  <Input
                    value={opt}
                    onChange={(e) => updateOption(i, oi, e.target.value)}
                    placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(i, oi)}
                    disabled={q.options.length <= 2}
                    className="text-xs text-[var(--color-muted)] disabled:opacity-30 px-2 shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => addOption(i)} className="text-xs font-medium text-[var(--color-navy)] hover:underline">
                + Add option
              </button>
            </div>
          )}

          {q.question_type === 'true_false' && (
            <div>
              <span className="block text-sm font-medium text-[var(--color-ink-soft)] mb-1.5">Correct answer</span>
              <div className="flex gap-4">
                {['True', 'False'].map((val) => (
                  <label key={val} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={`tf-${i}`}
                      checked={q.correct_answer === val}
                      onChange={() => updateQuestion(i, { correct_answer: val })}
                      className="accent-[var(--color-navy)]"
                    />
                    {val}
                  </label>
                ))}
              </div>
            </div>
          )}

          {q.question_type === 'short_answer' && (
            <p className="text-xs text-[var(--color-muted)]">
              No auto-grading - you'll review and score each student's written answer yourself after they submit.
            </p>
          )}
        </div>
      ))}

      <Button type="button" variant="outline" onClick={addQuestion}>
        + Add question
      </Button>
    </div>
  );
}

export { emptyQuestion };
