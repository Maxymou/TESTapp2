import { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/authApi.js';
import { defaultCustomization } from '../context/AppCustomizationContext.jsx';
import { getAppCustomization } from '../services/appCustomization.js';
import { ROUTES } from '../router.js';
import { AuthContext } from '../context/AuthContext.jsx';

export function LoginPage() {
  const navigate = useNavigate();
  const { setUser } = useContext(AuthContext);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [customization, setCustomization] = useState(defaultCustomization);

  useEffect(() => {
    getAppCustomization()
      .then((payload) => setCustomization({ ...defaultCustomization, ...(payload.customization || {}) }))
      .catch(() => setCustomization(defaultCustomization));
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = await authApi.login(username, password);
      setUser(payload.user);
      navigate(ROUTES.home);
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
          <span className="login-logo">{customization.logoUrl ? <img src={customization.logoUrl} alt="" /> : customization.shortName}</span>
          <div><h1>{customization.appName}</h1><p>Connectez-vous pour accéder à l'application.</p></div>
        </div>
        <label>Identifiant<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></label>
        <label>Mot de passe<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
        {error && <div className="error-box login-error">{error}</div>}
        <button className="primary-button" disabled={loading}>{loading ? 'Connexion…' : 'Connexion'}</button>
      </form>
    </main>
  );
}
