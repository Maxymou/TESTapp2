import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';

const app = express();
const port = Number(process.env.PORT || 3000);
const hostApiUrl = process.env.DEV_HOST_API_URL || 'http://host.docker.internal:4878';
const requestTimeoutMs = Number(process.env.DEV_REQUEST_TIMEOUT_MS || 120000);
const adminToken = process.env.DEV_ADMIN_TOKEN || '';
const hostToken = process.env.DEV_ALLOWED_TOKEN || '';
const dataPath = process.env.USER_DATA_PATH || '/data/users.json';
const sessionSecret = process.env.SESSION_SECRET || '';
const sessionTtlMs = Number(process.env.SESSION_TTL_HOURS || 24) * 60 * 60 * 1000;
const cookieName = process.env.SESSION_COOKIE_NAME || 'testapp2_session';
const loginFailures = new Map();
const maxLoginFailures = 5;
const lockoutMs = 5 * 60 * 1000;

app.use(express.json({ limit: '16kb' }));

const nowIso = () => new Date().toISOString();

const defaultStore = () => ({ users: [], sessions: [] });

const ensureSecret = () => {
  if (!sessionSecret || sessionSecret.length < 32) {
    throw new Error('SESSION_SECRET doit être configuré avec au moins 32 caractères.');
  }
};

const readStore = async () => {
  try {
    const raw = await fs.readFile(dataPath, 'utf8');
    const parsed = JSON.parse(raw);
    return { users: Array.isArray(parsed.users) ? parsed.users : [], sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [] };
  } catch (error) {
    if (error.code === 'ENOENT') return defaultStore();
    throw error;
  }
};

const writeStore = async (store) => {
  await fs.mkdir(path.dirname(dataPath), { recursive: true });
  const tempPath = `${dataPath}.${process.pid}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(store, null, 2));
  await fs.rename(tempPath, dataPath);
};

const mutateStore = async (mutator) => {
  const store = await readStore();
  const result = await mutator(store);
  await writeStore(store);
  return result;
};

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
};

const verifyPassword = (password, storedHash) => {
  const [algorithm, salt, expectedHash] = String(storedHash || '').split('$');
  if (algorithm !== 'scrypt' || !salt || !expectedHash) return false;
  const actual = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};

const sanitizeUser = (user) => ({
  id: user.id,
  username: user.username,
  displayName: user.displayName || '',
  role: user.role,
  active: user.active !== false,
  createdAt: user.createdAt,
  lastLoginAt: user.lastLoginAt || null
});

const normalizeUsername = (value) => String(value || '').trim().toLowerCase();
const isValidRole = (role) => ['user', 'admin'].includes(role);

const countActiveAdmins = (users) => users.filter((user) => user.role === 'admin' && user.active !== false).length;

const validateLastAdminProtection = (store, existingUser, patch) => {
  if (!existingUser || existingUser.role !== 'admin' || existingUser.active === false) return;
  const nextRole = patch.role ?? existingUser.role;
  const nextActive = patch.active ?? existingUser.active;
  const wouldRemoveAdmin = nextRole !== 'admin' || nextActive === false;
  if (wouldRemoveAdmin && countActiveAdmins(store.users) <= 1) {
    const action = nextActive === false ? 'désactiver' : 'retirer le rôle admin au';
    const error = new Error(`Impossible de ${action} dernier administrateur actif.`);
    error.statusCode = 400;
    throw error;
  }
};

const signSessionToken = (token) => crypto.createHmac('sha256', sessionSecret).update(token).digest('base64url');
const encodeCookie = (token) => `${token}.${signSessionToken(token)}`;

const parseCookies = (header = '') => Object.fromEntries(
  header.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf('=');
    if (index === -1) return [part, ''];
    return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
  })
);

const getSessionToken = (req) => {
  const cookie = parseCookies(req.headers.cookie || '')[cookieName];
  if (!cookie) return null;
  const [token, signature] = cookie.split('.');
  if (!token || !signature) return null;
  const expected = signSessionToken(token);
  const actual = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actual.length !== expectedBuffer.length || !crypto.timingSafeEqual(actual, expectedBuffer)) return null;
  return token;
};

const setSessionCookie = (res, token) => {
  const maxAge = Math.floor(sessionTtlMs / 1000);
  const secure = process.env.COOKIE_SECURE === 'true' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${cookieName}=${encodeURIComponent(encodeCookie(token))}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax${secure}`);
};

