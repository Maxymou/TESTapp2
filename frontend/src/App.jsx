import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { authApi, adminApi } from './services/authApi.js';
import { devApi } from './services/devApi.js';
import { getViewportInfo, isStandalone } from './viewport.js';
import { appConfig } from './config/appConfig.js';

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
const BUILD_TIMESTAMP = typeof __BUILD_TIMESTAMP__ !== 'undefined' ? __BUILD_TIMESTAMP__ : new Date().toISOString();
const UPDATE_MIN_OVERLAY_MS = 3500;
const UPDATE_POLL_INTERVAL_MS = 2500;
const UPDATE_HEALTH_TIMEOUT_MS = 4500;
const UPDATE_TIMEOUT_MS = 4 * 60 * 1000;
const UPDATE_REQUIRED_SUCCESSES = 2;
const NOTIFICATION_DEFAULT_DURATION_MS = 4500;

const pagePaths = {
  home: '/',
  module1: '/module-1',
  module2: '/module-2',
  settings: '/settings',
  about: '/about',
  users: '/settings/users',
  dev: '/settings/dev',
  login: '/login'
};

const routeFromPath = (pathname) => {
  const match = Object.entries(pagePaths).find(([, path]) => path === pathname);
  return match?.[0] || (pathname === '/login' ? 'login' : 'home');
};

const Field = ({ label, value }) => (
  <div className="field">
    <span>{label}</span>
    <strong>{value ?? '—'}</strong>
  </div>
);

const formatDate = (value) => (value ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const normalizeActionResult = (data) => data?.result || data;
const formatActionResult = (normalized) => ({
  stdout: typeof normalized?.stdout === 'string' ? normalized.stdout : JSON.stringify(normalized ?? {}, null, 2),
  stderr: normalized?.stderr || '',
  exitCode: normalized?.exitCode ?? 0
});

const isTemporaryUpdateError = (error) => {
  const message = String(error?.message || error || '').toLowerCase();
  return [502, 503, 504].includes(error?.status)
    || error?.name === 'AbortError'
    || error?.isNetworkError
    || message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('network error')
    || message.includes('timeout')
    || message.includes('aborted');
};

const isFreshUpdateSuccess = (status, startedAt) => {
  const updateStatus = status?.host?.updateStatus;
  if (!updateStatus || updateStatus.state !== 'success' || updateStatus.exitCode !== 0) return false;
  const updatedAt = updateStatus.updatedAt ? Date.parse(updateStatus.updatedAt) : Number.NaN;
  return Number.isNaN(updatedAt) || updatedAt >= startedAt - 15000;
};

const withTimeout = async (operation, timeoutMs) => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await operation(controller.signal);
  } finally {
    window.clearTimeout(timer);
  }
};

function DotSpinner() {
  return (
    <div className="dot-spinner" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, index) => <div className="dot-spinner__dot" key={index}></div>)}
    </div>
  );
}

function NotificationCenter({ notifications, onClose }) {
  return (
    <div className="notification-stack" aria-live="polite" aria-relevant="additions removals">
      {notifications.map((notification) => (
        <article className={`notification notification-${notification.type}`} key={notification.id}>
          <div>
            <strong>{notification.title || notificationLabels[notification.type]}</strong>
            <p>{notification.message}</p>
          </div>
          <button className="notification-close" type="button" aria-label="Fermer la notification" onClick={() => onClose(notification.id)}>×</button>
        </article>
      ))}
    </div>
  );
}

const notificationLabels = {
  success: 'Succès',
  error: 'Erreur',
  info: 'Information',
  warning: 'Attention'
};

function ConfirmDialog({ confirmation, onCancel, onConfirm }) {
  const confirmButtonRef = useRef(null);

  useEffect(() => {
    if (!confirmation) return undefined;
    confirmButtonRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmation, onCancel]);

  if (!confirmation) return null;
  const isDanger = confirmation.variant === 'danger';

  return (
    <div className="modal-backdrop confirm-backdrop" role="presentation">
      <section className="modal-card confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
        <h3 id="confirm-title">{confirmation.title}</h3>
        <p id="confirm-message">{confirmation.message}</p>
        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onCancel}>{confirmation.cancelLabel || 'Annuler'}</button>
          <button ref={confirmButtonRef} type="button" className={isDanger ? 'danger-button' : 'primary-button'} onClick={onConfirm}>{confirmation.confirmLabel || 'Confirmer'}</button>
        </div>
      </section>
    </div>
  );
}

