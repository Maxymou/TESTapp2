const jsonHeaders = (token) => ({
  'Content-Type': 'application/json',
  ...(token ? { 'x-dev-admin-token': token } : {})
});

const request = async (path, { method = 'GET', token, body, signal } = {}) => {
  let response;
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: jsonHeaders(token),
      body: body ? JSON.stringify(body) : undefined,
      signal
    });
  } catch (error) {
    error.isNetworkError = true;
    throw error;
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Erreur HTTP ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
};

export const devApi = {
  health: (token, options = {}) => request('/api/dev/health', { token, ...options }),
  update: (token, mode = 'normal', options = {}) => request('/api/dev/update', { method: 'POST', token, body: { mode }, ...options }),
  restart: (token) => request('/api/dev/restart', { method: 'POST', token }),
  docker: (token) => request('/api/dev/docker', { token }),
  logs: (token) => request('/api/dev/logs', { token })
};
