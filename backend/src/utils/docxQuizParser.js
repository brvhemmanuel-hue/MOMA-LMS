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
 * A picture belongs to the question whose "Q:" line most recently came before it, so
 * insert it on its own line under the "Q:" line (or anywhere before the next "Q:").
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

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(str) {
  return str
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z]+);/gi, (m, name) => (name.toLowerCase() in ENTITIES ? ENTITIES[name.toLowerCase()] : m));
}

const ACCEPTED_IMAGES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg' };
const MAX_IMAGES = 40;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/**
 * Walks the document in reading order and yields text lines and pictures.
 * Word's own line breaks inside a paragraph are kept, so a question typed with
 * soft returns reads exactly the same as one typed as separate paragraphs.
 */
function* documentEvents(html) {
  const blockRe = /<(p|h[1-6]|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = blockRe.exec(html))) {
    for (const token of m[2].split(/(<img\b[^>]*>)/i)) {
      if (/^<img\b/i.test(token)) {
        const src = /src="([^"]*)"/i.exec(token);
        if (src) yield { type: 'image', src: src[1] };
      } else {
        const text = decodeEntities(token.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''));
        for (const line of text.split('\n')) {
          const t = line.trim();
          if (t) yield { type: 'line', text: t };
        }
      }
    }
  }
}

/**
 * @param {Buffer} buffer - the uploaded .docx file's raw bytes
 * @returns {Promise<{ questions: object[], skipped: object[], warnings: object[] }>}
 *   Each question may carry `image: { buffer, extension }` for the controller to upload.
 */
async function parseQuizDocx(buffer) {
  const { value: html } = await mammoth.convertToHtml(
    { buffer },
    {
      convertImage: mammoth.images.imgElement((image) =>
        image.read('base64').then((b64) => ({ src: `data:${image.contentType};base64,${b64}` }))
      ),
    }
  );

  // Group everything that follows a "Q:" line into that question's block.
  // Anything before the first "Q:" line (titles, instructions, logos) is ignored.
  const blocks = [];
  for (const ev of documentEvents(html)) {
    if (ev.type === 'line') {
      if (/^q[:.]/i.test(ev.text)) blocks.push({ lines: [ev.text], images: [] });
      else if (blocks.length) blocks[blocks.length - 1].lines.push(ev.text);
    } else if (blocks.length) {
      blocks[blocks.length - 1].images.push(ev.src);
    }
  }

  const questions = [];
  const skipped = [];
  const warnings = [];
  let imageCount = 0;

  blocks.forEach((block, i) => {
    const result = parseBlock(block.lines, i + 1);
    if (result.skipped) {
      skipped.push({ reason: result.reason });
      return;
    }
    if (block.images.length) {
      const label = `"${result.question_text.slice(0, 40)}"`;
      const match = /^data:([^;]+);base64,(.*)$/s.exec(block.images[0]);
      const ext = match && ACCEPTED_IMAGES[match[1].toLowerCase()];
      const bytes = match ? Buffer.from(match[2], 'base64') : null;
      if (!ext) warnings.push({ reason: `${label}: the picture was left out because its format is not supported. Use PNG or JPEG pictures.` });
      else if (bytes.length > MAX_IMAGE_BYTES) warnings.push({ reason: `${label}: the picture was left out because it is larger than 4 MB.` });
      else if (imageCount >= MAX_IMAGES) warnings.push({ reason: `${label}: the picture was left out because a document can hold at most ${MAX_IMAGES} pictures.` });
      else {
        imageCount += 1;
        result.image = { buffer: bytes, extension: ext };
      }
      if (block.images.length > 1) warnings.push({ reason: `${label}: only the first picture is used. Each question can have one picture.` });
    }
    questions.push(result);
  });

  return { questions, skipped, warnings };
}

module.exports = { parseQuizDocx };
