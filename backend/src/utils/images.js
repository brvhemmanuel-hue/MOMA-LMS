/**
 * Question pictures. They are uploaded to Vercel Blob and only the URL is stored.
 * Because the server fetches these URLs itself when it builds a results PDF,
 * only addresses on the Blob domain are ever accepted (otherwise a teacher could
 * point the server at an arbitrary address). ALLOWED_IMAGE_HOSTS can widen the
 * list for local development.
 */

function allowedHosts() {
  return (process.env.ALLOWED_IMAGE_HOSTS || 'public.blob.vercel-storage.com')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowedImageUrl(url) {
  try {
    const u = new URL(url);
    const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) return false;
    const host = u.hostname.toLowerCase();
    return allowedHosts().some((h) => host === h || host.endsWith('.' + h));
  } catch {
    return false;
  }
}

/** PNG and JPEG only (what the PDF generator can embed). Checks the file's real bytes, not its name. */
function detectImageType(buf) {
  if (!buf || buf.length < 4) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  return null;
}

const MAX_BYTES = 5 * 1024 * 1024;

/** Downloads a stored question picture for the PDF. Returns null on any problem, so the PDF still builds. */
async function fetchImage(url) {
  if (!url || !isAllowedImageUrl(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES || !detectImageType(buf)) return null;
    return buf;
  } catch (err) {
    console.warn('[images] Could not fetch question picture', err.message);
    return null;
  }
}

module.exports = { isAllowedImageUrl, detectImageType, fetchImage };
