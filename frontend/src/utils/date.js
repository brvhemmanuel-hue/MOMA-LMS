export function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-GB', { dateStyle: 'medium' });
}

/** Local "YYYY-MM-DDTHH:mm" string suitable for a datetime-local input's value. */
export function toDateTimeInput(value) {
  if (!value) return '';
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function isPast(value) {
  return value ? new Date(value) < new Date() : false;
}

export function timeUntil(value) {
  if (!value) return '';
  const diffMs = new Date(value) - new Date();
  if (diffMs <= 0) return 'now';
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'}`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}
