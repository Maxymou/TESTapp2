import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/authApi.js';
import { ROUTES } from '../router.js';

export function useAuth() {
  const navigate = useNavigate();
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
      navigate(ROUTES.home, { replace: true });
    }).catch(() => {
      setUser(null);
      navigate(ROUTES.login, { replace: true });
    }).finally(() => setAuthLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      navigate(ROUTES.login);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [navigate]);

  return { user, setUser, authLoading, refreshCurrentUser };
}
