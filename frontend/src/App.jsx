import { useCallback, useEffect, useMemo, useState } from 'react';
import { authApi, adminApi } from './services/authApi.js';
import { devApi } from './services/devApi.js';
import { getViewportInfo, isStandalone } from './viewport.js';

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
const BUILD_TIMESTAMP = typeof __BUILD_TIMESTAMP__ !== 'undefined' ? __BUILD_TIMESTAMP__ : new Date().toISOString();

const Field = ({ label, value }) => (
  <div className="field">
    <span>{label}</span>
    <strong>{value ?? '—'}</strong>
  </div>
);

const formatDate = (value) => (value ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—');

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
          <span className="login-logo">PWA</span>
          <div><h1>PWA Test Lab</h1><p>Connectez-vous pour accéder à l'application.</p></div>
        </div>
        <label>Identifiant<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></label>
        <label>Mot de passe<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
        {error && <div className="error-box login-error">{error}</div>}
        <button className="primary-button" disabled={loading}>{loading ? 'Connexion…' : 'Connexion'}</button>
      </form>
    </main>
  );
}

function DevPage({ onBack }) {
  const [token, setToken] = useState(() => localStorage.getItem('devAdminToken') || '');
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [viewport, setViewport] = useState(getViewportInfo());

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

  const run = useCallback(async (label, fn, confirmText) => {
    if (!token) {
      setError('Token DEV requis.');
      return;
    }
    if (confirmText && !window.confirm(confirmText)) return;
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
  }, [token]);

  const refresh = useCallback(() => run('refresh', () => devApi.health(token)), [run, token]);

  useEffect(() => {
    if (token) refresh();
  }, []);

  const frontendInfo = useMemo(() => ({
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
    <main className="page dev-page">
      <header className="sub-header"><button className="ghost-button" onClick={onBack}>← Retour</button><h2>DEV</h2></header>
      <section className="panel token-panel">
        <label>Token DEV<input type="password" value={token} placeholder="Saisir DEV_ADMIN_TOKEN" onChange={(event) => saveToken(event.target.value)} autoComplete="off" /></label>
        <p>Le token est stocké localement dans ce navigateur et n'est jamais affiché en clair.</p>
      </section>
      {error && <div className="error-box">{error}</div>}
      <div className="dev-grid">
        <section className="panel"><h3>Frontend</h3><Field label="version app" value={frontendInfo.version} /><Field label="build timestamp" value={frontendInfo.build} /><Field label="mode PWA" value={frontendInfo.pwaMode} /><Field label="standalone" value={frontendInfo.standalone} /><Field label="viewport" value={frontendInfo.viewport} /><Field label="app-height" value={frontendInfo.appHeight} /><Field label="visual viewport" value={frontendInfo.visual} /><Field label="online/offline" value={frontendInfo.online} /><Field label="user-agent" value={frontendInfo.userAgent} /></section>
        <section className="panel"><h3>Backend</h3><Field label="statut API" value={status?.backend?.status} /><Field label="uptime" value={status?.backend?.uptimeSeconds ? `${status.backend.uptimeSeconds}s` : '—'} /><Field label="version Node" value={status?.backend?.nodeVersion} /><Field label="environnement" value={status?.backend?.environment} /><Field label="timestamp serveur" value={status?.backend?.timestamp} /></section>
        <section className="panel"><h3>Host API</h3><Field label="statut" value={status?.host?.status} /><Field label="URL" value={status?.host?.url} /><Field label="workdir" value={status?.host?.workdir} /><Field label="dernière erreur" value={status?.host?.lastError} /><Field label="update status" value={status?.host?.updateStatus ? JSON.stringify(status.host.updateStatus) : '—'} /></section>
        <section className="panel actions-panel"><h3>Actions</h3><button disabled={loading} onClick={refresh}>Rafraîchir les statuts</button><button disabled={loading} onClick={() => run('update', () => devApi.update(token, 'normal'), 'Lancer la mise à jour normale ?')}>Mettre à jour l’app</button><button disabled={loading} onClick={() => run('force-pwa', () => devApi.update(token, 'force-pwa'), 'Mettre à jour et forcer le rafraîchissement PWA ?')}>Mettre à jour + forcer PWA</button><button disabled={loading} onClick={() => run('restart', () => devApi.restart(token), 'Redémarrer les conteneurs ?')}>Redémarrer l’app</button><button disabled={loading} onClick={() => run('docker', () => devApi.docker(token))}>Voir état Docker</button><button disabled={loading} onClick={() => run('logs', () => devApi.logs(token))}>Voir logs récents</button></section>
      </div>
      <ActionResult result={result} loading={loading} />
    </main>
  );
}

function SettingsPage({ user, adminMode, onBack, onDev, onLogout, onToggleAdminMode, onUsers }) {
  return (
    <main className="page narrow-page">
      <section className="settings-card">
        <header className="sub-header"><button className="ghost-button" onClick={onBack}>← Fermer</button><h2>Paramètres</h2></header>
        <p>Base vierge destinée aux essais PWA, viewport mobile et processus de mise à jour.</p>
        <section className="settings-section"><h3>Compte utilisateur</h3><Field label="utilisateur" value={user?.displayName || user?.username} /><Field label="identifiant" value={user?.username} /><Field label="rôle" value={user?.role} /><button className="danger-button" onClick={onLogout}>Déconnexion</button></section>
        {user?.role === 'admin' && <section className="settings-section"><h3>Mode admin</h3><p>Activez ce mode local pour afficher les outils d'administration intégrés.</p><button className="primary-button" onClick={onToggleAdminMode}>{adminMode ? 'Désactiver le mode admin' : 'Activer le mode admin'}</button></section>}
        {user?.role === 'admin' && adminMode && <section className="settings-section admin-section"><h3>Administration</h3><button className="primary-button" onClick={onUsers}>Gestion des utilisateurs</button></section>}
        <button className="primary-button" onClick={onDev}>DEV</button>
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
    if (!window.confirm(`Réinitialiser le mot de passe de ${user.username} ?`)) return;
    onSubmit(password);
  };
  return <form className="modal-card" onSubmit={submit}><h3>Réinitialiser le mot de passe</h3><p>Définir un nouveau mot de passe pour <strong>{user.username}</strong>.</p><label>Nouveau mot de passe<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength="8" required /></label><div className="modal-actions"><button type="button" className="ghost-button" onClick={onCancel}>Annuler</button><button className="primary-button">Réinitialiser</button></div></form>;
}

function UserManagementPage({ onBack, currentUser, refreshCurrentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [modal, setModal] = useState(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await adminApi.listUsers();
      setUsers(payload.users || []);
    } catch (err) {
      setError(err.message || 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const runAction = async (action, successMessage) => {
    setError('');
    setSuccess('');
    try {
      await action();
      setSuccess(successMessage);
      setModal(null);
      await loadUsers();
      await refreshCurrentUser();
    } catch (err) {
      setError(err.message || 'Action impossible.');
    }
  };

  const createUser = (data) => runAction(() => adminApi.createUser(data), 'Utilisateur créé.');
  const updateUser = (user, data) => {
    if (user.role === 'admin' && data.role !== 'admin' && !window.confirm(`Retirer le rôle admin de ${user.username} ?`)) return;
    if (user.active && !data.active && !window.confirm(`Désactiver ${user.username} ?`)) return;
    runAction(() => adminApi.updateUser(user.id, data), 'Utilisateur modifié.');
  };
  const deleteUser = (user) => {
    if (!window.confirm(`Supprimer définitivement ${user.username} ?`)) return;
    runAction(() => adminApi.deleteUser(user.id), 'Utilisateur supprimé.');
  };
  const resetPassword = (user, password) => runAction(() => adminApi.resetPassword(user.id, password), 'Mot de passe réinitialisé.');

  return (
    <main className="page admin-users-page">
      <header className="sub-header"><button className="ghost-button" onClick={onBack}>← Retour</button><h2>Gestion des utilisateurs</h2></header>
      <section className="panel admin-toolbar"><div><h3>Utilisateurs</h3><p>Routes protégées côté backend, session courante: {currentUser.username} ({currentUser.role}).</p></div><button className="primary-button" onClick={() => setModal({ type: 'create' })}>Créer un utilisateur</button></section>
      {error && <div className="error-box">{error}</div>}
      {success && <div className="success-box">{success}</div>}
      {loading ? <section className="panel"><p>Chargement…</p></section> : <div className="users-grid">{users.map((user) => <article className="user-card" key={user.id}><div className="user-card-head"><div><h3>{user.displayName || user.username}</h3><p>@{user.username}</p></div><span className={`status-pill ${user.active ? 'active' : 'inactive'}`}>{user.active ? 'actif' : 'inactif'}</span></div><Field label="rôle" value={user.role} /><Field label="créé" value={formatDate(user.createdAt)} /><Field label="dernière connexion" value={formatDate(user.lastLoginAt)} /><div className="card-actions"><button onClick={() => setModal({ type: 'edit', user })}>Modifier</button><button onClick={() => setModal({ type: 'reset', user })}>Mot de passe</button><button className="danger-button" onClick={() => deleteUser(user)}>Supprimer</button></div></article>)}</div>}
      {modal && <div className="modal-backdrop" role="dialog" aria-modal="true">{modal.type === 'create' && <UserForm title="Créer un utilisateur" includePassword submitLabel="Créer" onCancel={() => setModal(null)} onSubmit={createUser} />}{modal.type === 'edit' && <UserForm title={`Modifier ${modal.user.username}`} initialUser={modal.user} submitLabel="Enregistrer" onCancel={() => setModal(null)} onSubmit={(data) => updateUser(modal.user, data)} />}{modal.type === 'reset' && <ResetPasswordForm user={modal.user} onCancel={() => setModal(null)} onSubmit={(password) => resetPassword(modal.user, password)} />}</div>}
    </main>
  );
}

export default function App() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [page, setPage] = useState(window.location.pathname === '/login' ? 'login' : 'home');
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [adminMode, setAdminMode] = useState(false);

  const refreshCurrentUser = useCallback(async () => {
    const payload = await authApi.me();
    setUser(payload.user);
    return payload.user;
  }, []);

  useEffect(() => {
    authApi.me().then((payload) => {
      setUser(payload.user);
      if (window.location.pathname === '/login') window.history.replaceState(null, '', '/');
      setPage('home');
    }).catch(() => {
      setUser(null);
      setPage('login');
      if (window.location.pathname !== '/login') window.history.replaceState(null, '', '/login');
    }).finally(() => setAuthLoading(false));
  }, []);

  const navigate = (nextPage, path = '/') => {
    setPage(nextPage);
    window.history.pushState(null, '', path);
  };

  const handleLogin = (loggedUser) => {
    setUser(loggedUser);
    setAdminMode(false);
    navigate('home', '/');
  };

  const handleLogout = async () => {
    await authApi.logout().catch(() => {});
    setUser(null);
    setAdminMode(false);
    setDrawerOpen(false);
    navigate('login', '/login');
  };

  const goSettings = () => {
    navigate('settings');
    setDrawerOpen(false);
  };

  useEffect(() => {
    if (user?.role !== 'admin') setAdminMode(false);
  }, [user]);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setAdminMode(false);
      setDrawerOpen(false);
      navigate('login', '/login');
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  if (authLoading) return <main className="login-page"><section className="login-card"><p>Vérification de la session…</p></section></main>;
  if (!user) return <LoginPage onLogin={handleLogin} />;

  return (
    <div className="app-shell">
      <header className="topbar"><button className="hamburger" aria-label="Ouvrir le menu" onClick={() => setDrawerOpen(true)}>☰</button><h1>PWA Test Lab</h1></header>
      <div className={`overlay ${drawerOpen ? 'visible' : ''}`} onClick={() => setDrawerOpen(false)} />
      <aside className={`drawer ${drawerOpen ? 'open' : ''}`} aria-hidden={!drawerOpen}>
        <div className="drawer-header"><strong>PWA Test Lab</strong><button className="close-button" aria-label="Fermer" onClick={() => setDrawerOpen(false)}>×</button></div>
        <button className="drawer-link" onClick={goSettings}>Paramètres</button>
        {user.role === 'admin' && adminMode && <button className="drawer-link" onClick={() => { navigate('users'); setDrawerOpen(false); }}>Gestion des utilisateurs</button>}
      </aside>
      {page === 'home' && <main className="page home-page"><p>Interface vierge de test PWA</p></main>}
      {page === 'settings' && <SettingsPage user={user} adminMode={adminMode} onBack={() => navigate('home')} onDev={() => navigate('dev')} onLogout={handleLogout} onToggleAdminMode={() => setAdminMode((value) => !value)} onUsers={() => navigate('users')} />}
      {page === 'dev' && <DevPage onBack={() => navigate('settings')} />}
      {page === 'users' && user.role === 'admin' && adminMode && <UserManagementPage currentUser={user} refreshCurrentUser={refreshCurrentUser} onBack={() => navigate('settings')} />}
      {page === 'users' && (user.role !== 'admin' || !adminMode) && <main className="page narrow-page"><section className="panel"><p>Mode admin requis.</p><button onClick={() => navigate('settings')}>Retour paramètres</button></section></main>}
    </div>
  );
}