const clearSessionCookie = (res) => {
  res.setHeader('Set-Cookie', `${cookieName}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`);
};

const createSession = async (userId) => mutateStore(async (store) => {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + sessionTtlMs).toISOString();
  store.sessions = store.sessions.filter((session) => new Date(session.expiresAt).getTime() > Date.now() && session.userId !== userId);
  store.sessions.push({ tokenHash: crypto.createHash('sha256').update(token).digest('hex'), userId, createdAt: nowIso(), expiresAt });
  return token;
});

const getUserFromRequest = async (req) => {
  const token = getSessionToken(req);
  if (!token) return null;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  let authenticatedUser = null;
  await mutateStore(async (store) => {
    const before = store.sessions.length;
    store.sessions = store.sessions.filter((session) => new Date(session.expiresAt).getTime() > Date.now());
    const session = store.sessions.find((candidate) => candidate.tokenHash === tokenHash);
    const user = session ? store.users.find((candidate) => candidate.id === session.userId && candidate.active !== false) : null;
    if (user) authenticatedUser = sanitizeUser(user);
    if (!user && session) store.sessions = store.sessions.filter((candidate) => candidate.tokenHash !== tokenHash);
    return before !== store.sessions.length;
  });
  return authenticatedUser;
};

const requireAuth = async (req, res, next) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      clearSessionCookie(res);
      return res.status(401).json({ error: 'Authentification requise.' });
    }
    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
};

const requireAppAdmin = async (req, res, next) => {
  await requireAuth(req, res, (error) => {
    if (error) return next(error);
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Accès administrateur requis.' });
    return next();
  });
};

const getClientKey = (req, username) => `${req.ip}:${normalizeUsername(username)}`;
const isLocked = (key) => {
  const entry = loginFailures.get(key);
  if (!entry) return false;
  if (entry.lockedUntil && entry.lockedUntil > Date.now()) return true;
  if (entry.lockedUntil && entry.lockedUntil <= Date.now()) loginFailures.delete(key);
  return false;
};

const recordLoginFailure = (key) => {
  const entry = loginFailures.get(key) || { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= maxLoginFailures) entry.lockedUntil = Date.now() + lockoutMs;
  loginFailures.set(key, entry);
};

const initUsers = async () => {
  ensureSecret();
  await mutateStore(async (store) => {
    store.sessions = store.sessions.filter((session) => new Date(session.expiresAt).getTime() > Date.now());
    if (store.users.length > 0) {
      console.log(`[auth] Base utilisateurs existante (${store.users.length} utilisateur(s)), admin initial non modifié.`);
      return;
    }
    const username = normalizeUsername(process.env.ADMIN_USERNAME || 'admin');
    const password = process.env.ADMIN_PASSWORD;
    const displayName = String(process.env.ADMIN_DISPLAY_NAME || 'Administrateur').trim();
    if (!password) throw new Error('ADMIN_PASSWORD doit être défini pour créer le premier administrateur.');
    store.users.push({
      id: crypto.randomUUID(),
      username,
      displayName,
      role: 'admin',
      active: true,
      passwordHash: hashPassword(password),
      createdAt: nowIso(),
      lastLoginAt: null
    });
    console.log(`[auth] Premier administrateur créé: ${username}. Changez ce mot de passe après le premier login.`);
  });
};

const publicBackendStatus = () => ({
  status: 'ok',
  service: 'backend',
  uptimeSeconds: Math.round(process.uptime()),
  nodeVersion: process.version,
  environment: process.env.NODE_ENV || 'development',
  appVersion: process.env.APP_VERSION || '0.1.0',
  timestamp: new Date().toISOString()
});

