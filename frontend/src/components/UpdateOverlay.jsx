import { DotSpinner } from './DotSpinner.jsx';

export function UpdateOverlay({ state, onRetry, onReload }) {
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
