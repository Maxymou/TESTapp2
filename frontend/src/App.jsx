import { useCallback, useEffect, useMemo, useState } from 'react';
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

const ActionResult = ({ result, loading }) => (
  <section className="panel result-panel">
    <h3>Résultat</h3>
    <Field label="loading" value={loading ? 'oui' : 'non'} />
    <Field label="date" value={result?.date} />
    <Field label="durée" value={result?.durationMs ? `${result.durationMs} ms` : '—'} />
    <Field label="exitCode" value={result?.exitCode ?? '—'} />
    <div className="output-grid">
      <label>
        stdout
        <pre>{result?.stdout || '—'}</pre>
      </label>
      <label>
        stderr
        <pre>{result?.stderr || '—'}</pre>
      </label>
    </div>
  </section>
);

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

  const run = useCallback(
    async (label, fn, confirmText) => {
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
        setResult({
          date: new Date().toISOString(),
          durationMs: Math.round(performance.now() - started),
          stdout: typeof normalized.stdout === 'string' ? normalized.stdout : JSON.stringify(normalized, null, 2),
          stderr: normalized.stderr || '',
          exitCode: normalized.exitCode ?? 0
        });
        if (label !== 'logs' && label !== 'docker') {
          const fresh = await devApi.health(token);
          setStatus(fresh);
        }
      } catch (err) {
        setError(err.message || 'Erreur inconnue');
        setResult({
          date: new Date().toISOString(),
          durationMs: Math.round(performance.now() - started),
          stdout: '',
          stderr: err.message || String(err),
          exitCode: 1
        });
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  const refresh = useCallback(() => run('refresh', () => devApi.health(token)), [run, token]);

  useEffect(() => {
    if (token) refresh();
  }, []);

  const frontendInfo = useMemo(
    () => ({
      version: APP_VERSION,
      build: BUILD_TIMESTAMP,
      pwaMode: window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser',
      standalone: isStandalone() ? 'oui' : 'non',
      viewport: `${viewport.width} x ${viewport.height}`,
      appHeight: viewport.appHeight,
      visual: viewport.visualViewport ? JSON.stringify(viewport.visualViewport) : 'non disponible',
      userAgent: navigator.userAgent,
      online: online ? 'online' : 'offline'
    }),
    [online, viewport]
  );

  return (
    <main className="page dev-page">
      <header className="sub-header">
        <button className="ghost-button" onClick={onBack}>← Retour</button>
        <h2>DEV</h2>
      </header>

      <section className="panel token-panel">
        <label>
          Token DEV
          <input
            type="password"
            value={token}
            placeholder="Saisir DEV_ADMIN_TOKEN"
            onChange={(event) => saveToken(event.target.value)}
            autoComplete="off"
          />
        </label>
        <p>Le token est stocké localement dans ce navigateur et n'est jamais affiché en clair.</p>
      </section>

      {error && <div className="error-box">{error}</div>}

      <div className="dev-grid">
        <section className="panel">
          <h3>Frontend</h3>
          <Field label="version app" value={frontendInfo.version} />
          <Field label="build timestamp" value={frontendInfo.build} />
          <Field label="mode PWA" value={frontendInfo.pwaMode} />
          <Field label="standalone" value={frontendInfo.standalone} />
          <Field label="viewport" value={frontendInfo.viewport} />
          <Field label="app-height" value={frontendInfo.appHeight} />
          <Field label="visual viewport" value={frontendInfo.visual} />
          <Field label="online/offline" value={frontendInfo.online} />
          <Field label="user-agent" value={frontendInfo.userAgent} />
        </section>

        <section className="panel">
          <h3>Backend</h3>
          <Field label="statut API" value={status?.backend?.status} />
          <Field label="uptime" value={status?.backend?.uptimeSeconds ? `${status.backend.uptimeSeconds}s` : '—'} />
          <Field label="version Node" value={status?.backend?.nodeVersion} />
          <Field label="environnement" value={status?.backend?.environment} />
          <Field label="timestamp serveur" value={status?.backend?.timestamp} />
        </section>

        <section className="panel">
          <h3>Host API</h3>
          <Field label="statut" value={status?.host?.status} />
          <Field label="URL" value={status?.host?.url} />
          <Field label="workdir" value={status?.host?.workdir} />
          <Field label="dernière erreur" value={status?.host?.lastError} />
          <Field label="update status" value={status?.host?.updateStatus ? JSON.stringify(status.host.updateStatus) : '—'} />
        </section>

        <section className="panel actions-panel">
          <h3>Actions</h3>
          <button disabled={loading} onClick={refresh}>Rafraîchir les statuts</button>
          <button disabled={loading} onClick={() => run('update', () => devApi.update(token, 'normal'), 'Lancer la mise à jour normale ?')}>Mettre à jour l’app</button>
          <button disabled={loading} onClick={() => run('force-pwa', () => devApi.update(token, 'force-pwa'), 'Mettre à jour et forcer le rafraîchissement PWA ?')}>Mettre à jour + forcer PWA</button>
          <button disabled={loading} onClick={() => run('restart', () => devApi.restart(token), 'Redémarrer les conteneurs ?')}>Redémarrer l’app</button>
          <button disabled={loading} onClick={() => run('docker', () => devApi.docker(token))}>Voir état Docker</button>
          <button disabled={loading} onClick={() => run('logs', () => devApi.logs(token))}>Voir logs récents</button>
        </section>
      </div>

      <ActionResult result={result} loading={loading} />
    </main>
  );
}

function SettingsPage({ onBack, onDev }) {
  return (
    <main className="page narrow-page">
      <section className="settings-card">
        <header className="sub-header">
          <button className="ghost-button" onClick={onBack}>← Fermer</button>
          <h2>Paramètres</h2>
        </header>
        <p>Base vierge destinée aux essais PWA, viewport mobile et processus de mise à jour.</p>
        <button className="primary-button" onClick={onDev}>DEV</button>
      </section>
    </main>
  );
}

export default function App() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [page, setPage] = useState('home');

  const goSettings = () => {
    setPage('settings');
    setDrawerOpen(false);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="hamburger" aria-label="Ouvrir le menu" onClick={() => setDrawerOpen(true)}>☰</button>
        <h1>PWA Test Lab</h1>
      </header>

      <div className={`overlay ${drawerOpen ? 'visible' : ''}`} onClick={() => setDrawerOpen(false)} />
      <aside className={`drawer ${drawerOpen ? 'open' : ''}`} aria-hidden={!drawerOpen}>
        <div className="drawer-header">
          <strong>PWA Test Lab</strong>
          <button className="close-button" aria-label="Fermer" onClick={() => setDrawerOpen(false)}>×</button>
        </div>
        <button className="drawer-link" onClick={goSettings}>Paramètres</button>
      </aside>

      {page === 'home' && (
        <main className="page home-page">
          <p>Interface vierge de test PWA</p>
        </main>
      )}
      {page === 'settings' && <SettingsPage onBack={() => setPage('home')} onDev={() => setPage('dev')} />}
      {page === 'dev' && <DevPage onBack={() => setPage('settings')} />}
    </div>
  );
}
