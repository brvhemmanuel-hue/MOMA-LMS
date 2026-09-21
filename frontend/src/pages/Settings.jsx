import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { Field } from '../components/Input';
import PasswordInput from '../components/PasswordInput';
import Button from '../components/Button';

export default function Settings() {
  const { user } = useAuth();
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = 'Settings - MOMA LMS';
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (form.new_password !== form.confirm_password) return setError('New passwords do not match');

    setSubmitting(true);
    try {
      await api.changePassword({ current_password: form.current_password, new_password: form.new_password });
      setSuccess('Password updated');
      setForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-md">
      <h1 className="font-display text-2xl text-[var(--color-navy)]">Settings</h1>

      <div className="bg-white rounded-2xl border border-[var(--color-line)] p-5">
        <p className="text-sm font-medium">{user?.full_name}</p>
        <p className="text-xs text-[var(--color-muted)]">{user?.email}</p>
        <p className="text-xs text-[var(--color-muted)] capitalize">{user?.role}{user?.class_name ? ` · ${user.class_name}` : ''}</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[var(--color-line)] p-5 space-y-4">
        <h2 className="font-display text-lg text-[var(--color-navy)]">Change password</h2>
        {error && <p className="text-sm text-[var(--color-bad)] bg-[var(--color-bad-soft)] rounded-lg px-3 py-2">{error}</p>}
        {success && <p className="text-sm text-[var(--color-good)] bg-[var(--color-good-soft)] rounded-lg px-3 py-2">{success}</p>}

        <Field label="Current password">
          <PasswordInput value={form.current_password} onChange={(e) => setForm({ ...form, current_password: e.target.value })} required />
        </Field>
        <Field label="New password" hint="At least 6 characters">
          <PasswordInput value={form.new_password} onChange={(e) => setForm({ ...form, new_password: e.target.value })} required minLength={6} />
        </Field>
        <Field label="Confirm new password">
          <PasswordInput value={form.confirm_password} onChange={(e) => setForm({ ...form, confirm_password: e.target.value })} required minLength={6} />
        </Field>

        <Button type="submit" variant="accent" disabled={submitting}>
          {submitting ? 'Updating...' : 'Update password'}
        </Button>
      </form>
    </div>
  );
}
