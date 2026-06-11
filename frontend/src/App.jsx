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
import { AppCustomizationContext, defaultCustomization } from './context/AppCustomizationContext.jsx';
import { getAppCustomization } from './services/appCustomization.js';

export default function App() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [customization, setCustomization] = useState(defaultCustomization);

  const { notifications, notify, removeNotification } = useNotify();
  const { confirmation, confirm, closeConfirmation } = useConfirm();
  const navigate = useNavigate();

  const { user, setUser, authLoading, refreshCurrentUser } = useAuth();

  const applyCustomization = (nextCustomization) => {
    const identity = { ...defaultCustomization, ...(nextCustomization || {}) };
    document.documentElement.style.setProperty('--bg', appConfig.backgroundColor);
    document.documentElement.style.setProperty('--accent', identity.primaryColor || defaultCustomization.primaryColor);
    document.documentElement.style.setProperty('--secondary-accent', identity.secondaryColor || defaultCustomization.secondaryColor);
    document.title = identity.appName || appConfig.appTitle;
    document.querySelector('meta[name=\"theme-color\"]')?.setAttribute('content', identity.primaryColor || appConfig.themeColor);
    document.querySelector('meta[name=\"apple-mobile-web-app-title\"]')?.setAttribute('content', identity.shortName || identity.appName || appConfig.shortName);
    document.querySelector('link[rel=\"apple-touch-icon\"]')?.setAttribute('href', identity.pwaIconUrl || defaultCustomization.pwaIconUrl);
  };

  const refreshCustomization = async () => {
    const payload = await getAppCustomization();
    const nextCustomization = { ...defaultCustomization, ...(payload.customization || {}) };
    setCustomization(nextCustomization);
    applyCustomization(nextCustomization);
    return nextCustomization;
  };

  useEffect(() => {
    applyCustomization(defaultCustomization);
    refreshCustomization().catch(() => {});
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
      <AppCustomizationContext.Provider value={{ customization, refreshCustomization }}>
      <div className="app-shell">
        <header className="topbar"><button className="hamburger" aria-label="Ouvrir le menu" onClick={() => setDrawerOpen(true)}>☰</button><h1>{customization.appName}</h1></header>
        <div className={`overlay ${drawerOpen ? 'visible' : ''}`} onClick={() => setDrawerOpen(false)} />
        <aside className={`drawer ${drawerOpen ? 'open' : ''}`} aria-hidden={!drawerOpen}>
          <div className="drawer-header"><strong>{customization.appName}</strong><button className="close-button" aria-label="Fermer" onClick={() => setDrawerOpen(false)}>×</button></div>
          <nav className="drawer-nav" aria-label="Navigation principale">
            <button className="drawer-link" onClick={() => navigateAndClose(ROUTES.home)}>Accueil</button>
            <button className="drawer-link" onClick={() => navigateAndClose(ROUTES.module1)}>Module 1</button>
            <button className="drawer-link" onClick={() => navigateAndClose(ROUTES.module2)}>Module 2</button>
            <button className="drawer-link" onClick={() => navigateAndClose(ROUTES.settings)}>Paramètres</button>
            {user?.role === 'admin' && adminMode && <button className="drawer-link" onClick={() => navigateAndClose(ROUTES.users)}>Gestion des utilisateurs</button>}
            {user?.role === 'admin' && adminMode && <button className="drawer-link" onClick={() => navigateAndClose(ROUTES.customization)}>Personnalisation</button>}
          </nav>
        </aside>
        <Outlet context={{ user, adminMode, setAdminMode, notify, confirm, refreshCurrentUser, onLogout: handleLogout, onToggleAdminMode: () => setAdminMode((v) => !v) }} />
        <NotificationCenter notifications={notifications} onClose={removeNotification} />
        <ConfirmDialog confirmation={confirmation} onCancel={() => closeConfirmation(false)} onConfirm={() => closeConfirmation(true)} />
      </div>
      </AppCustomizationContext.Provider>
    </AuthContext.Provider>
  );
}
