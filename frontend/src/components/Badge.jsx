const TONES = {
  navy: 'bg-[var(--color-navy)]/10 text-[var(--color-navy)]',
  gold: 'bg-[var(--color-gold-soft)] text-[var(--color-gold-deep)]',
  good: 'bg-[var(--color-good-soft)] text-[var(--color-good)]',
  warn: 'bg-[var(--color-warn-soft)] text-[var(--color-warn)]',
  bad: 'bg-[var(--color-bad-soft)] text-[var(--color-bad)]',
  muted: 'bg-[var(--color-bg-deep)] text-[var(--color-muted)]',
};

export default function Badge({ tone = 'muted', children }) {
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${TONES[tone]}`}>
      {children}
    </span>
  );
}
