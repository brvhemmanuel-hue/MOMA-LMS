import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';

import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Classes from './pages/Classes';
import Quizzes from './pages/Quizzes';
import QuizForm from './pages/QuizForm';
import QuizTake from './pages/QuizTake';
import QuizGradebook from './pages/QuizGradebook';
import Exercises from './pages/Exercises';
import ExerciseForm from './pages/ExerciseForm';
import ExerciseDetail from './pages/ExerciseDetail';
import Materials from './pages/Materials';
import Students from './pages/Students';
import StudentReport from './pages/StudentReport';
import Teachers from './pages/Teachers';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-[var(--color-muted)]">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/classes" element={<ProtectedRoute roles={['teacher', 'admin']}><Classes /></ProtectedRoute>} />

          <Route path="/students" element={<ProtectedRoute roles={['teacher', 'admin']}><Students /></ProtectedRoute>} />
          <Route path="/students/:id/report" element={<ProtectedRoute roles={['teacher', 'admin']}><StudentReport /></ProtectedRoute>} />
          <Route path="/teachers" element={<ProtectedRoute roles={['admin']}><Teachers /></ProtectedRoute>} />

          <Route path="/quizzes" element={<ProtectedRoute><Quizzes /></ProtectedRoute>} />
          <Route path="/quizzes/new" element={<ProtectedRoute roles={['teacher']}><QuizForm /></ProtectedRoute>} />
          <Route path="/quizzes/:id/edit" element={<ProtectedRoute roles={['teacher', 'admin']}><QuizForm /></ProtectedRoute>} />
          <Route path="/quizzes/:id/results" element={<ProtectedRoute roles={['teacher', 'admin']}><QuizGradebook /></ProtectedRoute>} />
          <Route path="/quizzes/:id" element={<ProtectedRoute><QuizTake /></ProtectedRoute>} />

          <Route path="/exercises" element={<ProtectedRoute><Exercises /></ProtectedRoute>} />
          <Route path="/exercises/new" element={<ProtectedRoute roles={['teacher']}><ExerciseForm /></ProtectedRoute>} />
          <Route path="/exercises/:id" element={<ProtectedRoute><ExerciseDetail /></ProtectedRoute>} />

          <Route path="/materials" element={<ProtectedRoute><Materials /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

          <Route path="*" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
