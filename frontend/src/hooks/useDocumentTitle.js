import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const APP_NAME = 'MOMA LMS';

const ROUTE_TITLES = [
  { prefix: '/quizzes', title: 'Quizzes' },
  { prefix: '/exercises', title: 'Exercises' },
  { prefix: '/materials', title: 'Materials' },
  { prefix: '/classes', title: 'Classes' },
  { prefix: '/students', title: 'Students' },
  { prefix: '/teachers', title: 'Teachers' },
  { prefix: '/settings', title: 'Settings' },
  { prefix: '/', title: 'Dashboard' },
];

export default function useDocumentTitle() {
  const location = useLocation();

  useEffect(() => {
    const match = ROUTE_TITLES.find((r) => location.pathname.startsWith(r.prefix));
    document.title = match ? `${match.title} - ${APP_NAME}` : APP_NAME;
  }, [location.pathname]);
}
