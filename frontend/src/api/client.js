const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function getToken() {
  return localStorage.getItem('moma_token');
}

async function request(path, { method = 'GET', body, isForm = false, responseType = 'json' } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isForm && body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (responseType === 'blob') {
    if (!res.ok) {
      let message = 'Request failed';
      try {
        const data = await res.json();
        message = data.error || message;
      } catch {
        // response wasn't JSON (e.g. a real file came back on error somehow); keep default message
      }
      throw new Error(message);
    }
    return res.blob();
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export const api = {
  setToken(token) {
    if (token) localStorage.setItem('moma_token', token);
    else localStorage.removeItem('moma_token');
  },

  // auth
  register: (body) => request('/api/auth/register', { method: 'POST', body }),
  login: (body) => request('/api/auth/login', { method: 'POST', body }),
  me: () => request('/api/auth/me'),
  changePassword: (body) => request('/api/auth/change-password', { method: 'POST', body }),

  // classes
  listClasses: () => request('/api/classes'),
  createClass: (body) => request('/api/classes', { method: 'POST', body }),
  updateClass: (id, body) => request(`/api/classes/${id}`, { method: 'PUT', body }),
  deleteClass: (id) => request(`/api/classes/${id}`, { method: 'DELETE' }),

  // quizzes
  listQuizzes: (params = '') => request(`/api/quizzes${params}`),
  getQuiz: (id) => request(`/api/quizzes/${id}`),
  createQuiz: (body) => request('/api/quizzes', { method: 'POST', body }),
  updateQuiz: (id, body) => request(`/api/quizzes/${id}`, { method: 'PUT', body }),
  deleteQuiz: (id) => request(`/api/quizzes/${id}`, { method: 'DELETE' }),
  parseQuizDocx: (file) => {
    const form = new FormData();
    form.append('file', file);
    return request('/api/quizzes/parse-docx', { method: 'POST', body: form, isForm: true });
  },
  async downloadQuizTemplate() {
    const blob = await request('/api/quizzes/template.docx', { responseType: 'blob' });
    downloadBlob(blob, 'moma-lms-quiz-template.docx');
  },
  startQuizAttempt: (quizId) => request(`/api/quizzes/${quizId}/attempts`, { method: 'POST' }),
  submitQuizAttempt: (quizId, body) => request(`/api/quizzes/${quizId}/attempts/submit`, { method: 'POST', body }),
  myQuizAttempts: (quizId) => request(`/api/quizzes/${quizId}/attempts/mine`),
  quizGradebook: (quizId) => request(`/api/quizzes/${quizId}/attempts`),
  quizStudentAttempt: (quizId, studentId) => request(`/api/quizzes/${quizId}/attempts/student/${studentId}`),
  gradeQuizAnswer: (quizId, attemptId, answerId, body) =>
    request(`/api/quizzes/${quizId}/attempts/${attemptId}/answers/${answerId}`, { method: 'PUT', body }),
  async exportQuizGradebook(quizId, quizTitle) {
    const blob = await request(`/api/quizzes/${quizId}/attempts/export`, { responseType: 'blob' });
    downloadBlob(blob, `${quizTitle.replace(/[^a-z0-9]/gi, '-')}-results.xlsx`);
  },

  // exercises
  listExercises: (params = '') => request(`/api/exercises${params}`),
  getExercise: (id) => request(`/api/exercises/${id}`),
  createExercise: (formData) => request('/api/exercises', { method: 'POST', body: formData, isForm: true }),
  updateExercise: (id, formData) => request(`/api/exercises/${id}`, { method: 'PUT', body: formData, isForm: true }),
  deleteExercise: (id) => request(`/api/exercises/${id}`, { method: 'DELETE' }),
  submitExercise: (id, formData) => request(`/api/exercises/${id}/submissions`, { method: 'POST', body: formData, isForm: true }),
  gradeExerciseSubmission: (exerciseId, submissionId, body) =>
    request(`/api/exercises/${exerciseId}/submissions/${submissionId}`, { method: 'PUT', body }),
  async exportExerciseGrades(exerciseId, title) {
    const blob = await request(`/api/exercises/${exerciseId}/export`, { responseType: 'blob' });
    downloadBlob(blob, `${title.replace(/[^a-z0-9]/gi, '-')}-grades.xlsx`);
  },

  // materials
  listMaterials: (params = '') => request(`/api/materials${params}`),
  createMaterial: (formData) => request('/api/materials', { method: 'POST', body: formData, isForm: true }),
  deleteMaterial: (id) => request(`/api/materials/${id}`, { method: 'DELETE' }),

  // dashboard
  teacherDashboard: () => request('/api/dashboard/teacher'),
  studentDashboard: () => request('/api/dashboard/student'),
  adminDashboard: () => request('/api/dashboard/admin'),

  // users (students/teachers management)
  listStudents: (params = '') => request(`/api/users/students${params}`),
  updateStudent: (id, body) => request(`/api/users/students/${id}`, { method: 'PUT', body }),
  deleteStudent: (id) => request(`/api/users/students/${id}`, { method: 'DELETE' }),
  studentReport: (id) => request(`/api/users/students/${id}/report`),
  listTeachers: () => request('/api/users/teachers'),
};
