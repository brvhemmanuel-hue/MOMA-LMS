export function Field({ label, hint, error, children }) {
  return (
    <label className="block">
      {label && <span className="block text-sm font-medium text-[var(--color-ink-soft)] mb-1.5">{label}</span>}
      {children}
      {hint && !error && <span className="block text-xs text-[var(--color-muted)] mt-1">{hint}</span>}
      {error && <span className="block text-xs text-[var(--color-bad)] mt-1">{error}</span>}
    </label>
  );
}

const baseInputClass =
  'w-full rounded-lg border border-[var(--color-line)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-navy-soft)] focus:ring-1 focus:ring-[var(--color-navy-soft)] outline-none transition-colors disabled:opacity-60 disabled:bg-[var(--color-bg-deep)]';

export function Input({ className = '', ...props }) {
  return <input className={`${baseInputClass} ${className}`} {...props} />;
}

export function TextArea({ className = '', ...props }) {
  return <textarea className={`${baseInputClass} resize-y ${className}`} {...props} />;
}

export function Select({ className = '', children, ...props }) {
  return (
    <select className={`${baseInputClass} ${className}`} {...props}>
      {children}
    </select>
  );
}
