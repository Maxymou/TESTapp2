import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import { ROUTES } from '../router.js';

export function RequireAdminMode({ children }) {
  const { user, adminMode } = useContext(AuthContext);

  if (!user || user.role !== 'admin' || !adminMode) {
    return <Navigate to={ROUTES.settings} replace />;
  }
  return children;
}
