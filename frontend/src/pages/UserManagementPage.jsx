import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { adminApi } from '../services/authApi.js';
import { Field } from '../components/Field.jsx';
import { ROUTES } from '../router.js';

const formatDate = (value) => (value ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—');

function UserForm({ title, initialUser, onSubmit, onCancel, submitLabel, includePassword = false }) {
  const [username, setUsername] = useState(initialUser?.username || '');
  const [displayName, setDisplayName] = useState(initialUser?.displayName || '');
  const [role, setRole] = useState(initialUser?.role || 'user');
  const [active, setActive] = useState(initialUser?.active ?? true);
  const [password, setPassword] = useState('');
  const submit = (event) => {
    event.preventDefault();
    onSubmit({ username, displayName, role, active, ...(includePassword ? { password } : {}) });
  };
  return <form className="modal-card" onSubmit={submit}><h3>{title}</h3><label>Identifiant<input value={username} onChange={(event) => setUsername(event.target.value)} required /></label><label>Nom affiché<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>{includePassword && <label>Mot de passe initial<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength="8" required /></label>}<label>Rôle<select value={role} onChange={(event) => setRole(event.target.value)}><option value="user">user</option><option value="admin">admin</option></select></label><label className="checkbox-row"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Actif</label><div className="modal-actions"><button type="button" className="ghost-button" onClick={onCancel}>Annuler</button><button className="primary-button">{submitLabel}</button></div></form>;
}

function ResetPasswordForm({ user, onSubmit, onCancel }) {
  const [password, setPassword] = useState('');
  const submit = (event) => {
    event.preventDefault();
    onSubmit(password);
  };
  return <form className="modal-card" onSubmit={submit}><h3>Réinitialiser le mot de passe</h3><p>Définir un nouveau mot de passe pour <strong>{user.username}</strong>.</p><label>Nouveau mot de passe<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength="8" required /></label><div className="modal-actions"><button type="button" className="ghost-button" onClick={onCancel}>Annuler</button><button className="primary-button">Réinitialiser</button></div></form>;
}

export function UserManagementPage() {
  const navigate = useNavigate();
  const { user: currentUser, refreshCurrentUser, confirm, notify } = useOutletContext();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await adminApi.listUsers();
      setUsers(payload.users || []);
    } catch (err) {
      const message = err.message || 'Chargement impossible.';
      setError(message);
      notify({ type: 'error', message });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const runAction = async (action, successMessage) => {
    setError('');
    try {
      await action();
      notify({ type: 'success', message: successMessage });
      setModal(null);
      await loadUsers();
      await refreshCurrentUser();
    } catch (err) {
      const message = err.message || 'Action impossible.';
      setError(message);
      notify({ type: 'error', message });
    }
  };

  const createUser = (data) => runAction(() => adminApi.createUser(data), 'Utilisateur créé.');
  const updateUser = async (user, data) => {
    if (user.role === 'admin' && data.role !== 'admin') {
      const confirmed = await confirm({ title: 'Retirer le rôle admin ?', message: `Retirer le rôle admin de ${user.username} ?`, confirmLabel: 'Retirer', variant: 'danger' });
      if (!confirmed) return;
    }
    if (user.active && !data.active) {
      const confirmed = await confirm({ title: `Désactiver l'utilisateur ?`, message: `Désactiver ${user.username} ?`, confirmLabel: 'Désactiver', variant: 'danger' });
      if (!confirmed) return;
    }
    runAction(() => adminApi.updateUser(user.id, data), 'Utilisateur modifié.');
  };
  const deleteUser = async (user) => {
    const confirmed = await confirm({ title: `Supprimer l'utilisateur ?`, message: `Supprimer définitivement ${user.username} ? Cette action est irréversible.`, confirmLabel: 'Supprimer', variant: 'danger' });
    if (!confirmed) return;
    runAction(() => adminApi.deleteUser(user.id), 'Utilisateur supprimé.');
  };
  const resetPassword = async (user, password) => {
    const confirmed = await confirm({ title: 'Réinitialiser le mot de passe ?', message: `Réinitialiser le mot de passe de ${user.username} ?`, confirmLabel: 'Réinitialiser', variant: 'danger' });
    if (!confirmed) return;
    runAction(() => adminApi.resetPassword(user.id, password), 'Mot de passe réinitialisé.');
  };

  return (
    <main className="page admin-users-page">
      <header className="sub-header"><button className="ghost-button" onClick={() => navigate(ROUTES.settings)}>← Retour</button><h2>Gestion des utilisateurs</h2></header>
      <section className="panel admin-toolbar"><div><h3>Utilisateurs</h3><p>Routes protégées côté backend, session courante: {currentUser.username} ({currentUser.role}).</p></div><button className="primary-button" onClick={() => setModal({ type: 'create' })}>Créer un utilisateur</button></section>
      {error && <div className="error-box">{error}</div>}
      {loading ? <section className="panel"><p>Chargement…</p></section> : <div className="users-grid">{users.map((user) => <article className="user-card" key={user.id}><div className="user-card-head"><div><h3>{user.displayName || user.username}</h3><p>@{user.username}</p></div><span className={`status-pill ${user.active ? 'active' : 'inactive'}`}>{user.active ? 'actif' : 'inactif'}</span></div><Field label="rôle" value={user.role} /><Field label="créé" value={formatDate(user.createdAt)} /><Field label="dernière connexion" value={formatDate(user.lastLoginAt)} /><div className="card-actions"><button onClick={() => setModal({ type: 'edit', user })}>Modifier</button><button onClick={() => setModal({ type: 'reset', user })}>Mot de passe</button><button className="danger-button" onClick={() => deleteUser(user)}>Supprimer</button></div></article>)}</div>}
      {modal && <div className="modal-backdrop" role="dialog" aria-modal="true">{modal.type === 'create' && <UserForm title="Créer un utilisateur" includePassword submitLabel="Créer" onCancel={() => setModal(null)} onSubmit={createUser} />}{modal.type === 'edit' && <UserForm title={`Modifier ${modal.user.username}`} initialUser={modal.user} submitLabel="Enregistrer" onCancel={() => setModal(null)} onSubmit={(data) => updateUser(modal.user, data)} />}{modal.type === 'reset' && <ResetPasswordForm user={modal.user} onCancel={() => setModal(null)} onSubmit={(password) => resetPassword(modal.user, password)} />}</div>}
    </main>
  );
}
