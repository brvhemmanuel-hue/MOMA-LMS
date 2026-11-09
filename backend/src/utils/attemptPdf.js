const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

// Read through literal paths so the serverless bundler includes these files.
// The fonts are embedded, so the PDF never depends on fonts installed on the server.
const FONT_REGULAR = fs.readFileSync(path.join(__dirname, '..', 'assets', 'fonts', 'Inter_400Regular.ttf'));
const FONT_SEMIBOLD = fs.readFileSync(path.join(__dirname, '..', 'assets', 'fonts', 'Inter_600SemiBold.ttf'));
const FONT_BOLD = fs.readFileSync(path.join(__dirname, '..', 'assets', 'fonts', 'Inter_700Bold.ttf'));
const LOGO = fs.readFileSync(path.join(__dirname, '..', 'assets', 'logo.png'));

const NAVY = '#14245c';
const GOLD = '#eab308';
const GOLD_DARK = '#a16207';
const INK = '#1a1f2e';
const MUTED = '#6b7280';
const LINE = '#e2e8f0';
const PANEL = '#f8fafc';
const GOOD = '#15803d';
const GOOD_SOFT = '#dcfce7';
const BAD = '#b91c1c';
const BAD_SOFT = '#fee2e2';
const WARN = '#b45309';
const WARN_SOFT = '#fef3c7';

// Picture limits (points). A picture is drawn at most this big, and the page layout may shrink it
// down to MIN_PIC_H, or enlarge it a little, so that pages fill up instead of leaving blank gaps.
const MAX_PIC_W = 320;
const MAX_PIC_H = 170;
const MIN_PIC_H = 90;
// If a question does not fit in the room left on a page but at least this much space remains,
// its options may continue on the next page rather than leaving a large blank gap.
const SPLIT_MIN_ROOM = 100;

const SCHOOL_NAME = 'MOUNT OLIVET METHODIST ACADEMY';
const SCHOOL_LINE = 'Dansoman, Accra  |  MOMA LMS';
const SCHOOL_MOTTO = 'THE TRUTH STANDS';

const TYPE_LABEL = { multiple_choice: 'Multiple choice', true_false: 'True or false', short_answer: 'Short answer' };

const num = (v) => Number(v ?? 0);
const fmt = (v) => num(v).toFixed(2).replace(/\.?0+$/, '');
const eq = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
const when = (d) => new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Accra' });

function fit(doc, str, maxW) {
  let s = String(str ?? '');
  if (doc.widthOfString(s) <= maxW) return s;
  while (s.length > 1 && doc.widthOfString(s + '...') > maxW) s = s.slice(0, -1);
  return s + '...';
}

function chip(doc, text, rightX, y, fg, bg) {
  doc.font('SemiBold').fontSize(8);
  const w = Math.min(doc.widthOfString(text) + 18, 150);
  doc.roundedRect(rightX - w, y, w, 17, 8.5).fill(bg);
  doc.fillColor(fg).text(fit(doc, text, w - 12), rightX - w, y + 4.6, { width: w, align: 'center', lineBreak: false });
  return w;
}

function tickIcon(doc, cx, cy) {
  doc.circle(cx, cy, 6.5).fill(GOOD);
  doc.moveTo(cx - 3, cy + 0.2).lineTo(cx - 0.8, cy + 2.6).lineTo(cx + 3.4, cy - 2.4).lineWidth(1.5).lineCap('round').lineJoin('round').strokeColor('#ffffff').stroke();
}

function crossIcon(doc, cx, cy) {
  doc.circle(cx, cy, 6.5).fill(BAD);
  doc.moveTo(cx - 2.6, cy - 2.6).lineTo(cx + 2.6, cy + 2.6).moveTo(cx + 2.6, cy - 2.6).lineTo(cx - 2.6, cy + 2.6).lineWidth(1.5).lineCap('round').strokeColor('#ffffff').stroke();
}

