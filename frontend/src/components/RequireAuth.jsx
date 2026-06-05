import { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import { ROUTES } from '../router.js';

export function RequireAuth({ children }) {
  const { user, authLoading } = useContext(AuthContext);
  const location = useLocation();

  if (authLoading) return null;
  if (!user) return <Navigate to={ROUTES.login} state={{ from: location }} replace />;
  return children;
}
