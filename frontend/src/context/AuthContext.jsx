import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('moma_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then((d) => setUser(d.user))
      .catch(() => api.setToken(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const data = await api.login({ email, password });
    api.setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  async function register(payload) {
    // New accounts wait for the admin's approval, so there is no sign-in yet.
    return api.register(payload);
  }

  function logout() {
    api.setToken(null);
    setUser(null);
  }

  const isTeacher = user?.role === 'teacher';
  const isStudent = user?.role === 'student';
  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, isTeacher, isStudent, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