/** How a question turned out: label, colours and a bucket used for the summary counts. */
function outcome(q) {
  const points = num(q.points);
  const awarded = num(q.points_awarded);
  const answered = String(q.answer_text ?? '').trim() !== '';
  if (q.question_type === 'short_answer') {
    if (q.is_correct === null || q.is_correct === undefined) return { bucket: 'pending', label: answered ? 'Awaiting marking' : 'Not answered', fg: WARN, bg: WARN_SOFT };
    if (awarded >= points) return { bucket: 'correct', label: `Correct  +${fmt(awarded)}`, fg: GOOD, bg: GOOD_SOFT };
    if (awarded > 0) return { bucket: 'partial', label: `Partly correct  ${fmt(awarded)}/${fmt(points)}`, fg: WARN, bg: WARN_SOFT };
    return { bucket: 'incorrect', label: `Incorrect  0/${fmt(points)}`, fg: BAD, bg: BAD_SOFT };
  }
  if (!answered) return { bucket: 'incorrect', label: 'Not answered', fg: WARN, bg: WARN_SOFT };
  if (q.is_correct) return { bucket: 'correct', label: `Correct  +${fmt(awarded)}`, fg: GOOD, bg: GOOD_SOFT };
  return { bucket: 'incorrect', label: `Incorrect  0/${fmt(points)}`, fg: BAD, bg: BAD_SOFT };
}

/** The question's picture, scaled to fit the page (measured once, then reused when drawing). */
function pictureFor(doc, q, maxW) {
  if (!q.image_buffer) return null;
  if (q._pic === undefined) {
    try {
      const img = doc.openImage(q.image_buffer);
      const scale = Math.min(Math.min(maxW, MAX_PIC_W) / img.width, MAX_PIC_H / img.height, 1);
      q._pic = { img, w: img.width * scale, h: img.height * scale };
    } catch (err) {
      q._pic = null; // an unreadable picture should never stop the PDF being produced
    }
  }
  return q._pic;
}

/**
 * Draws (or just measures, when draw is false) a question, or part of one.
 *
 * A question normally lands on a page whole. When a lot of room is left but not enough for all
 * of it, its answer options may carry on at the top of the next page (opts.startRow > 0 draws
 * that continuation). opts.maxY stops the options at the page bottom and opts.maxRows caps how
 * many options this part may hold.
 *
 * Returns { h, next, placed }: the height used, the index of the first option still to draw
 * (null once the question is complete) and how many options this part drew.
 */
