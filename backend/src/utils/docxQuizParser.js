const mammoth = require('mammoth');

/**
 * The quiz template format (see docxTemplateGenerator.js for the
 * downloadable version of this) - each field is its own line, and a new
 * question starts every time a line begins with "Q:":
 *
 *   Q: What is the capital of Ghana?
 *   TYPE: MCQ
 *   A) Kumasi
 *   B) Accra
 *   C) Tamale
 *   D) Cape Coast
 *   ANSWER: B
 *   POINTS: 2
 *
 *   Q: The Earth revolves around the Sun.
 *   TYPE: TRUEFALSE
 *   ANSWER: TRUE
 *   POINTS: 1
 *
 *   Q: Explain photosynthesis in one sentence.
 *   TYPE: SHORT
 *   POINTS: 3
 *
 * TYPE, ANSWER and POINTS are case-insensitive and their order after the
 * question line doesn't matter, except that MCQ options must appear as
 * "A)", "B)", "C)"... lines. Short-answer questions have no ANSWER line -
 * they're graded by a teacher after students submit.
 *
 * Grouping by "Q:" markers (rather than by blank lines between blocks) is
 * a deliberate choice: converting a Word document to plain text collapses
 * or reformats blank lines and in-paragraph line breaks in ways that
 * differ between how the file was authored, which made blank-line
 * detection unreliable. A line starting with "Q:" survives that
 * conversion consistently, so it's a sturdier signal to split on.
 */

const TYPE_MAP = {
  MCQ: 'multiple_choice',
  MULTIPLECHOICE: 'multiple_choice',
  TRUEFALSE: 'true_false',
  TF: 'true_false',
  SHORT: 'short_answer',
  SHORTANSWER: 'short_answer',
};

function parseBlock(lines, blockNumber) {
  const questionLine = lines[0];
  const question_text = questionLine.replace(/^q[:.]\s*/i, '').trim();
  if (!question_text) {
    return { skipped: true, reason: `Question ${blockNumber}: question text is empty` };
  }

  const typeLine = lines.find((l) => /^type\s*:/i.test(l));
  const rawType = typeLine ? typeLine.replace(/^type\s*:\s*/i, '').trim().toUpperCase().replace(/[\s_-]/g, '') : null;
  const question_type = rawType ? TYPE_MAP[rawType] : null;
  if (!question_type) {
    return {
      skipped: true,
      reason: `"${question_text.slice(0, 40)}": missing or unrecognized TYPE (use MCQ, TRUEFALSE, or SHORT)`,
    };
  }

  const pointsLine = lines.find((l) => /^points\s*:/i.test(l));
  const parsedPoints = pointsLine ? Number(pointsLine.replace(/^points\s*:\s*/i, '').trim()) : 1;
  const points = Number.isFinite(parsedPoints) && parsedPoints > 0 ? parsedPoints : 1;

  const answerLine = lines.find((l) => /^answer\s*:/i.test(l));
  const rawAnswer = answerLine ? answerLine.replace(/^answer\s*:\s*/i, '').trim() : '';

  if (question_type === 'multiple_choice') {
    const optionLines = lines.filter((l) => /^[a-zA-Z][).]\s*/.test(l));
    if (optionLines.length < 2) {
      return {
        skipped: true,
        reason: `"${question_text.slice(0, 40)}": MCQ needs at least 2 options (lines like "A) ...")`,
      };
    }
    const options = optionLines.map((l) => l.replace(/^[a-zA-Z][).]\s*/, '').trim());
    const letters = optionLines.map((l) => l[0].toUpperCase());

    if (!rawAnswer) {
      return { skipped: true, reason: `"${question_text.slice(0, 40)}": MCQ is missing an ANSWER line` };
    }
    const answerLetter = rawAnswer.trim()[0]?.toUpperCase();
    const letterIndex = letters.indexOf(answerLetter);
    let correct_answer = null;
    if (letterIndex >= 0) {
      correct_answer = options[letterIndex];
    } else {
      const textMatch = options.find((o) => o.toLowerCase() === rawAnswer.toLowerCase());
      correct_answer = textMatch || null;
    }
    if (!correct_answer) {
      return { skipped: true, reason: `"${question_text.slice(0, 40)}": ANSWER "${rawAnswer}" doesn't match any option` };
    }

    return { question_text, question_type, options, correct_answer, points };
  }

  if (question_type === 'true_false') {
    const normalized = rawAnswer.toLowerCase();
    let correct_answer = null;
    if (['true', 't', 'yes'].includes(normalized)) correct_answer = 'True';
    else if (['false', 'f', 'no'].includes(normalized)) correct_answer = 'False';
    if (!correct_answer) {
      return { skipped: true, reason: `"${question_text.slice(0, 40)}": TRUE/FALSE needs an ANSWER of TRUE or FALSE` };
    }
    return { question_text, question_type, options: ['True', 'False'], correct_answer, points };
  }

  // short_answer: no auto-grading, correct_answer stays null
  return { question_text, question_type, options: null, correct_answer: null, points };
}

/**
 * @param {Buffer} buffer - the uploaded .docx file's raw bytes
 * @returns {{ questions: object[], skipped: object[] }}
 */
async function parseQuizDocx(buffer) {
  const { value: text } = await mammoth.extractRawText({ buffer });

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // Group lines into blocks, each starting at a line beginning with "Q:".
  // Anything before the first "Q:" line (titles, instructions) is ignored.
  const blocks = [];
  for (const l of lines) {
    if (/^q[:.]/i.test(l)) {
      blocks.push([l]);
    } else if (blocks.length > 0) {
      blocks[blocks.length - 1].push(l);
    }
  }

  const questions = [];
  const skipped = [];

  blocks.forEach((block, i) => {
    const result = parseBlock(block, i + 1);
    if (result.skipped) skipped.push({ reason: result.reason });
    else questions.push(result);
  });

  return { questions, skipped };
}

module.exports = { parseQuizDocx };
