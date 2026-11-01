import { useEffect, useState } from 'react';
import { api } from '../api/client';
import Button from '../components/Button';
import Badge from '../components/Badge';
import { formatDateTime } from '../utils/date';

// Lets the navigation badge refresh straight after an approval.
const announce = () => window.dispatchEvent(new Event('moma:pending-changed'));

export default function Approvals() {
  const [pending, setPending] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  function refresh() {
    api.pendingUsers().then((d) => setPending(d.pending)).catch((e) => setError(e.message));
  }
  useEffect(() => {
    document.title = 'Approvals - MOMA LMS';
    refresh();
  }, []);

  async function act(user, action) {
    if (action === 'reject' && !confirm(`Reject ${user.full_name}'s registration? They can register again with corrected details.`)) return;
    setBusyId(user.id);
    setError('');
    try {
      if (action === 'approve') await api.approveUser(user.id);
      else await api.rejectUser(user.id);
      setPending((list) => list.filter((u) => u.id !== user.id));
      announce();
    } catch (err) {
      setError(err.message);
      refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-navy)]">Approvals</h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          New teachers and students can only sign in after you approve their registration.
        </p>
      </div>

      {error && <p className="text-sm text-[var(--color-bad)] bg-[var(--color-bad-soft)] rounded-lg px-3 py-2">{error}</p>}

      {pending === null ? (
        <p className="text-sm text-[var(--color-muted)]">Loading...</p>
      ) : pending.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[var(--color-line)] px-5 py-12 text-center">
          <p className="font-display text-lg text-[var(--color-navy)]">All caught up</p>
          <p className="text-sm text-[var(--color-muted)] mt-1">No registrations are waiting for approval.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[var(--color-line)] overflow-hidden divide-y divide-[var(--color-line)]">
          <div className="px-5 py-3 bg-[var(--color-gold-soft)] text-sm text-[var(--color-gold-deep)] font-medium">
            {pending.length} registration{pending.length === 1 ? '' : 's'} waiting
          </div>
          {pending.map((u) => (
            <div key={u.id} className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-10 h-10 rounded-full bg-[var(--color-navy)] text-white flex items-center justify-center text-sm font-semibold shrink-0">
                  {u.full_name.trim()[0]?.toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{u.full_name}</p>
                  <p className="text-xs text-[var(--color-muted)] truncate">{u.email}</p>
                  <p className="text-xs text-[var(--color-muted)] mt-0.5">
                    <Badge tone={u.role === 'teacher' ? 'gold' : 'navy'}>{u.role === 'teacher' ? 'Teacher' : 'Student'}</Badge>
                    {u.class_name ? <span className="ml-2">{u.class_name}</span> : null}
                    <span className="ml-2">Registered {formatDateTime(u.created_at)}</span>
                  </p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="accent" onClick={() => act(u, 'approve')} disabled={busyId === u.id}>
                  {busyId === u.id ? 'Working...' : 'Approve'}
                </Button>
                <Button variant="outline" onClick={() => act(u, 'reject')} disabled={busyId === u.id}>Reject</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
