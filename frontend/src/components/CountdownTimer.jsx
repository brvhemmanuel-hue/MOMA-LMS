import { useEffect, useRef, useState } from 'react';

/**
 * Counts down to `expiresAt` (a Date or ISO string), calling onExpire
 * exactly once when it reaches zero. Used for timed quiz attempts, where
 * the deadline is computed once at attempt start (started_at + limit) so
 * a page refresh doesn't grant extra time.
 */
export default function CountdownTimer({ expiresAt, onExpire }) {
  const [remainingMs, setRemainingMs] = useState(() => new Date(expiresAt) - new Date());
  const firedRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = new Date(expiresAt) - new Date();
      setRemainingMs(remaining);
      if (remaining <= 0 && !firedRef.current) {
        firedRef.current = true;
        clearInterval(interval);
        onExpire?.();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const isLow = totalSeconds <= 60;

  return (
    <div
      className={`font-mono text-sm font-semibold px-3 py-1.5 rounded-lg ${
        isLow ? 'bg-[var(--color-bad-soft)] text-[var(--color-bad)]' : 'bg-[var(--color-navy)]/10 text-[var(--color-navy)]'
      }`}
    >
      ⏱ {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
    </div>
  );
}
