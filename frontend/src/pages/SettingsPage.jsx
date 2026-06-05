import { appConfig } from '../config/appConfig.js';
import { Field } from '../components/Field.jsx';

export function SettingsPage({ user, adminMode, onBack, onAbout, onDev, onLogout, onToggleAdminMode, onUsers }) {
  const isAdmin = user?.role === 'admin';
  const canShowAdministration = isAdmin && adminMode;

  return (
    <main className="page narrow-page">
      <section className="settings-card">
        <header className="sub-header"><button className="ghost-button" onClick={onBack}>← Fermer</button><h2>Paramètres</h2></header>
        <p>{appConfig.appDescription}</p>
        <section className="settings-section"><h3>Compte utilisateur</h3><Field label="utilisateur" value={user?.displayName || user?.username} /><Field label="identifiant" value={user?.username} /><Field label="rôle" value={user?.role} /><button className="danger-button" onClick={onLogout}>Déconnexion</button></section>
        <section className="settings-section"><h3>Application</h3><p>Consultez les informations publiques du template et du build frontend.</p><button className="primary-button" onClick={onAbout}>À propos</button></section>
        {isAdmin && <section className="settings-section"><h3>Mode admin</h3><p>Activez ce mode local pour afficher les outils d'administration intégrés.</p><button className="primary-button" onClick={onToggleAdminMode}>{adminMode ? 'Désactiver le mode admin' : 'Activer le mode admin'}</button></section>}
        {canShowAdministration && <section className="settings-section admin-section"><h3>Administration</h3><button className="primary-button" onClick={onUsers}>Gestion des utilisateurs</button><button className="primary-button" onClick={onDev}>DEV</button></section>}
      </section>
    </main>
  );
}
