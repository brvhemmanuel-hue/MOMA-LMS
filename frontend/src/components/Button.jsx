const VARIANTS = {
  accent: 'bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy-deep)] disabled:opacity-50',
  gold: 'bg-[var(--color-gold)] text-[var(--color-navy-deep)] font-semibold hover:brightness-95 disabled:opacity-50',
  outline: 'border border-[var(--color-line)] text-[var(--color-ink)] hover:bg-[var(--color-bg-deep)] disabled:opacity-50',
  danger: 'bg-[var(--color-bad)] text-white hover:brightness-95 disabled:opacity-50',
  ghost: 'text-[var(--color-navy)] hover:bg-[var(--color-bg-deep)] disabled:opacity-50',
};

export default function Button({ variant = 'accent', className = '', children, ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