const requireDevAdmin = async (req, res, next) => {
  await requireAppAdmin(req, res, (error) => {
    if (error) return next(error);
    const token = req.get('x-dev-admin-token');
    if (!adminToken || adminToken === 'change-me-admin-token') {
      return res.status(503).json({ error: 'DEV_ADMIN_TOKEN doit être configuré avant usage.' });
    }
    if (!token || token !== adminToken) {
      return res.status(401).json({ error: 'Token DEV invalide.' });
    }
    return next();
  });
};

const callHost = async (apiPath, { method = 'GET', body } = {}) => {
  if (!hostToken || hostToken === 'change-me-host-token') {
    throw new Error('DEV_ALLOWED_TOKEN doit être configuré côté backend.');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(`${hostApiUrl}${apiPath}`, {
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

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const username = normalizeUsername(req.body?.username);
    const password = String(req.body?.password || '');
    const failureKey = getClientKey(req, username);
    if (isLocked(failureKey)) {
      return res.status(429).json({ error: 'Trop de tentatives. Réessayez dans quelques minutes.' });
    }
    const store = await readStore();
    const user = store.users.find((candidate) => candidate.username === username && candidate.active !== false);
    if (!user || !password || !verifyPassword(password, user.passwordHash)) {
      recordLoginFailure(failureKey);
      return res.status(401).json({ error: 'Identifiants invalides.' });
    }
    loginFailures.delete(failureKey);
    await mutateStore(async (mutableStore) => {
      const mutableUser = mutableStore.users.find((candidate) => candidate.id === user.id);
      if (mutableUser) mutableUser.lastLoginAt = nowIso();
    });
    const token = await createSession(user.id);
    setSessionCookie(res, token);
    const freshStore = await readStore();
    const freshUser = freshStore.users.find((candidate) => candidate.id === user.id);
    return res.json({ user: sanitizeUser(freshUser || user) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/auth/logout', requireAuth, async (req, res, next) => {
  try {
    const token = getSessionToken(req);
    if (token) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      await mutateStore(async (store) => {
        store.sessions = store.sessions.filter((session) => session.tokenHash !== tokenHash);
      });
    }
    clearSessionCookie(res);
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.get('/api/admin/users', requireAppAdmin, async (_req, res, next) => {
  try {
    const store = await readStore();
    res.json({ users: store.users.map(sanitizeUser) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/users', requireAppAdmin, async (req, res, next) => {
  try {
    const username = normalizeUsername(req.body?.username);
    const password = String(req.body?.password || '');
    const role = req.body?.role || 'user';
    const displayName = String(req.body?.displayName || '').trim();
    if (!username || username.length < 2) return res.status(400).json({ error: 'Identifiant invalide.' });
    if (!password || password.length < 8) return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
    if (!isValidRole(role)) return res.status(400).json({ error: 'Rôle invalide.' });
    const user = await mutateStore(async (store) => {
      if (store.users.some((candidate) => candidate.username === username)) {
        const error = new Error('Cet identifiant existe déjà.');
        error.statusCode = 409;
        throw error;
      }
      const created = { id: crypto.randomUUID(), username, displayName, role, active: true, passwordHash: hashPassword(password), createdAt: nowIso(), lastLoginAt: null };
      store.users.push(created);
      return sanitizeUser(created);
    });
    return res.status(201).json({ user });
  } catch (error) {
    return next(error);
  }
});

app.patch('/api/admin/users/:id', requireAppAdmin, async (req, res, next) => {
  try {
    const user = await mutateStore(async (store) => {
      const existing = store.users.find((candidate) => candidate.id === req.params.id);
      if (!existing) {
        const error = new Error('Utilisateur introuvable.');
        error.statusCode = 404;
        throw error;
      }
      const patch = {};
      if (Object.hasOwn(req.body, 'username')) patch.username = normalizeUsername(req.body.username);
      if (Object.hasOwn(req.body, 'displayName')) patch.displayName = String(req.body.displayName || '').trim();
      if (Object.hasOwn(req.body, 'role')) patch.role = req.body.role;
      if (Object.hasOwn(req.body, 'active')) patch.active = Boolean(req.body.active);
      if (patch.username && patch.username.length < 2) {
        const error = new Error('Identifiant invalide.');
        error.statusCode = 400;
        throw error;
      }
      if (patch.username && store.users.some((candidate) => candidate.id !== existing.id && candidate.username === patch.username)) {
        const error = new Error('Cet identifiant existe déjà.');
        error.statusCode = 409;
        throw error;
      }
      if (patch.role && !isValidRole(patch.role)) {
        const error = new Error('Rôle invalide.');
        error.statusCode = 400;
        throw error;
      }
      validateLastAdminProtection(store, existing, patch);
      Object.assign(existing, patch);
      if (existing.active === false) {
        store.sessions = store.sessions.filter((session) => session.userId !== existing.id);
      }
      return sanitizeUser(existing);
    });
    return res.json({ user });
  } catch (error) {
    return next(error);
  }
});

app.delete('/api/admin/users/:id', requireAppAdmin, async (req, res, next) => {
  try {
    await mutateStore(async (store) => {
      const existing = store.users.find((candidate) => candidate.id === req.params.id);
      if (!existing) {
        const error = new Error('Utilisateur introuvable.');
        error.statusCode = 404;
        throw error;
      }
      if (existing.role === 'admin' && existing.active !== false && countActiveAdmins(store.users) <= 1) {
        const error = new Error('Impossible de supprimer le dernier administrateur actif.');
        error.statusCode = 400;
        throw error;
      }
      store.users = store.users.filter((candidate) => candidate.id !== req.params.id);
      store.sessions = store.sessions.filter((session) => session.userId !== req.params.id);
    });
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/admin/users/:id/reset-password', requireAppAdmin, async (req, res, next) => {
  try {
    const password = String(req.body?.password || '');
    if (!password || password.length < 8) return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
    await mutateStore(async (store) => {
      const existing = store.users.find((candidate) => candidate.id === req.params.id);
      if (!existing) {
        const error = new Error('Utilisateur introuvable.');
        error.statusCode = 404;
        throw error;
      }
      existing.passwordHash = hashPassword(password);
      store.sessions = store.sessions.filter((session) => session.userId !== existing.id);
    });
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/dev/health', requireDevAdmin, async (_req, res) => {
  const backend = publicBackendStatus();
  try {
    const host = await callHost('/status');
    res.json({ backend, host: { ...host, url: hostApiUrl } });
  } catch (error) {
    res.json({ backend, host: { status: 'unreachable', url: hostApiUrl, lastError: error.message } });
  }
});

app.post('/api/dev/update', requireDevAdmin, async (req, res) => {
  const mode = req.body?.mode;
  if (!['normal', 'force-pwa'].includes(mode)) {
    return res.status(400).json({ error: 'Mode update invalide.' });
  }
  const result = await callHost('/update', { method: 'POST', body: { mode } });
  return res.json(result);
});

app.post('/api/dev/restart', requireDevAdmin, async (_req, res) => {
  const result = await callHost('/restart', { method: 'POST' });
  return res.json(result);
});

app.get('/api/dev/docker', requireDevAdmin, async (_req, res) => {
  const result = await callHost('/docker');
  return res.json(result);
});

app.get('/api/dev/logs', requireDevAdmin, async (_req, res) => {
  const result = await callHost('/logs');
  return res.json(result);
});

app.use((error, _req, res, _next) => {
  const status = error.statusCode || 500;
  res.status(status).json({ error: error.message || 'Erreur serveur' });
});

initUsers()
  .then(() => {
    app.listen(port, () => {
      console.log(`TESTapp2 backend listening on ${port}`);
      console.log(`[auth] Persistance utilisateurs: ${dataPath}`);
    });
  })
  .catch((error) => {
    console.error(`[auth] Démarrage impossible: ${error.message}`);
    process.exit(1);
  });
