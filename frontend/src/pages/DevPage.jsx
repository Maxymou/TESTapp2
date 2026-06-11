import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { devApi } from '../services/devApi.js';
import { appConfig } from '../config/appConfig.js';
import { APP_VERSION, BUILD_TIMESTAMP } from '../config/buildInfo.js';
import { Field } from '../components/Field.jsx';
import { DotSpinner } from '../components/DotSpinner.jsx';
import { UpdateOverlay } from '../components/UpdateOverlay.jsx';
import { getViewportInfo, isStandalone } from '../viewport.js';
import { ROUTES } from '../router.js';
import { useAppCustomization } from '../context/AppCustomizationContext.jsx';

const UPDATE_MIN_OVERLAY_MS = 3500;
const UPDATE_POLL_INTERVAL_MS = 2500;
const UPDATE_HEALTH_TIMEOUT_MS = 4500;
const UPDATE_TIMEOUT_MS = 4 * 60 * 1000;
const UPDATE_REQUIRED_SUCCESSES = 2;

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

export function DevPage() {
  const navigate = useNavigate();
  const { confirm } = useOutletContext();
  const { customization } = useAppCustomization();
  // sessionStorage : le token ne persiste pas entre les onglets ni après fermeture du navigateur
  const [token, setToken] = useState(() => sessionStorage.getItem('devAdminToken') || '');
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
    sessionStorage.setItem('devAdminToken', value);
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
    appName: customization.appName,
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
  }), [customization.appName, online, viewport]);

  return (
    <>
      <main className={`page dev-page${updateOverlayState ? ' page-blurred' : ''}`} aria-hidden={updateOverlayState ? 'true' : undefined}>
        <header className="sub-header"><button className="ghost-button" onClick={() => navigate(ROUTES.settings)}>← Retour</button><h2>DEV</h2></header>
        <section className="panel token-panel">
          <label>Token DEV<input type="password" value={token} placeholder="Saisir DEV_ADMIN_TOKEN" onChange={(event) => saveToken(event.target.value)} autoComplete="off" /></label>
          <p>Le token est stocké localement dans ce navigateur et n'est jamais affiché en clair.</p>
        </section>
        {error && updateOverlayState !== 'updating' && <div className="error-box">{error}</div>}
        <div className="dev-grid">
          <section className="panel"><h3>Frontend</h3><Field label="application" value={frontendInfo.appName} /><Field label="appId" value={frontendInfo.appId} /><Field label="port par défaut" value={frontendInfo.defaultPort} /><Field label="version app" value={frontendInfo.version} /><Field label="build timestamp" value={frontendInfo.build} /><Field label="mode PWA" value={frontendInfo.pwaMode} /><Field label="standalone" value={frontendInfo.standalone} /><Field label="viewport" value={frontendInfo.viewport} /><Field label="app-height" value={frontendInfo.appHeight} /><Field label="visual viewport" value={frontendInfo.visual} /><Field label="online/offline" value={frontendInfo.online} /><Field label="user-agent" value={frontendInfo.userAgent} /></section>
          <section className="panel"><h3>Backend</h3><Field label="statut API" value={status?.backend?.status} /><Field label="uptime" value={status?.backend?.uptimeSeconds ? `${status.backend.uptimeSeconds}s` : '—'} /><Field label="version Node" value={status?.backend?.nodeVersion} /><Field label="environnement" value={status?.backend?.environment} /><Field label="timestamp serveur" value={status?.backend?.timestamp} /></section>
          <section className="panel"><h3>Host API</h3><Field label="statut" value={status?.host?.status} /><Field label="URL" value={status?.host?.url} /><Field label="workdir" value={status?.host?.workdir} /><Field label="dernière erreur" value={status?.host?.lastError} /><Field label="update status" value={status?.host?.updateStatus ? JSON.stringify(status.host.updateStatus) : '—'} /></section>
          <section className="panel actions-panel"><h3>Actions</h3><button disabled={loading} onClick={refresh}>Rafraîchir les statuts</button><button disabled={loading} onClick={() => startUpdate('normal', { title: 'Lancer la mise à jour ?', message: 'La mise à jour normale va reconstruire et redémarrer les services si nécessaire.', confirmLabel: 'Mettre à jour' })}>Mettre à jour l'app</button><button disabled={loading} onClick={() => startUpdate('force-pwa', { title: 'Forcer le rafraîchissement PWA ?', message: 'Cette action lance la mise à jour et force le nettoyage du build PWA généré.', confirmLabel: 'Mettre à jour + forcer' })}>Mettre à jour + forcer PWA</button><button disabled={loading} onClick={() => run('restart', () => devApi.restart(token), { title: `Redémarrer l'app ?`, message: 'Les conteneurs applicatifs vont être redémarrés.', confirmLabel: 'Redémarrer', variant: 'danger' })}>Redémarrer l'app</button><button disabled={loading} onClick={() => run('docker', () => devApi.docker(token))}>Voir état Docker</button><button disabled={loading} onClick={() => run('logs', () => devApi.logs(token))}>Voir logs récents</button></section>
        </div>
        <ActionResult result={result} loading={loading} />
      </main>
      <UpdateOverlay state={updateOverlayState} onRetry={retryUpdateCheck} onReload={() => window.location.reload()} />
    </>
  );
}
