import { useEffect, useRef } from 'react';

export function ConfirmDialog({ confirmation, onCancel, onConfirm }) {
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
