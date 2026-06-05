import { useState, useEffect, useCallback } from 'react';
import { authApi } from '../services/authApi.js';
import { routeFromPath } from '../router.js';

export function useAuth(navigate) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const refreshCurrentUser = useCallback(async () => {
    const payload = await authApi.me();
    setUser(payload.user);
    return payload.user;
  }, []);

  useEffect(() => {
    authApi.me().then((payload) => {
      setUser(payload.user);
      const targetPath = window.location.pathname === '/login' ? '/' : window.location.pathname;
      window.history.replaceState(null, '', targetPath);
      navigate(routeFromPath(targetPath), null);
    }).catch(() => {
      setUser(null);
      window.history.replaceState(null, '', '/login');
      navigate('login', null);
    }).finally(() => setAuthLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      navigate('login');
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [navigate]);

  return { user, setUser, authLoading, refreshCurrentUser };
}