function UpdateOverlay({ state, onRetry, onReload }) {
  if (!state) return null;
  const isUpdating = state === 'updating';
  const isDone = state === 'done';

  return (
    <div className="update-overlay" role="alertdialog" aria-modal="true" aria-live="assertive" aria-labelledby="update-overlay-title">
      <section className="update-overlay-card">
        <h2 id="update-overlay-title">{isUpdating ? 'Mise à jour en cours' : isDone ? 'Mise à jour terminée' : 'La mise à jour prend plus de temps que prévu.'}</h2>
        {isUpdating && <DotSpinner />}
        <p>{isUpdating ? 'Merci de patienter pendant le redémarrage des services.' : isDone ? 'Les services répondent à nouveau. Rechargez pour utiliser la dernière version.' : 'Vous pouvez relancer la vérification ou recharger la page manuellement.'}</p>
        {isDone && <button className="primary-button" onClick={onReload}>Recharger la page</button>}
        {state === 'timeout' && <div className="update-overlay-actions"><button onClick={onRetry}>Réessayer la vérification</button><button className="primary-button" onClick={onReload}>Recharger la page</button></div>}
      </section>
    </div>
  );
}

const ActionResult = ({ result, loading }) => (
  <section className="panel result-panel">
    <h3>Résultat</h3>
    <Field label="loading" value={loading ? 'oui' : 'non'} />
    <Field label="date" value={result?.date} />
    <Field label="durée" value={result?.durationMs ? `${result.durationMs} ms` : '—'} />
    <Field label="exitCode" value={result?.exitCode ?? '—'} />
    <div className="output-grid">
      <label>stdout<pre>{result?.stdout || '—'}</pre></label>
      <label>stderr<pre>{result?.stderr || '—'}</pre></label>
    </div>
  </section>
);

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = await authApi.login(username, password);
      onLogin(payload.user);
    } catch (err) {
      setError(err.message || 'Connexion impossible.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <span className="login-logo">{appConfig.shortName}</span>
          <div><h1>{appConfig.appName}</h1><p>Connectez-vous pour accéder à l'application.</p></div>
        </div>
        <label>Identifiant<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></label>
        <label>Mot de passe<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
        {error && <div className="error-box login-error">{error}</div>}
        <button className="primary-button" disabled={loading}>{loading ? 'Connexion…' : 'Connexion'}</button>
      </form>
    </main>
  );
}

function HomePage() {
  return (
    <main className="page home-page">
      <section className="panel welcome-card">
        <p className="eyebrow">Accueil</p>
        <h2>{appConfig.appName}</h2>
        <p>Bienvenue dans l’application.</p>
        <div className="placeholder-note">
          <h3>Point de départ</h3>
          <p>Cette page est le point de départ du futur module métier. Remplacez ce contenu par les pages spécifiques de la nouvelle application.</p>
        </div>
      </section>
    </main>
  );
}

function ModulePlaceholderPage({ title }) {
  return (
    <main className="page home-page">
      <section className="panel welcome-card">
        <p className="eyebrow">À personnaliser</p>
        <h2>{title}</h2>
        <p>Emplacement réservé pour un futur module métier.</p>
        <div className="placeholder-note">
          <h3>Template</h3>
          <p>Remplacez cette carte par l’écran, les services et les composants métier de votre application.</p>
        </div>
      </section>
    </main>
  );
}

function AboutPage({ onBack }) {
  return (
    <main className="page narrow-page">
      <section className="settings-card">
        <header className="sub-header"><button className="ghost-button" onClick={onBack}>← Retour</button><h2>À propos</h2></header>
        <p>{appConfig.appDescription}</p>
        <section className="settings-section about-section">
          <h3>Application</h3>
          <Field label="nom" value={appConfig.appName} />
          <Field label="identifiant" value={appConfig.appId} />
          <Field label="description" value={appConfig.appDescription} />
          <Field label="version frontend" value={APP_VERSION} />
          <Field label="build timestamp" value={BUILD_TIMESTAMP} />
          <Field label="port par défaut" value={appConfig.defaultPort} />
        </section>
      </section>
    </main>
  );
}

