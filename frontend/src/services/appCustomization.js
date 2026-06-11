const jsonRequest = async (path, { method = 'GET', body } = {}) => {
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
    if (response.status === 401) window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    throw error;
  }
  return payload;
};

const fileRequest = async (path, file) => {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'X-Requested-With': 'XMLHttpRequest',
      'X-File-Name': encodeURIComponent(file.name || 'image')
    },
    body: file
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Erreur HTTP ${response.status}`);
    error.status = response.status;
    if (response.status === 401) window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    throw error;
  }
  return payload;
};

export const getAppCustomization = () => jsonRequest('/api/app-customization');
export const updateAppCustomization = (payload) => jsonRequest('/api/app-customization', { method: 'POST', body: payload });
export const uploadAppLogo = (file) => fileRequest('/api/app-customization/logo', file);
export const uploadPwaIcon = (file) => fileRequest('/api/app-customization/pwa-icon', file);
export const resetAppCustomization = () => jsonRequest('/api/app-customization/reset', { method: 'POST' });