function renderQuestion(doc, q, number, x, y, W, draw, picH, opts = {}) {
  const { startRow = 0, maxY = Infinity, maxRows = Infinity } = opts;
  const NUM_W = 30;
  const CHIP_W = 140;
  const body = x + NUM_W;
  const bodyW = W - NUM_W;
  const res = outcome(q);
  let cy = y;

  if (startRow === 0) {
    // question text, with the number badge and the result chip
    doc.font('SemiBold').fontSize(10.5);
    const qH = doc.heightOfString(q.question_text, { width: bodyW - CHIP_W, lineGap: 2 });
    if (draw) {
      doc.circle(x + 10, y + 10, 10).fill(NAVY);
      doc.font('Bold').fontSize(9).fillColor('#ffffff').text(String(number), x, y + 6.3, { width: 20, align: 'center', lineBreak: false });
      doc.font('SemiBold').fontSize(10.5).fillColor(INK).text(q.question_text, body, y + 3, { width: bodyW - CHIP_W, lineGap: 2 });
      chip(doc, res.label, x + W, y + 1, res.fg, res.bg);
    }
    cy += Math.max(qH + 6, 22);

    const pic = pictureFor(doc, q, bodyW);
    if (pic) {
      const ph = picH ?? pic.h; // may have been resized by the page layout
      const pw = pic.w * (ph / pic.h);
      if (draw) {
        doc.image(pic.img, body, cy, { width: pw, height: ph });
        doc.roundedRect(body - 1, cy - 1, pw + 2, ph + 2, 3).lineWidth(0.8).strokeColor(LINE).stroke();
      }
      cy += ph + 8;
    }

    if (draw) doc.font('Regular').fontSize(8).fillColor(MUTED).text(`${TYPE_LABEL[q.question_type] || q.question_type}  |  ${fmt(q.points)} mark${num(q.points) === 1 ? '' : 's'}`, body, cy, { lineBreak: false });
    cy += 14;
  } else {
    // the rest of a question that began on the previous page
    if (draw) {
      doc.circle(x + 9, y + 9, 9).fill(NAVY);
      doc.font('Bold').fontSize(8).fillColor('#ffffff').text(String(number), x, y + 5.6, { width: 18, align: 'center', lineBreak: false });
      doc.font('SemiBold').fontSize(8.5).fillColor(MUTED).text('(continued)', body - 6, y + 4.5, { lineBreak: false });
    }
    cy += 26;
  }

  const answered = String(q.answer_text ?? '').trim() !== '';

  if (q.question_type === 'short_answer') {
    if (draw) doc.font('SemiBold').fontSize(7.5).fillColor(MUTED).text('YOUR ANSWER', body, cy, { characterSpacing: 0.8, lineBreak: false });
    cy += 12;
    const text = answered ? String(q.answer_text).slice(0, 1800) : 'No answer was given.';
    doc.font('Regular').fontSize(9.5);
    const h = doc.heightOfString(text, { width: bodyW - 22, lineGap: 1.5 });
    const boxH = Math.max(30, h + 16);
    if (draw) {
      doc.roundedRect(body, cy, bodyW, boxH, 6).lineWidth(0.8).fillAndStroke(PANEL, LINE);
      doc.font('Regular').fontSize(9.5).fillColor(answered ? INK : MUTED).text(text, body + 11, cy + 8, { width: bodyW - 22, lineGap: 1.5 });
    }
    cy += boxH + 7;
    const pending = q.is_correct === null || q.is_correct === undefined;
    const note = pending
      ? 'Your teacher has not marked this answer yet. Your score will update once it has been marked.'
      : `Marks awarded: ${fmt(q.points_awarded)} out of ${fmt(q.points)}`;
    doc.font('SemiBold').fontSize(9);
    if (draw) doc.fillColor(pending ? WARN : INK).text(note, body, cy, { width: bodyW });
    cy += doc.heightOfString(note, { width: bodyW }) + 4;
    cy += 6;
    if (draw) doc.moveTo(x, cy).lineTo(x + W, cy).lineWidth(0.6).strokeColor(LINE).stroke();
    return { h: cy + 11 - y, next: null, placed: 0 };
  }

  const options = Array.isArray(q.options) ? q.options : [];
  const correctIdx = options.findIndex((o) => eq(o, q.correct_answer));
  const studentIdx = answered ? options.findIndex((o) => eq(o, q.answer_text)) : -1;
  const isMc = q.question_type === 'multiple_choice';
  const TAG_W = 118;
  let placed = 0;
  let next = null;

  for (let i = startRow; i < options.length; i++) {
    const opt = options[i];
    const label = isMc ? `${String.fromCharCode(65 + i)}.  ${opt}` : String(opt);
    doc.font('Regular').fontSize(9.5);
    const th = doc.heightOfString(label, { width: bodyW - 34 - TAG_W });
    const rowH = Math.max(20, th + 9);
    if (cy + rowH > maxY || placed >= maxRows) {
      next = i;
      break;
    }
    const isCorrect = i === correctIdx;
    const isStudent = i === studentIdx;
    if (draw) {
      if (isCorrect) doc.roundedRect(body, cy, bodyW, rowH, 5).fill(GOOD_SOFT);
      else if (isStudent) doc.roundedRect(body, cy, bodyW, rowH, 5).fill(BAD_SOFT);
      const mx = body + 13;
      const my = cy + rowH / 2;
      if (isCorrect) tickIcon(doc, mx, my);
      else if (isStudent) crossIcon(doc, mx, my);
      else doc.circle(mx, my, 6.5).lineWidth(1).strokeColor('#cbd5e1').stroke();
      doc.font(isCorrect || isStudent ? 'SemiBold' : 'Regular').fontSize(9.5).fillColor(INK).text(label, body + 30, cy + (rowH - th) / 2, { width: bodyW - 34 - TAG_W });
      if (isCorrect || isStudent) {
        const tag = isCorrect && isStudent ? 'Your answer (correct)' : isCorrect ? 'Correct answer' : 'Your answer';
        doc.font('SemiBold').fontSize(8).fillColor(isCorrect ? GOOD : BAD).text(tag, body + bodyW - TAG_W - 8, cy + rowH / 2 - 4, { width: TAG_W, align: 'right', lineBreak: false });
      }
    }
    cy += rowH + 2;
    placed += 1;
  }

  if (next !== null) return { h: cy - y, next, placed };

  if (!answered) {
    if (draw) doc.font('SemiBold').fontSize(8.5).fillColor(WARN).text('You did not answer this question.', body, cy + 2, { lineBreak: false });
    cy += 16;
  }
  cy += 6;
  if (draw) doc.moveTo(x, cy).lineTo(x + W, cy).lineWidth(0.6).strokeColor(LINE).stroke();
  return { h: cy + 11 - y, next: null, placed };
}

