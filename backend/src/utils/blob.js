const { put, del } = require('@vercel/blob');

/**
 * Uploads a buffer (from a multer memory-storage file) to Vercel Blob and
 * returns its public URL. Vercel Blob is used rather than local disk
 * because the backend runs as a serverless function - there is no
 * persistent filesystem between invocations, so anything written to disk
 * during one request would be gone by the next.
 *
 * @param {Buffer} buffer
 * @param {string} originalName - used to keep the file extension
 * @param {string} folder - a path prefix to keep uploads organized, e.g. 'materials'
 */
async function uploadBuffer(buffer, originalName, folder) {
  const safeName = originalName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

  const blob = await put(key, buffer, {
    access: 'public',
    addRandomSuffix: false,
  });

  return { url: blob.url, name: originalName };
}

async function deleteBlob(url) {
  try {
    await del(url);
  } catch (err) {
    // Non-fatal: an already-deleted or external URL shouldn't block the
    // database row from being removed.
    console.warn('[blob] Failed to delete blob', url, err.message);
  }
}

module.exports = { uploadBuffer, deleteBlob };
