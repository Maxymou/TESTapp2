const request = async (path, { method = 'GET', body } = {}) => {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Erreur HTTP ${response.status}`);
    error.status = response.status;
    if (response.status === 401 && path !== '/api/auth/login' && path !== '/api/auth/me') {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    throw error;
  }
  return payload;
};

export const authApi = {
  login: (username, password) => request('/api/auth/login', { method: 'POST', body: { username, password } }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  me: () => request('/api/auth/me')
};

export const adminApi = {
  listUsers: () => request('/api/admin/users'),
  createUser: (data) => request('/api/admin/users', { method: 'POST', body: data }),
  updateUser: (id, data) => request(`/api/admin/users/${id}`, { method: 'PATCH', body: data }),
  deleteUser: (id) => request(`/api/admin/users/${id}`, { method: 'DELETE' }),
  resetPassword: (id, password) => request(`/api/admin/users/${id}/reset-password`, { method: 'POST', body: { password } })
};
