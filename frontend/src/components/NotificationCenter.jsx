export const notificationLabels = {
  success: 'Succès',
  error: 'Erreur',
  info: 'Information',
  warning: 'Attention'
};

export function NotificationCenter({ notifications, onClose }) {
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
