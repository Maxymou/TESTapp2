import { useState } from 'react';
import { authApi } from '../services/authApi.js';
import { appConfig } from '../config/appConfig.js';

export function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = await authApi.login(username, password);
      onLogin(payload.user);
    } catch (err) {
      setError(err.message || 'Connexion impossible.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <span className="login-logo">{appConfig.shortName}</span>
          <div><h1>{appConfig.appName}</h1><p>Connectez-vous pour accéder à l'application.</p></div>
        </div>
        <label>Identifiant<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></label>
        <label>Mot de passe<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
        {error && <div className="error-box login-error">{error}</div>}
        <button className="primary-button" disabled={loading}>{loading ? 'Connexion…' : 'Connexion'}</button>
      </form>
    </main>
  );
}
