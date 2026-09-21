const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');

/**
 * Builds the .docx quiz template teachers download, fill in, and re-upload.
 * Its structure matches exactly what docxQuizParser.js expects - keep the
 * two files in sync if this format ever changes.
 *
 * Each line (Q:, TYPE:, A), ANSWER:, POINTS:) is its own paragraph. This
 * looks like a normal typed list in Word. The parser doesn't rely on blank
 * lines to know where one question ends and the next begins - it simply
 * starts a new question every time it sees a line beginning with "Q:",
 * which survives Word-to-text conversion far more reliably than blank-line
 * gaps or in-paragraph line breaks do.
 */
function line(text, opts = {}) {
  return new Paragraph({ children: [new TextRun({ text, ...opts })], spacing: { after: 60 } });
}

async function generateQuizTemplate() {
  const heading = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 120 } });
  const note = (text, opts = {}) => new Paragraph({ children: [new TextRun({ text, ...opts })], spacing: { after: 200 } });
  const spacer = () => new Paragraph({ text: '', spacing: { after: 200 } });

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: 'MOMA LMS - Quiz Question Template', heading: HeadingLevel.HEADING_1, spacing: { after: 200 } }),
          note(
            'Fill in your questions below, following the pattern shown in the examples. Each question starts with a line beginning "Q:". When you\'re done, save this file and upload it when creating a quiz.',
          ),
          note('Question types: MCQ (multiple choice), TRUEFALSE, or SHORT (short answer, graded by you afterwards).', { italics: true }),

          heading('Example 1: Multiple choice'),
          line('Q: What is the capital of Ghana?'),
          line('TYPE: MCQ'),
          line('A) Kumasi'),
          line('B) Accra'),
          line('C) Tamale'),
          line('D) Cape Coast'),
          line('ANSWER: B'),
          line('POINTS: 2'),
          spacer(),

          heading('Example 2: True or False'),
          line('Q: The Earth revolves around the Sun.'),
          line('TYPE: TRUEFALSE'),
          line('ANSWER: TRUE'),
          line('POINTS: 1'),
          spacer(),

          heading('Example 3: Short answer (you grade these yourself)'),
          line('Q: Explain photosynthesis in one sentence.'),
          line('TYPE: SHORT'),
          line('POINTS: 3'),
          spacer(),

          heading('Your questions start here - replace everything below'),
          line('Q: '),
          line('TYPE: MCQ'),
          line('A) '),
          line('B) '),
          line('C) '),
          line('D) '),
          line('ANSWER: '),
          line('POINTS: 1'),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

module.exports = { generateQuizTemplate };