function DevPage({ onBack, confirm }) {
  const [token, setToken] = useState(() => localStorage.getItem('devAdminToken') || '');
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [updateOverlayState, setUpdateOverlayState] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [viewport, setViewport] = useState(getViewportInfo());
  const updateStartedAtRef = useRef(null);
  const updateResultRef = useRef(null);

  useEffect(() => {
    const refreshFrontend = () => {
      setOnline(navigator.onLine);
      setViewport(getViewportInfo());
    };
    window.addEventListener('online', refreshFrontend);
    window.addEventListener('offline', refreshFrontend);
    window.addEventListener('resize', refreshFrontend);
    window.visualViewport?.addEventListener('resize', refreshFrontend);
    return () => {
      window.removeEventListener('online', refreshFrontend);
      window.removeEventListener('offline', refreshFrontend);
      window.removeEventListener('resize', refreshFrontend);
      window.visualViewport?.removeEventListener('resize', refreshFrontend);
    };
  }, []);

  const saveToken = (value) => {
    setToken(value);
    localStorage.setItem('devAdminToken', value);
  };

  const run = useCallback(async (label, fn, confirmOptions) => {
    if (!token) {
      setError('Token DEV requis.');
      return;
    }
    if (confirmOptions && !(await confirm(confirmOptions))) return;
    const started = performance.now();
    setLoading(true);
    setError('');
    setResult({ date: new Date().toISOString(), stdout: `Action: ${label}`, stderr: '', exitCode: null });
    try {
      const data = await fn();
      const normalized = data.result || data;
      setResult({ date: new Date().toISOString(), durationMs: Math.round(performance.now() - started), stdout: typeof normalized.stdout === 'string' ? normalized.stdout : JSON.stringify(normalized, null, 2), stderr: normalized.stderr || '', exitCode: normalized.exitCode ?? 0 });
      if (label !== 'logs' && label !== 'docker') setStatus(await devApi.health(token));
    } catch (err) {
      setError(err.message || 'Erreur inconnue');
      setResult({ date: new Date().toISOString(), durationMs: Math.round(performance.now() - started), stdout: '', stderr: err.message || String(err), exitCode: 1 });
    } finally {
      setLoading(false);
    }
  }, [confirm, token]);

  const pollUntilUpdateReady = useCallback(async (startedAt, deadlineBase = startedAt) => {
    const deadline = deadlineBase + UPDATE_TIMEOUT_MS;
    let successCount = 0;

    while (Date.now() < deadline) {
      try {
        const health = await withTimeout((signal) => devApi.health(token, { signal }), UPDATE_HEALTH_TIMEOUT_MS);
        setStatus(health);
        successCount = isFreshUpdateSuccess(health, startedAt) ? successCount + 1 : 0;
        const minDelayElapsed = Date.now() - startedAt >= UPDATE_MIN_OVERLAY_MS;
        if (minDelayElapsed && (successCount >= UPDATE_REQUIRED_SUCCESSES || updateResultRef.current?.exitCode === 0)) return true;
      } catch (err) {
        successCount = 0;
      }
      await sleep(UPDATE_POLL_INTERVAL_MS);
    }

    return false;
  }, [token]);

  const startUpdate = useCallback(async (mode, confirmOptions) => {
    if (!token) {
      setError('Token DEV requis.');
      return;
    }
    if (confirmOptions && !(await confirm(confirmOptions))) return;

    const started = performance.now();
    const startedAt = Date.now();
    updateStartedAtRef.current = startedAt;
    updateResultRef.current = null;
    setLoading(true);
    setError('');
    setUpdateOverlayState('updating');
    setResult({ date: new Date().toISOString(), stdout: `Action: ${mode === 'force-pwa' ? 'force-pwa' : 'update'}`, stderr: '', exitCode: null });

    let explicitFailure = null;
    let notifyFailure = () => {};
    const failurePromise = new Promise((resolve) => {
      notifyFailure = () => resolve(false);
    });
    const updateRequest = devApi.update(token, mode)
      .then((data) => {
        const normalized = normalizeActionResult(data);
        updateResultRef.current = normalized;
        if ((normalized?.exitCode ?? 0) !== 0) {
          explicitFailure = normalized;
          notifyFailure();
        }
        return normalized;
      })
      .catch((err) => {
        if (!isTemporaryUpdateError(err)) {
          explicitFailure = { stdout: '', stderr: err.message || String(err), exitCode: 1 };
          notifyFailure();
        }
        return null;
      });

    try {
      const ready = await Promise.race([pollUntilUpdateReady(startedAt), failurePromise]);
      const updateResponse = await Promise.race([updateRequest, sleep(0).then(() => null)]);
      if (explicitFailure) {
        const formattedFailure = formatActionResult(explicitFailure);
        setUpdateOverlayState(null);
        setError(formattedFailure.stderr || 'La mise à jour a échoué.');
        setResult({ date: new Date().toISOString(), durationMs: Math.round(performance.now() - started), ...formattedFailure });
        return;
      }
      if (ready) {
        const normalized = updateResponse || updateResultRef.current || { stdout: 'Services disponibles après mise à jour.', stderr: '', exitCode: 0 };
        setResult({ date: new Date().toISOString(), durationMs: Math.round(performance.now() - started), ...formatActionResult(normalized) });
        setUpdateOverlayState('done');
        return;
      }
      setUpdateOverlayState('timeout');
      setError('La mise à jour prend plus de temps que prévu.');
      setResult({ date: new Date().toISOString(), durationMs: Math.round(performance.now() - started), stdout: '', stderr: 'Timeout de vérification après mise à jour.', exitCode: 1 });
    } finally {
      setLoading(false);
    }
  }, [confirm, pollUntilUpdateReady, token]);

  const retryUpdateCheck = useCallback(async () => {
    if (!token) {
      setError('Token DEV requis.');
      return;
    }
    const startedAt = updateStartedAtRef.current || Date.now();
    setError('');
    setLoading(true);
    setUpdateOverlayState('updating');
    try {
      const ready = await pollUntilUpdateReady(startedAt, Date.now());
      if (ready) setUpdateOverlayState('done');
      else {
        setUpdateOverlayState('timeout');
        setError('La mise à jour prend plus de temps que prévu.');
      }
    } finally {
      setLoading(false);
    }
  }, [pollUntilUpdateReady, token]);

  const refresh = useCallback(() => run('refresh', () => devApi.health(token)), [run, token]);

  useEffect(() => {
    if (token) refresh();
  }, []);

  const frontendInfo = useMemo(() => ({
    appName: appConfig.appName,
    appId: appConfig.appId,
    defaultPort: appConfig.defaultPort,
    version: APP_VERSION,
    build: BUILD_TIMESTAMP,
    pwaMode: window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser',
    standalone: isStandalone() ? 'oui' : 'non',
    viewport: `${viewport.width} x ${viewport.height}`,
    appHeight: viewport.appHeight,
    visual: viewport.visualViewport ? JSON.stringify(viewport.visualViewport) : 'non disponible',
    userAgent: navigator.userAgent,
    online: online ? 'online' : 'offline'
  }), [online, viewport]);

  return (
    <>
      <main className={`page dev-page${updateOverlayState ? ' page-blurred' : ''}`} aria-hidden={updateOverlayState ? 'true' : undefined}>
        <header className="sub-header"><button className="ghost-button" onClick={onBack}>← Retour</button><h2>DEV</h2></header>
        <section className="panel token-panel">
          <label>Token DEV<input type="password" value={token} placeholder="Saisir DEV_ADMIN_TOKEN" onChange={(event) => saveToken(event.target.value)} autoComplete="off" /></label>
          <p>Le token est stocké localement dans ce navigateur et n'est jamais affiché en clair.</p>
        </section>
        {error && updateOverlayState !== 'updating' && <div className="error-box">{error}</div>}
        <div className="dev-grid">
          <section className="panel"><h3>Frontend</h3><Field label="application" value={frontendInfo.appName} /><Field label="appId" value={frontendInfo.appId} /><Field label="port par défaut" value={frontendInfo.defaultPort} /><Field label="version app" value={frontendInfo.version} /><Field label="build timestamp" value={frontendInfo.build} /><Field label="mode PWA" value={frontendInfo.pwaMode} /><Field label="standalone" value={frontendInfo.standalone} /><Field label="viewport" value={frontendInfo.viewport} /><Field label="app-height" value={frontendInfo.appHeight} /><Field label="visual viewport" value={frontendInfo.visual} /><Field label="online/offline" value={frontendInfo.online} /><Field label="user-agent" value={frontendInfo.userAgent} /></section>
          <section className="panel"><h3>Backend</h3><Field label="statut API" value={status?.backend?.status} /><Field label="uptime" value={status?.backend?.uptimeSeconds ? `${status.backend.uptimeSeconds}s` : '—'} /><Field label="version Node" value={status?.backend?.nodeVersion} /><Field label="environnement" value={status?.backend?.environment} /><Field label="timestamp serveur" value={status?.backend?.timestamp} /></section>
          <section className="panel"><h3>Host API</h3><Field label="statut" value={status?.host?.status} /><Field label="URL" value={status?.host?.url} /><Field label="workdir" value={status?.host?.workdir} /><Field label="dernière erreur" value={status?.host?.lastError} /><Field label="update status" value={status?.host?.updateStatus ? JSON.stringify(status.host.updateStatus) : '—'} /></section>
          <section className="panel actions-panel"><h3>Actions</h3><button disabled={loading} onClick={refresh}>Rafraîchir les statuts</button><button disabled={loading} onClick={() => startUpdate('normal', { title: 'Lancer la mise à jour ?', message: 'La mise à jour normale va reconstruire et redémarrer les services si nécessaire.', confirmLabel: 'Mettre à jour' })}>Mettre à jour l’app</button><button disabled={loading} onClick={() => startUpdate('force-pwa', { title: 'Forcer le rafraîchissement PWA ?', message: 'Cette action lance la mise à jour et force le nettoyage du build PWA généré.', confirmLabel: 'Mettre à jour + forcer' })}>Mettre à jour + forcer PWA</button><button disabled={loading} onClick={() => run('restart', () => devApi.restart(token), { title: 'Redémarrer l’app ?', message: 'Les conteneurs applicatifs vont être redémarrés.', confirmLabel: 'Redémarrer', variant: 'danger' })}>Redémarrer l’app</button><button disabled={loading} onClick={() => run('docker', () => devApi.docker(token))}>Voir état Docker</button><button disabled={loading} onClick={() => run('logs', () => devApi.logs(token))}>Voir logs récents</button></section>
        </div>
        <ActionResult result={result} loading={loading} />
      </main>
      <UpdateOverlay state={updateOverlayState} onRetry={retryUpdateCheck} onReload={() => window.location.reload()} />
    </>
  );
}