/**
 * @param {object} d
 * @param {{ full_name: string, class_name: string }} d.student
 * @param {{ title: string, teacher_name: string, max_attempts: number|null }} d.quiz
 * @param {{ attempt_number: number, submitted_at: string, score: number, max_score: number, status: string }} d.attempt
 * @param {Array} d.questions - already in the order this student saw them
 */
function buildAttemptPdf(d) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 44, bottom: 64, left: 44, right: 44 },
    bufferPages: true,
    font: FONT_REGULAR,
    info: { Title: `${d.quiz.title} - results and corrections`, Author: 'MOMA LMS', Subject: `${d.student.full_name} - ${d.quiz.title}` },
  });
  doc.registerFont('Regular', FONT_REGULAR);
  doc.registerFont('SemiBold', FONT_SEMIBOLD);
  doc.registerFont('Bold', FONT_BOLD);

  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const finished = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const L = doc.page.margins.left;
  const W = doc.page.width - L - doc.page.margins.right;
  const limit = doc.page.height - doc.page.margins.bottom;
  const top = doc.page.margins.top;

  // ---------------------------------------------------------------- letterhead
  doc.image(LOGO, L, 38, { width: 70, height: 70 });
  const tx = L + 70 + 16;
  doc.font('Bold').fontSize(16.5).fillColor(NAVY).text(SCHOOL_NAME, tx, 46, { lineBreak: false, characterSpacing: 0.2 });
  doc.font('Regular').fontSize(9.5).fillColor(MUTED).text(SCHOOL_LINE, tx, 69, { lineBreak: false });
  doc.font('SemiBold').fontSize(8).fillColor(GOLD_DARK).text(SCHOOL_MOTTO, tx, 86, { lineBreak: false, characterSpacing: 2 });
  doc.rect(L, 118, W, 2.2).fill(NAVY);
  doc.rect(L, 118, 96, 2.2).fill(GOLD);

  doc.font('Bold').fontSize(15).fillColor(NAVY).text('QUIZ RESULTS AND CORRECTIONS', L, 134, { lineBreak: false, characterSpacing: 1.1 });
  doc.font('Regular').fontSize(9).fillColor(MUTED).text('Your answers, your marks and the correct answers for this quiz.', L, 155, { lineBreak: false });

  // ---------------------------------------------------------------- student and quiz card
  const cardY = 176;
  const pad = 16;
  const scoreW = 134;
  const leftW = W - pad * 2 - scoreW - 14;
  const lx = L + pad;

  doc.font('SemiBold').fontSize(12);
  const titleLine = doc.currentLineHeight();
  const titleH = Math.min(doc.heightOfString(d.quiz.title, { width: leftW }), titleLine * 2);
  const metaText = [
    d.student.class_name && `Class: ${d.student.class_name}`,
    d.quiz.teacher_name && `Teacher: ${d.quiz.teacher_name}`,
    `Attempt ${d.attempt.attempt_number}${d.quiz.max_attempts ? ` of ${d.quiz.max_attempts}` : ''}`,
    `Submitted: ${when(d.attempt.submitted_at)}`,
  ].filter(Boolean).join('   |   ');
  doc.font('Regular').fontSize(8.5);
  const metaH = doc.heightOfString(metaText, { width: leftW, lineGap: 2 });
  const cardH = Math.max(112, 14 + 10 + 20 + 10 + 10 + titleH + 10 + metaH + 14);

  doc.roundedRect(L, cardY, W, cardH, 10).lineWidth(0.8).fillAndStroke(PANEL, LINE);

  let cy = cardY + 14;
  doc.font('SemiBold').fontSize(7.5).fillColor(MUTED).text('STUDENT', lx, cy, { characterSpacing: 0.9, lineBreak: false });
  cy += 11;
  doc.font('Bold').fontSize(14).fillColor(INK).text(fit(doc, d.student.full_name, leftW), lx, cy, { width: leftW, lineBreak: false });
  cy += 24;
  doc.font('SemiBold').fontSize(7.5).fillColor(MUTED).text('QUIZ', lx, cy, { characterSpacing: 0.9, lineBreak: false });
  cy += 11;
  doc.font('SemiBold').fontSize(12).fillColor(NAVY).text(d.quiz.title, lx, cy, { width: leftW, height: titleLine * 2, ellipsis: true });
  cy += titleH + 9;
  doc.font('Regular').fontSize(8.5).fillColor(MUTED).text(metaText, lx, cy, { width: leftW, lineGap: 2 });

  // score panel
  const sx = L + W - pad - scoreW;
  const pct = num(d.attempt.max_score) > 0 ? Math.round((num(d.attempt.score) / num(d.attempt.max_score)) * 100) : 0;
  const fullyMarked = d.attempt.status === 'graded';
  doc.roundedRect(sx, cardY + 14, scoreW, cardH - 28, 9).fill(NAVY);
  doc.font('SemiBold').fontSize(7.5).fillColor('#cbd5e1').text('YOUR SCORE', sx, cardY + 14 + 13, { width: scoreW, align: 'center', characterSpacing: 1, lineBreak: false });
  doc.font('Bold').fontSize(22).fillColor('#ffffff').text(`${fmt(d.attempt.score)} / ${fmt(d.attempt.max_score)}`, sx, cardY + 14 + 28, { width: scoreW, align: 'center', lineBreak: false });
  doc.font('Bold').fontSize(14).fillColor('#facc15').text(`${pct}%`, sx, cardY + 14 + 58, { width: scoreW, align: 'center', lineBreak: false });
  doc.font('SemiBold').fontSize(7).fillColor('#cbd5e1').text(fullyMarked ? 'FULLY MARKED' : 'PARTLY MARKED', sx, cardY + cardH - 14 - 17, { width: scoreW, align: 'center', characterSpacing: 1, lineBreak: false });

  // ---------------------------------------------------------------- summary chips
  const counts = { correct: 0, partial: 0, incorrect: 0, pending: 0 };
  d.questions.forEach((q) => (counts[outcome(q).bucket] += 1));
  const chipY = cardY + cardH + 14;
  let chipX = L;
  [
    ['correct', 'Correct', GOOD, GOOD_SOFT],
    ['partial', 'Partly correct', WARN, WARN_SOFT],
    ['incorrect', 'Incorrect', BAD, BAD_SOFT],
    ['pending', 'Awaiting marking', WARN, WARN_SOFT],
  ].forEach(([key, label, fg, bg]) => {
    if (!counts[key]) return;
    const text = `${counts[key]} ${label}`;
    doc.font('SemiBold').fontSize(8.5);
    const w = doc.widthOfString(text) + 20;
    doc.roundedRect(chipX, chipY, w, 20, 10).fill(bg);
    doc.fillColor(fg).text(text, chipX, chipY + 5.6, { width: w, align: 'center', lineBreak: false });
    chipX += w + 8;
  });
  doc.font('Regular').fontSize(8.5).fillColor(MUTED).text(`${d.questions.length} question${d.questions.length === 1 ? '' : 's'}`, L, chipY + 5.8, { width: W, align: 'right', lineBreak: false });

  // ---------------------------------------------------------------- questions
  let y = chipY + 36;
  doc.font('SemiBold').fontSize(11).fillColor(NAVY).text('Questions, your answers and corrections', L, y, { lineBreak: false });
  doc.rect(L, y + 17, 34, 2.5).fill(GOLD);
  y += 34;

  // Step 1: decide which questions go on which page (measuring only, nothing is drawn yet).
  const pages = [[]];
  let py = y;
  const place = (item) => {
    pages[pages.length - 1].push(item);
    py += item.h;
  };
  const newPage = () => {
    pages.push([]);
    py = top;
  };
  const measure = (q, n, picH, opts) => renderQuestion(doc, q, n, L, 0, W, false, picH, opts);

  d.questions.forEach((q, i) => {
    const n = i + 1;
    const full = measure(q, n).h;

    // 1. it fits: place it whole
    if (py + full <= limit) {
      place({ q, n, h: full });
      return;
    }

    const room = limit - py;

    // 2. it has a picture: shrink the picture by just the missing amount (down to a readable
    //    minimum), so the whole question stays here and no big gap is left
    const pic = pictureFor(doc, q, W - 30);
    if (pic) {
      const target = pic.h - (full - room) - 1;
      if (target >= MIN_PIC_H) {
        place({ q, n, picH: target, h: measure(q, n, target).h });
        return;
      }
    }

    // 3. a lot of room left: put the question and as many options as fit here, and carry the
    //    rest over to the next page (never leaving a single option on its own)
    if (q.question_type !== 'short_answer' && room >= SPLIT_MIN_ROOM) {
      const total = (q.options || []).length;
      const probe = renderQuestion(doc, q, n, L, py, W, false, undefined, { maxY: limit });
      let rows = probe.placed;
      if (probe.next !== null && total - rows === 1) rows -= 1;
      if (probe.next !== null && rows >= 2) {
        place({ q, n, h: measure(q, n, undefined, { maxRows: rows }).h, opts: { maxRows: rows } });
        newPage();
        place({ q, n, h: measure(q, n, undefined, { startRow: rows }).h, opts: { startRow: rows } });
        return;
      }
    }

    // 4. otherwise start a new page
    newPage();
    place({ q, n, h: full });
  });

  // Step 2: draw page by page. Space left at the bottom of a full page is put to use: first by
  // enlarging that page's pictures a little, then by spreading what remains between the questions.
  pages.forEach((items, pageIndex) => {
    if (pageIndex > 0) {
      doc.addPage();
      y = top;
    }
    const isLast = pageIndex === pages.length - 1;
    let spare = limit - (y + items.reduce((t, it) => t + it.h, 0));

    if (!isLast && spare > 6) {
      for (const it of items) {
        if (spare <= 0) break;
        if (it.opts && it.opts.startRow) continue; // a continuation has no picture
        const pic = pictureFor(doc, it.q, W - 30);
        if (!pic) continue;
        const current = it.picH ?? pic.h;
        const maxH = Math.min(pic.h * 1.35, pic.img.height);
        const grow = Math.min(spare, Math.max(0, maxH - current));
        if (grow > 1) {
          it.picH = current + grow;
          it.h = measure(it.q, it.n, it.picH, it.opts).h;
          spare -= grow;
        }
      }
    }

    const gap = !isLast && items.length > 1 && spare > 0 ? Math.min(spare / (items.length - 1), 14) : 0;
    items.forEach((it, i) => {
      const drawn = renderQuestion(doc, it.q, it.n, L, y, W, true, it.picH, it.opts);
      y += drawn.h + (i < items.length - 1 ? gap : 0);
    });
  });

  // ---------------------------------------------------------------- footer on every page
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const p = doc.page;
    p.margins.bottom = 0; // drawing inside the footer area must not start a new page
    const fy = p.height - 46;
    doc.moveTo(L, fy).lineTo(L + W, fy).lineWidth(0.6).strokeColor(LINE).stroke();
    doc.font('SemiBold').fontSize(8).fillColor(INK).text(fit(doc, `${d.student.full_name}  |  ${d.quiz.title}`, W - 90), L, fy + 8, { lineBreak: false });
    doc.font('Regular').fontSize(7.5).fillColor(MUTED).text(`MOMA LMS  |  Generated ${when(new Date())}`, L, fy + 20, { lineBreak: false });
    const pageText = `Page ${i + 1} of ${range.count}`;
    doc.font('Regular').fontSize(8).fillColor(MUTED).text(pageText, L + W - doc.widthOfString(pageText), fy + 8, { lineBreak: false });
  }

  doc.end();
  return finished;
}

module.exports = { buildAttemptPdf };
