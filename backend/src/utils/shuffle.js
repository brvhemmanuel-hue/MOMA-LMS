/**
 * Per-attempt question order.
 *
 * When a quiz has "shuffle questions" switched on, every attempt gets its own
 * order. The order is worked out from the attempt's id, so it is always the
 * same for that attempt: it survives a page refresh, and the review screen and
 * the downloadable PDF show the questions in exactly the order the student
 * answered them, with no need to store the order anywhere.
 *
 * Question numbers are positional (1, 2, 3 ... in the order shown), so they
 * always run in sequence whatever the order is.
 */

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// mulberry32: a small, fast, seedable random number generator.
function seededRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {Array} items - anything with an `order_index` (the teacher's original order)
 * @param {string} attemptId
 * @param {boolean} enabled - the quiz's shuffle_questions flag
 */
function orderForAttempt(items, attemptId, enabled) {
  const sorted = [...items].sort((a, b) => a.order_index - b.order_index);
  if (!enabled) return sorted;
  const rand = seededRandom(hashSeed(String(attemptId)));
  for (let i = sorted.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
  }
  return sorted;
}

module.exports = { orderForAttempt };
