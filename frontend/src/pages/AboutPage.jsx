import { useNavigate } from 'react-router-dom';
import { appConfig } from '../config/appConfig.js';
import { Field } from '../components/Field.jsx';
import { APP_VERSION, BUILD_TIMESTAMP } from '../config/buildInfo.js';
import { ROUTES } from '../router.js';

export function AboutPage() {
  const navigate = useNavigate();

  return (
    <main className="page narrow-page">
      <section className="settings-card">
        <header className="sub-header"><button className="ghost-button" onClick={() => navigate(ROUTES.settings)}>← Retour</button><h2>À propos</h2></header>
        <p>{appConfig.appDescription}</p>
        <section className="settings-section about-section">
          <h3>Application</h3>
          <Field label="nom" value={appConfig.appName} />
          <Field label="identifiant" value={appConfig.appId} />
          <Field label="description" value={appConfig.appDescription} />
          <Field label="version frontend" value={APP_VERSION} />
          <Field label="build timestamp" value={BUILD_TIMESTAMP} />
          <Field label="port par défaut" value={appConfig.defaultPort} />
        </section>
      </section>
    </main>
  );
}
