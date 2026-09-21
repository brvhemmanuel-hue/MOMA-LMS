import { useState, useEffect } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useDocumentTitle from '../hooks/useDocumentTitle';

const TEACHER_NAV = [
  { to: '/', label: 'Dashboard', icon: DashboardIcon, end: true },
  { to: '/quizzes', label: 'Quizzes', icon: QuizIcon },
  { to: '/exercises', label: 'Exercises', icon: ExerciseIcon },
  { to: '/materials', label: 'Materials', icon: MaterialIcon },
  { to: '/classes', label: 'Classes', icon: ClassIcon },
  { to: '/students', label: 'Students', icon: StudentsIcon },
];

const STUDENT_NAV = [
  { to: '/', label: 'Dashboard', icon: DashboardIcon, end: true },
  { to: '/quizzes', label: 'Quizzes', icon: QuizIcon },
  { to: '/exercises', label: 'Exercises', icon: ExerciseIcon },
  { to: '/materials', label: 'Materials', icon: MaterialIcon },
];

const ADMIN_NAV = [
  { to: '/', label: 'Dashboard', icon: DashboardIcon, end: true },
  { to: '/students', label: 'Students', icon: StudentsIcon },
  { to: '/teachers', label: 'Teachers', icon: TeachersIcon },
  { to: '/classes', label: 'Classes', icon: ClassIcon },
  { to: '/quizzes', label: 'Quizzes', icon: QuizIcon },
  { to: '/exercises', label: 'Exercises', icon: ExerciseIcon },
  { to: '/materials', label: 'Materials', icon: MaterialIcon },
];

const ROLE_LABELS = { teacher: 'Teacher', student: 'Student', admin: 'Admin' };

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  useDocumentTitle();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const navItems = user?.role === 'teacher' ? TEACHER_NAV : user?.role === 'admin' ? ADMIN_NAV : STUDENT_NAV;
  const quickItems = navItems.slice(0, 5);

  function handleSignOut() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen flex bg-[var(--color-bg)]">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col w-64 shrink-0 bg-[var(--color-navy)] text-white no-print relative overflow-hidden">
        <img src="/logo-watermark.png" alt="" className="absolute -bottom-16 -right-16 w-72 opacity-[0.06] pointer-events-none select-none" />
        <Link to="/" className="flex items-center gap-3 px-6 py-6 border-b border-white/10 hover:bg-white/5 transition-colors relative z-10">
          <img src="/logo.png" alt="MOMA" className="w-11 h-11 rounded-full bg-white p-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="font-display text-base leading-tight">Mount Olivet</p>
            <p className="text-[11px] tracking-widest uppercase text-[var(--color-gold)] mt-0.5">MOMA LMS</p>
          </div>
        </Link>

        <nav className="flex-1 px-3 py-6 space-y-1 relative z-10">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {item.label}
            </NavLink>
          ))}
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'
              }`
            }
          >
            <SettingsIcon className="w-5 h-5 shrink-0" />
            Settings
          </NavLink>
        </nav>

        <div className="px-4 py-4 border-t border-white/10 relative z-10">
          <p className="text-sm font-medium truncate">{user?.full_name}</p>
          <p className="text-xs text-[var(--color-gold)] mb-1">{ROLE_LABELS[user?.role]}</p>
          {user?.class_name && <p className="text-xs text-white/40 mb-3">{user.class_name}</p>}
          <button onClick={handleSignOut} className="text-xs text-white/60 hover:text-[var(--color-gold)] transition-colors">
            Sign out
          </button>
          <p className="text-[10px] text-white/25 mt-4">© {new Date().getFullYear()} Mount Olivet Methodist Academy</p>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[var(--color-navy)] text-white sticky top-0 z-20 no-print">
          <Link to="/" className="flex items-center gap-2 min-w-0">
            <img src="/logo.png" alt="MOMA" className="w-8 h-8 rounded-full bg-white p-0.5 shrink-0" />
            <div className="min-w-0">
              <span className="font-display text-sm leading-none block truncate">Mount Olivet</span>
              <span className="text-[10px] text-[var(--color-gold)] block truncate tracking-wide">MOMA LMS</span>
            </div>
          </Link>
          <button onClick={() => setMenuOpen(true)} aria-label="Open menu" className="text-white/80 hover:text-white p-1 -m-1 shrink-0">
            <MenuIcon className="w-6 h-6" />
          </button>
        </header>

        <main className="flex-1 px-4 md:px-8 py-6 pb-24 md:pb-8 max-w-6xl w-full mx-auto">{children}</main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-[var(--color-line)] flex items-stretch z-20 no-print">
          {quickItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-1 h-14 text-[10px] font-medium leading-none ${
                  isActive ? 'text-[var(--color-navy)]' : 'text-[var(--color-muted)]'
                }`
              }
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
          <button onClick={() => setMenuOpen(true)} className="flex-1 flex flex-col items-center justify-center gap-1 h-14 text-[10px] font-medium leading-none text-[var(--color-muted)]">
            <MoreIcon className="w-5 h-5 shrink-0" />
            <span>More</span>
          </button>
        </nav>
      </div>

      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-30 no-print">
          <button aria-label="Close menu" onClick={() => setMenuOpen(false)} className="absolute inset-0 bg-black/40" />
          <div className="absolute right-0 top-0 bottom-0 w-72 max-w-[85vw] bg-[var(--color-navy)] text-white flex flex-col shadow-xl animate-[slideIn_0.2s_ease-out]">
            <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{user?.full_name}</p>
                <p className="text-xs text-[var(--color-gold)]">{ROLE_LABELS[user?.role]}</p>
                {user?.class_name && <p className="text-xs text-white/40 mt-0.5 truncate">{user.class_name}</p>}
              </div>
              <button onClick={() => setMenuOpen(false)} aria-label="Close menu" className="text-white/60 hover:text-white p-1 shrink-0">
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  {item.label}
                </NavLink>
              ))}
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                <SettingsIcon className="w-5 h-5 shrink-0" />
                Settings
              </NavLink>
            </nav>

            <div className="px-5 py-4 border-t border-white/10">
              <button onClick={() => { setMenuOpen(false); handleSignOut(); }} className="text-sm text-white/70 hover:text-[var(--color-gold)] transition-colors">
                Sign out
              </button>
              <p className="text-[10px] text-white/25 mt-3">© {new Date().getFullYear()} Mount Olivet Methodist Academy</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
function QuizIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}
function ExerciseIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" />
      <path d="M9 13h6M9 17h6" />
    </svg>
  );
}
function MaterialIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}
function ClassIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function StudentsIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M22 10L12 5 2 10l10 5 10-5z" /><path d="M6 12v5c0 1.5 2.5 3 6 3s6-1.5 6-3v-5" />
    </svg>
  );
}
function TeachersIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="3" y="4" width="18" height="14" rx="2" /><path d="M3 9h18" /><path d="M8 14h.01M12 14h4" />
    </svg>
  );
}
function SettingsIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
function MenuIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}
function MoreIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}
function CloseIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
