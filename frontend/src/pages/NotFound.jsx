import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import Button from '../components/Button';

export default function NotFound() {
  useEffect(() => {
    document.title = 'Page not found - MOMA LMS';
  }, []);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <p className="font-display text-6xl text-[var(--color-navy)] mb-2">404</p>
      <h1 className="text-lg font-semibold text-[var(--color-ink)] mb-2">Page not found</h1>
      <p className="text-[var(--color-muted)] text-sm max-w-sm mb-6">
        The page you're looking for doesn't exist, or you may not have permission to view it.
      </p>
      <Link to="/">
        <Button variant="accent">Back to dashboard</Button>
      </Link>
    </div>
  );
}
