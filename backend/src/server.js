import express from 'express';

const app = express();
const port = Number(process.env.PORT || 3000);
const hostApiUrl = process.env.DEV_HOST_API_URL || 'http://host.docker.internal:4878';
const requestTimeoutMs = Number(process.env.DEV_REQUEST_TIMEOUT_MS || 120000);
const adminToken = process.env.DEV_ADMIN_TOKEN || '';
const hostToken = process.env.DEV_ALLOWED_TOKEN || '';

app.use(express.json({ limit: '16kb' }));

const publicBackendStatus = () => ({
  status: 'ok',
  service: 'backend',
  uptimeSeconds: Math.round(process.uptime()),
  nodeVersion: process.version,
  environment: process.env.NODE_ENV || 'development',
  appVersion: process.env.APP_VERSION || '0.1.0',
  timestamp: new Date().toISOString()
});

const requireAdmin = (req, res, next) => {
  const token = req.get('x-dev-admin-token');
  if (!adminToken || adminToken === 'change-me-admin-token') {
    return res.status(503).json({ error: 'DEV_ADMIN_TOKEN doit être configuré avant usage.' });
  }
  if (!token || token !== adminToken) {
    return res.status(401).json({ error: 'Token DEV invalide.' });
  }
  return next();
};

const callHost = async (path, { method = 'GET', body } = {}) => {
  if (!hostToken || hostToken === 'change-me-host-token') {
    throw new Error('DEV_ALLOWED_TOKEN doit être configuré côté backend.');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(`${hostApiUrl}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-dev-host-token': hostToken
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || `Host API HTTP ${response.status}`);
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
};

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'backend' });
});

app.get('/api/dev/health', requireAdmin, async (_req, res) => {
  const backend = publicBackendStatus();
  try {
    const host = await callHost('/status');
    res.json({ backend, host: { ...host, url: hostApiUrl } });
  } catch (error) {
    res.json({ backend, host: { status: 'unreachable', url: hostApiUrl, lastError: error.message } });
  }
});

app.post('/api/dev/update', requireAdmin, async (req, res) => {
  const mode = req.body?.mode;
  if (!['normal', 'force-pwa'].includes(mode)) {
    return res.status(400).json({ error: 'Mode update invalide.' });
  }
  const result = await callHost('/update', { method: 'POST', body: { mode } });
  return res.json(result);
});

app.post('/api/dev/restart', requireAdmin, async (_req, res) => {
  const result = await callHost('/restart', { method: 'POST' });
  return res.json(result);
});

app.get('/api/dev/docker', requireAdmin, async (_req, res) => {
  const result = await callHost('/docker');
  return res.json(result);
});

app.get('/api/dev/logs', requireAdmin, async (_req, res) => {
  const result = await callHost('/logs');
  return res.json(result);
});

app.use((error, _req, res, _next) => {
  res.status(500).json({ error: error.message || 'Erreur serveur' });
});

app.listen(port, () => {
  console.log(`PWA Test Lab backend listening on ${port}`);
});
