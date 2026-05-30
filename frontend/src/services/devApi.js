const jsonHeaders = (token) => ({
  'Content-Type': 'application/json',
  ...(token ? { 'x-dev-admin-token': token } : {})
});

const request = async (path, { method = 'GET', token, body } = {}) => {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: jsonHeaders(token),
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Erreur HTTP ${response.status}`);
  }
  return payload;
};

export const devApi = {
  health: (token) => request('/api/dev/health', { token }),
  update: (token, mode = 'normal') => request('/api/dev/update', { method: 'POST', token, body: { mode } }),
  restart: (token) => request('/api/dev/restart', { method: 'POST', token }),
  docker: (token) => request('/api/dev/docker', { token }),
  logs: (token) => request('/api/dev/logs', { token })
};
