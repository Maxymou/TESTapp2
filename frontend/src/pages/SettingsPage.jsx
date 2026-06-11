import { useNavigate, useOutletContext } from 'react-router-dom';
import { Field } from '../components/Field.jsx';
import { ROUTES } from '../router.js';
import { useAppCustomization } from '../context/AppCustomizationContext.jsx';

export function SettingsPage() {
  const navigate = useNavigate();
  const { user, adminMode, onLogout, onToggleAdminMode } = useOutletContext();
  const { customization } = useAppCustomization();
  const isAdmin = user?.role === 'admin';
  const canShowAdministration = isAdmin && adminMode;

  return (
    <main className="page narrow-page">
      <section className="settings-card">
        <header className="sub-header"><button className="ghost-button" onClick={() => navigate(ROUTES.home)}>← Fermer</button><h2>Paramètres</h2></header>
        <p>{customization.description}</p>
        <section className="settings-section"><h3>Compte utilisateur</h3><Field label="utilisateur" value={user?.displayName || user?.username} /><Field label="identifiant" value={user?.username} /><Field label="rôle" value={user?.role} /><button className="danger-button" onClick={onLogout}>Déconnexion</button></section>
        <section className="settings-section"><h3>Application</h3><p>Consultez les informations publiques du template et du build frontend.</p><button className="primary-button" onClick={() => navigate(ROUTES.about)}>À propos</button></section>
        {isAdmin && <section className="settings-section"><h3>Mode admin</h3><p>Activez ce mode local pour afficher les outils d'administration intégrés.</p><button className="primary-button" onClick={onToggleAdminMode}>{adminMode ? 'Désactiver le mode admin' : 'Activer le mode admin'}</button></section>}
        {canShowAdministration && <section className="settings-section admin-section"><h3>Administration</h3><button className="primary-button" onClick={() => navigate(ROUTES.users)}>Gestion des utilisateurs</button><button className="primary-button" onClick={() => navigate(ROUTES.customization)}>Personnalisation</button><button className="primary-button" onClick={() => navigate(ROUTES.dev)}>DEV</button></section>}
      </section>
    </main>
  );
}
