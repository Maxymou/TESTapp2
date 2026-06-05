import { useState, useCallback } from 'react';

const NOTIFICATION_DEFAULT_DURATION_MS = 4500;

export function useNotify() {
  const [notifications, setNotifications] = useState([]);

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

  return { notifications, notify, removeNotification };
}
