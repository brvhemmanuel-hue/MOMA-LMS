import { useState, useEffect } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { Field, Input, Select } from '../components/Input';
import PasswordInput from '../components/PasswordInput';
import Button from '../components/Button';

export default function Register() {
  const { user, register, loading } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState('student');
  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState({ full_name: '', email: '', password: '', class_id: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = 'Create account - MOMA LMS';
    api.listClasses().then((d) => setClasses(d.classes)).catch(() => {});
  }, []);

  if (!loading && user) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (role === 'student' && !form.class_id) {
      setError('Please select your class');
      return;
    }

    setSubmitting(true);
    try {
      await register({ ...form, role });
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 relative overflow-hidden bg-[var(--color-navy-deep)]">
      <div
        className="absolute inset-0 bg-cover bg-no-repeat"
        style={{ backgroundImage: "url('/login-bg.jpg')", backgroundPosition: 'center 35%' }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(12,23,64,0.80) 0%, rgba(12,23,64,0.90) 55%, rgba(12,23,64,0.96) 100%)' }}
        aria-hidden="true"
      />

      <div className="w-full max-w-md relative">
        <div className="text-center mb-6">
          <img src="/logo.png" alt="Mount Olivet Methodist Academy" className="w-16 h-16 mx-auto rounded-full bg-white p-1 shadow-lg" />
          <h1 className="font-display text-xl text-white mt-3">Mount Olivet Methodist Academy</h1>
          <p className="text-xs tracking-[0.3em] uppercase text-[var(--color-gold)] mt-1">MOMA LMS</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 space-y-4">
          <div>
            <h2 className="font-display text-lg text-[var(--color-navy)]">Create your account</h2>
          </div>

          {error && <p className="text-sm text-[var(--color-bad)] bg-[var(--color-bad-soft)] rounded-lg px-3 py-2">{error}</p>}

          <div className="grid grid-cols-2 gap-2">
            {['student', 'teacher'].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`py-2.5 rounded-lg text-sm font-medium border transition-colors capitalize ${
                  role === r ? 'bg-[var(--color-navy)] text-white border-[var(--color-navy)]' : 'border-[var(--color-line)] text-[var(--color-ink-soft)]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <Field label="Full name">
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required autoFocus />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </Field>
          <Field label="Password" hint="At least 6 characters">
            <PasswordInput value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
          </Field>

          {role === 'student' && (
            <Field label="Your class">
              <Select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} required>
                <option value="">Select your class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
              {classes.length === 0 && (
                <p className="text-xs text-[var(--color-warn)] mt-1">
                  No classes have been created yet. Ask a teacher to create your class first.
                </p>
              )}
            </Field>
          )}

          <Button type="submit" variant="accent" className="w-full" disabled={submitting}>
            {submitting ? 'Creating account...' : 'Create account'}
          </Button>

          <p className="text-center text-sm text-[var(--color-muted)]">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-[var(--color-navy)] hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
