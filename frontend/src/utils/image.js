/**
 * Gets a picture ready to upload as a question image. Large photos (a phone camera
 * easily produces 4 MB or more) and formats the PDF cannot embed (WebP, GIF) are
 * redrawn as a JPEG of a sensible size first, so uploads are quick and always accepted.
 */
const MAX_SIDE = 1600;

export async function prepareImage(file) {
  if (!file || !String(file.type).startsWith('image/')) throw new Error('Please choose a picture (PNG or JPEG).');

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('That picture could not be read. Please use a PNG or JPEG file.');
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const plainFormat = file.type === 'image/png' || file.type === 'image/jpeg';
  if (plainFormat && scale === 1 && file.size <= 1.5 * 1024 * 1024) return file;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; // JPEG has no transparency
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
  if (!blob) throw new Error('That picture could not be prepared. Please try another one.');
  const base = (file.name || 'picture').replace(/\.[^.]+$/, '');
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
}
