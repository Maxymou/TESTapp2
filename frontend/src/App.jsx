import { useEffect, useState } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { authApi } from './services/authApi.js';
import { appConfig } from './config/appConfig.js';
import { ROUTES } from './router.js';
import { useAuth } from './hooks/useAuth.js';
import { useNotify } from './hooks/useNotify.js';
import { useConfirm } from './hooks/useConfirm.js';
import { NotificationCenter } from './components/NotificationCenter.jsx';
import { ConfirmDialog } from './components/ConfirmDialog.jsx';
import { AuthContext } from './context/AuthContext.jsx';

export default function App() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [adminMode, setAdminMode] = useState(false);

  const { notifications, notify, removeNotification } = useNotify();
  const { confirmation, confirm, closeConfirmation } = useConfirm();
  const navigate = useNavigate();

  const { user, setUser, authLoading, refreshCurrentUser } = useAuth();

  useEffect(() => {
    document.documentElement.style.setProperty('--bg', appConfig.backgroundColor);
    document.documentElement.style.setProperty('--accent', appConfig.accentColor);
  }, []);

  const navigateAndClose = (path) => {
    navigate(path);
    setDrawerOpen(false);
  };

  const handleLogout = async () => {
    await authApi.logout().catch(() => {});
    setUser(null);
    setAdminMode(false);
    setDrawerOpen(false);
    navigate(ROUTES.login);
  };

  useEffect(() => {
    if (user?.role !== 'admin') setAdminMode(false);
  }, [user]);

  if (authLoading) return <main className="login-page"><section className="login-card"><p>Vérification de la session…</p></section></main>;

  return (
    <AuthContext.Provider value={{ user, authLoading, adminMode, setUser, setAdminMode, refreshCurrentUser }}>
      <div className="app-shell">
        <header className="topbar"><button className="hamburger" aria-label="Ouvrir le menu" onClick={() => setDrawerOpen(true)}>☰</button><h1>{appConfig.appTitle}</h1></header>
        <div className={`overlay ${drawerOpen ? 'visible' : ''}`} onClick={() => setDrawerOpen(false)} />
        <aside className={`drawer ${drawerOpen ? 'open' : ''}`} aria-hidden={!drawerOpen}>
          <div className="drawer-header"><strong>{appConfig.appName}</strong><button className="close-button" aria-label="Fermer" onClick={() => setDrawerOpen(false)}>×</button></div>
          <nav className="drawer-nav" aria-label="Navigation principale">
            <button className="drawer-link" onClick={() => navigateAndClose(ROUTES.home)}>Accueil</button>
            <button className="drawer-link" onClick={() => navigateAndClose(ROUTES.module1)}>Module 1</button>
            <button className="drawer-link" onClick={() => navigateAndClose(ROUTES.module2)}>Module 2</button>
            <button className="drawer-link" onClick={() => navigateAndClose(ROUTES.settings)}>Paramètres</button>
            {user?.role === 'admin' && adminMode && <button className="drawer-link" onClick={() => navigateAndClose(ROUTES.users)}>Gestion des utilisateurs</button>}
          </nav>
        </aside>
        <Outlet context={{ user, adminMode, setAdminMode, notify, confirm, refreshCurrentUser, onLogout: handleLogout, onToggleAdminMode: () => setAdminMode((v) => !v) }} />
        <NotificationCenter notifications={notifications} onClose={removeNotification} />
        <ConfirmDialog confirmation={confirmation} onCancel={() => closeConfirmation(false)} onConfirm={() => closeConfirmation(true)} />
      </div>
    </AuthContext.Provider>
  );
}
