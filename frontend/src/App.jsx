import { useCallback, useEffect, useState } from 'react';
import { authApi } from './services/authApi.js';
import { appConfig } from './config/appConfig.js';
import { pagePaths, routeFromPath } from './router.js';
import { useAuth } from './hooks/useAuth.js';
import { useNotify } from './hooks/useNotify.js';
import { useConfirm } from './hooks/useConfirm.js';
import { NotificationCenter } from './components/NotificationCenter.jsx';
import { ConfirmDialog } from './components/ConfirmDialog.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { ModulePlaceholderPage } from './pages/ModulePlaceholderPage.jsx';
import { AboutPage } from './pages/AboutPage.jsx';
import { SettingsPage } from './pages/SettingsPage.jsx';
import { DevPage } from './pages/DevPage.jsx';
import { UserManagementPage } from './pages/UserManagementPage.jsx';

export default function App() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [page, setPage] = useState(() => routeFromPath(window.location.pathname));
  const [adminMode, setAdminMode] = useState(false);

  const { notifications, notify, removeNotification } = useNotify();
  const { confirmation, confirm, closeConfirmation } = useConfirm();

  const navigate = useCallback((nextPage, path = pagePaths[nextPage] || '/') => {
    setPage(nextPage);
    if (path !== null) window.history.pushState(null, '', path);
  }, []);

  const { user, setUser, authLoading, refreshCurrentUser } = useAuth(navigate);

  useEffect(() => {
    document.documentElement.style.setProperty('--bg', appConfig.backgroundColor);
    document.documentElement.style.setProperty('--accent', appConfig.accentColor);
  }, []);

  const navigateAndClose = (nextPage) => {
    navigate(nextPage);
    setDrawerOpen(false);
  };

  const handleLogin = (loggedUser) => {
    setUser(loggedUser);
    setAdminMode(false);
    navigate('home');
  };

  const handleLogout = async () => {
    await authApi.logout().catch(() => {});
    setUser(null);
    setAdminMode(false);
    setDrawerOpen(false);
    navigate('login');
  };

  useEffect(() => {
    if (user?.role !== 'admin') setAdminMode(false);
  }, [user]);

  useEffect(() => {
    const handlePopState = () => setPage(routeFromPath(window.location.pathname));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (authLoading) return <main className="login-page"><section className="login-card"><p>Vérification de la session…</p></section></main>;
  if (!user) return <LoginPage onLogin={handleLogin} />;

  return (
    <div className="app-shell">
      <header className="topbar"><button className="hamburger" aria-label="Ouvrir le menu" onClick={() => setDrawerOpen(true)}>☰</button><h1>{appConfig.appTitle}</h1></header>
      <div className={`overlay ${drawerOpen ? 'visible' : ''}`} onClick={() => setDrawerOpen(false)} />
      <aside className={`drawer ${drawerOpen ? 'open' : ''}`} aria-hidden={!drawerOpen}>
        <div className="drawer-header"><strong>{appConfig.appName}</strong><button className="close-button" aria-label="Fermer" onClick={() => setDrawerOpen(false)}>×</button></div>
        <nav className="drawer-nav" aria-label="Navigation principale">
          <button className="drawer-link" onClick={() => navigateAndClose('home')}>Accueil</button>
          <button className="drawer-link" onClick={() => navigateAndClose('module1')}>Module 1</button>
          <button className="drawer-link" onClick={() => navigateAndClose('module2')}>Module 2</button>
          <button className="drawer-link" onClick={() => navigateAndClose('settings')}>Paramètres</button>
          {user.role === 'admin' && adminMode && <button className="drawer-link" onClick={() => navigateAndClose('users')}>Gestion des utilisateurs</button>}
        </nav>
      </aside>
      {page === 'home' && <HomePage />}
      {page === 'module1' && <ModulePlaceholderPage title="Module 1" />}
      {page === 'module2' && <ModulePlaceholderPage title="Module 2" />}
      {page === 'settings' && <SettingsPage user={user} adminMode={adminMode} onBack={() => navigate('home')} onAbout={() => navigate('about')} onDev={() => navigate('dev')} onLogout={handleLogout} onToggleAdminMode={() => setAdminMode((value) => !value)} onUsers={() => navigate('users')} />}
      {page === 'about' && <AboutPage onBack={() => navigate('settings')} />}
      {page === 'dev' && user.role === 'admin' && adminMode && <DevPage onBack={() => navigate('settings')} confirm={confirm} />}
      {page === 'dev' && (user.role !== 'admin' || !adminMode) && <main className="page narrow-page"><section className="panel"><p>Mode admin requis.</p><button onClick={() => navigate('settings')}>Retour paramètres</button></section></main>}
      {page === 'users' && user.role === 'admin' && adminMode && <UserManagementPage currentUser={user} refreshCurrentUser={refreshCurrentUser} onBack={() => navigate('settings')} confirm={confirm} notify={notify} />}
      {page === 'users' && (user.role !== 'admin' || !adminMode) && <main className="page narrow-page"><section className="panel"><p>Mode admin requis.</p><button onClick={() => navigate('settings')}>Retour paramètres</button></section></main>}
      <NotificationCenter notifications={notifications} onClose={removeNotification} />
      <ConfirmDialog confirmation={confirmation} onCancel={() => closeConfirmation(false)} onConfirm={() => closeConfirmation(true)} />
    </div>
  );
}