function SettingsPage({ user, adminMode, onBack, onAbout, onDev, onLogout, onToggleAdminMode, onUsers }) {
  const isAdmin = user?.role === 'admin';
  const canShowAdministration = isAdmin && adminMode;

  return (
    <main className="page narrow-page">
      <section className="settings-card">
        <header className="sub-header"><button className="ghost-button" onClick={onBack}>← Fermer</button><h2>Paramètres</h2></header>
        <p>{appConfig.appDescription}</p>
        <section className="settings-section"><h3>Compte utilisateur</h3><Field label="utilisateur" value={user?.displayName || user?.username} /><Field label="identifiant" value={user?.username} /><Field label="rôle" value={user?.role} /><button className="danger-button" onClick={onLogout}>Déconnexion</button></section>
        <section className="settings-section"><h3>Application</h3><p>Consultez les informations publiques du template et du build frontend.</p><button className="primary-button" onClick={onAbout}>À propos</button></section>
        {isAdmin && <section className="settings-section"><h3>Mode admin</h3><p>Activez ce mode local pour afficher les outils d'administration intégrés.</p><button className="primary-button" onClick={onToggleAdminMode}>{adminMode ? 'Désactiver le mode admin' : 'Activer le mode admin'}</button></section>}
        {canShowAdministration && <section className="settings-section admin-section"><h3>Administration</h3><button className="primary-button" onClick={onUsers}>Gestion des utilisateurs</button><button className="primary-button" onClick={onDev}>DEV</button></section>}
      </section>
    </main>
  );
}

function UserForm({ title, initialUser, onSubmit, onCancel, submitLabel, includePassword = false }) {
  const [username, setUsername] = useState(initialUser?.username || '');
  const [displayName, setDisplayName] = useState(initialUser?.displayName || '');
  const [role, setRole] = useState(initialUser?.role || 'user');
  const [active, setActive] = useState(initialUser?.active ?? true);
  const [password, setPassword] = useState('');
  const submit = (event) => {
    event.preventDefault();
    onSubmit({ username, displayName, role, active, ...(includePassword ? { password } : {}) });
  };
  return <form className="modal-card" onSubmit={submit}><h3>{title}</h3><label>Identifiant<input value={username} onChange={(event) => setUsername(event.target.value)} required /></label><label>Nom affiché<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>{includePassword && <label>Mot de passe initial<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength="8" required /></label>}<label>Rôle<select value={role} onChange={(event) => setRole(event.target.value)}><option value="user">user</option><option value="admin">admin</option></select></label><label className="checkbox-row"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Actif</label><div className="modal-actions"><button type="button" className="ghost-button" onClick={onCancel}>Annuler</button><button className="primary-button">{submitLabel}</button></div></form>;
}

function ResetPasswordForm({ user, onSubmit, onCancel }) {
  const [password, setPassword] = useState('');
  const submit = (event) => {
    event.preventDefault();
    onSubmit(password);
  };
  return <form className="modal-card" onSubmit={submit}><h3>Réinitialiser le mot de passe</h3><p>Définir un nouveau mot de passe pour <strong>{user.username}</strong>.</p><label>Nouveau mot de passe<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength="8" required /></label><div className="modal-actions"><button type="button" className="ghost-button" onClick={onCancel}>Annuler</button><button className="primary-button">Réinitialiser</button></div></form>;
}

function UserManagementPage({ onBack, currentUser, refreshCurrentUser, confirm, notify }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await adminApi.listUsers();
      setUsers(payload.users || []);
    } catch (err) {
      const message = err.message || 'Chargement impossible.';
      setError(message);
      notify({ type: 'error', message });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const runAction = async (action, successMessage) => {
    setError('');
    try {
      await action();
      notify({ type: 'success', message: successMessage });
      setModal(null);
      await loadUsers();
      await refreshCurrentUser();
    } catch (err) {
      const message = err.message || 'Action impossible.';
      setError(message);
      notify({ type: 'error', message });
    }
  };

  const createUser = (data) => runAction(() => adminApi.createUser(data), 'Utilisateur créé.');
  const updateUser = async (user, data) => {
    if (user.role === 'admin' && data.role !== 'admin') {
      const confirmed = await confirm({ title: 'Retirer le rôle admin ?', message: `Retirer le rôle admin de ${user.username} ?`, confirmLabel: 'Retirer', variant: 'danger' });
      if (!confirmed) return;
    }
    if (user.active && !data.active) {
      const confirmed = await confirm({ title: 'Désactiver l’utilisateur ?', message: `Désactiver ${user.username} ?`, confirmLabel: 'Désactiver', variant: 'danger' });
      if (!confirmed) return;
    }
    runAction(() => adminApi.updateUser(user.id, data), 'Utilisateur modifié.');
  };
  const deleteUser = async (user) => {
    const confirmed = await confirm({ title: 'Supprimer l’utilisateur ?', message: `Supprimer définitivement ${user.username} ? Cette action est irréversible.`, confirmLabel: 'Supprimer', variant: 'danger' });
    if (!confirmed) return;
    runAction(() => adminApi.deleteUser(user.id), 'Utilisateur supprimé.');
  };
  const resetPassword = async (user, password) => {
    const confirmed = await confirm({ title: 'Réinitialiser le mot de passe ?', message: `Réinitialiser le mot de passe de ${user.username} ?`, confirmLabel: 'Réinitialiser', variant: 'danger' });
    if (!confirmed) return;
    runAction(() => adminApi.resetPassword(user.id, password), 'Mot de passe réinitialisé.');
  };

  return (
    <main className="page admin-users-page">
      <header className="sub-header"><button className="ghost-button" onClick={onBack}>← Retour</button><h2>Gestion des utilisateurs</h2></header>
      <section className="panel admin-toolbar"><div><h3>Utilisateurs</h3><p>Routes protégées côté backend, session courante: {currentUser.username} ({currentUser.role}).</p></div><button className="primary-button" onClick={() => setModal({ type: 'create' })}>Créer un utilisateur</button></section>
      {error && <div className="error-box">{error}</div>}
      {loading ? <section className="panel"><p>Chargement…</p></section> : <div className="users-grid">{users.map((user) => <article className="user-card" key={user.id}><div className="user-card-head"><div><h3>{user.displayName || user.username}</h3><p>@{user.username}</p></div><span className={`status-pill ${user.active ? 'active' : 'inactive'}`}>{user.active ? 'actif' : 'inactif'}</span></div><Field label="rôle" value={user.role} /><Field label="créé" value={formatDate(user.createdAt)} /><Field label="dernière connexion" value={formatDate(user.lastLoginAt)} /><div className="card-actions"><button onClick={() => setModal({ type: 'edit', user })}>Modifier</button><button onClick={() => setModal({ type: 'reset', user })}>Mot de passe</button><button className="danger-button" onClick={() => deleteUser(user)}>Supprimer</button></div></article>)}</div>}
      {modal && <div className="modal-backdrop" role="dialog" aria-modal="true">{modal.type === 'create' && <UserForm title="Créer un utilisateur" includePassword submitLabel="Créer" onCancel={() => setModal(null)} onSubmit={createUser} />}{modal.type === 'edit' && <UserForm title={`Modifier ${modal.user.username}`} initialUser={modal.user} submitLabel="Enregistrer" onCancel={() => setModal(null)} onSubmit={(data) => updateUser(modal.user, data)} />}{modal.type === 'reset' && <ResetPasswordForm user={modal.user} onCancel={() => setModal(null)} onSubmit={(password) => resetPassword(modal.user, password)} />}</div>}
    </main>
  );
}

export default function App() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [page, setPage] = useState(() => routeFromPath(window.location.pathname));
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [adminMode, setAdminMode] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [confirmation, setConfirmation] = useState(null);
  const confirmResolverRef = useRef(null);

  useEffect(() => {
    document.documentElement.style.setProperty('--bg', appConfig.backgroundColor);
    document.documentElement.style.setProperty('--accent', appConfig.accentColor);
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications((current) => current.filter((notification) => notification.id !== id));
  }, []);

  const notify = useCallback(({ type = 'info', message, title, duration = NOTIFICATION_DEFAULT_DURATION_MS }) => {
    if (!message) return null;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setNotifications((current) => [...current, { id, type, title, message }]);
    if (duration > 0) window.setTimeout(() => removeNotification(id), duration);
    return id;
  }, [removeNotification]);

  const closeConfirmation = useCallback((accepted) => {
    confirmResolverRef.current?.(accepted);
    confirmResolverRef.current = null;
    setConfirmation(null);
  }, []);

  const confirm = useCallback((options) => new Promise((resolve) => {
    confirmResolverRef.current = resolve;
    setConfirmation(options);
  }), []);

  const refreshCurrentUser = useCallback(async () => {
    const payload = await authApi.me();
    setUser(payload.user);
    return payload.user;
  }, []);

  useEffect(() => {
    authApi.me().then((payload) => {
      setUser(payload.user);
      if (window.location.pathname === '/login') window.history.replaceState(null, '', '/');
      setPage(routeFromPath(window.location.pathname === '/login' ? '/' : window.location.pathname));
    }).catch(() => {
      setUser(null);
      setPage('login');
      if (window.location.pathname !== '/login') window.history.replaceState(null, '', '/login');
    }).finally(() => setAuthLoading(false));
  }, []);

  const navigate = useCallback((nextPage, path = pagePaths[nextPage] || '/') => {
    setPage(nextPage);
    window.history.pushState(null, '', path);
  }, []);

  const navigateAndClose = (nextPage) => {
    navigate(nextPage);
    setDrawerOpen(false);
  };

  const handleLogin = (loggedUser) => {
    setUser(loggedUser);
    setAdminMode(false);
    navigate('home');
  };

  const handleLogout = async () => {
    await authApi.logout().catch(() => {});
    setUser(null);
    setAdminMode(false);
    setDrawerOpen(false);
    navigate('login');
  };

  useEffect(() => {
    if (user?.role !== 'admin') setAdminMode(false);
  }, [user]);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setAdminMode(false);
      setDrawerOpen(false);
      navigate('login');
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [navigate]);

  useEffect(() => {
    const handlePopState = () => setPage(routeFromPath(window.location.pathname));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (authLoading) return <main className="login-page"><section className="login-card"><p>Vérification de la session…</p></section></main>;
  if (!user) return <LoginPage onLogin={handleLogin} />;

  return (
    <div className="app-shell">
      <header className="topbar"><button className="hamburger" aria-label="Ouvrir le menu" onClick={() => setDrawerOpen(true)}>☰</button><h1>{appConfig.appTitle}</h1></header>
      <div className={`overlay ${drawerOpen ? 'visible' : ''}`} onClick={() => setDrawerOpen(false)} />
      <aside className={`drawer ${drawerOpen ? 'open' : ''}`} aria-hidden={!drawerOpen}>
        <div className="drawer-header"><strong>{appConfig.appName}</strong><button className="close-button" aria-label="Fermer" onClick={() => setDrawerOpen(false)}>×</button></div>
        <nav className="drawer-nav" aria-label="Navigation principale">
          <button className="drawer-link" onClick={() => navigateAndClose('home')}>Accueil</button>
          <button className="drawer-link" onClick={() => navigateAndClose('module1')}>Module 1</button>
          <button className="drawer-link" onClick={() => navigateAndClose('module2')}>Module 2</button>
          <button className="drawer-link" onClick={() => navigateAndClose('settings')}>Paramètres</button>
          {user.role === 'admin' && adminMode && <button className="drawer-link" onClick={() => navigateAndClose('users')}>Gestion des utilisateurs</button>}
        </nav>
      </aside>
      {page === 'home' && <HomePage />}
      {page === 'module1' && <ModulePlaceholderPage title="Module 1" />}
      {page === 'module2' && <ModulePlaceholderPage title="Module 2" />}
      {page === 'settings' && <SettingsPage user={user} adminMode={adminMode} onBack={() => navigate('home')} onAbout={() => navigate('about')} onDev={() => navigate('dev')} onLogout={handleLogout} onToggleAdminMode={() => setAdminMode((value) => !value)} onUsers={() => navigate('users')} />}
      {page === 'about' && <AboutPage onBack={() => navigate('settings')} />}
      {page === 'dev' && user.role === 'admin' && adminMode && <DevPage onBack={() => navigate('settings')} confirm={confirm} />}
      {page === 'dev' && (user.role !== 'admin' || !adminMode) && <main className="page narrow-page"><section className="panel"><p>Mode admin requis.</p><button onClick={() => navigate('settings')}>Retour paramètres</button></section></main>}
      {page === 'users' && user.role === 'admin' && adminMode && <UserManagementPage currentUser={user} refreshCurrentUser={refreshCurrentUser} onBack={() => navigate('settings')} confirm={confirm} notify={notify} />}
      {page === 'users' && (user.role !== 'admin' || !adminMode) && <main className="page narrow-page"><section className="panel"><p>Mode admin requis.</p><button onClick={() => navigate('settings')}>Retour paramètres</button></section></main>}
      <NotificationCenter notifications={notifications} onClose={removeNotification} />
      <ConfirmDialog confirmation={confirmation} onCancel={() => closeConfirmation(false)} onConfirm={() => closeConfirmation(true)} />
    </div>
  );
}
