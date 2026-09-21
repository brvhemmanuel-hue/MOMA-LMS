import { useState, useEffect } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Field, Input } from '../components/Input';
import PasswordInput from '../components/PasswordInput';
import Button from '../components/Button';

export default function Login() {
  const { user, login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = 'Sign in - MOMA LMS';
  }, []);

  if (!loading && user) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-[var(--color-navy-deep)]">
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
      <div className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full border border-[var(--color-gold)]/10" />
      <div className="pointer-events-none absolute -bottom-32 -left-32 w-96 h-96 rounded-full border border-[var(--color-gold)]/10" />

      <div className="w-full max-w-sm relative">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Mount Olivet Methodist Academy" className="w-20 h-20 mx-auto rounded-full bg-white p-1 shadow-lg" />
          <h1 className="font-display text-2xl text-white mt-4">Mount Olivet Methodist Academy</h1>
          <p className="text-xs tracking-[0.3em] uppercase text-[var(--color-gold)] mt-1">MOMA LMS</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 space-y-4">
          <div>
            <h2 className="font-display text-lg text-[var(--color-navy)]">Welcome back</h2>
            <p className="text-sm text-[var(--color-muted)] mt-0.5">Sign in to continue</p>
          </div>

          {error && <p className="text-sm text-[var(--color-bad)] bg-[var(--color-bad-soft)] rounded-lg px-3 py-2">{error}</p>}

          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus placeholder="you@example.com" />
          </Field>
          <Field label="Password">
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
          </Field>

          <Button type="submit" variant="accent" className="w-full" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign in'}
          </Button>

          <p className="text-center text-sm text-[var(--color-muted)]">
            New here?{' '}
            <Link to="/register" className="font-medium text-[var(--color-navy)] hover:underline">
              Create an account
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
