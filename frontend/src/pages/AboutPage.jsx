import { useNavigate } from 'react-router-dom';
import { appConfig } from '../config/appConfig.js';
import { useAppCustomization } from '../context/AppCustomizationContext.jsx';
import { Field } from '../components/Field.jsx';
import { APP_VERSION, BUILD_TIMESTAMP } from '../config/buildInfo.js';
import { ROUTES } from '../router.js';

export function AboutPage() {
  const navigate = useNavigate();
  const { customization } = useAppCustomization();

  return (
    <main className="page narrow-page">
      <section className="settings-card">
        <header className="sub-header"><button className="ghost-button" onClick={() => navigate(ROUTES.settings)}>← Retour</button><h2>À propos</h2></header>
        <p>{customization.description}</p>
        <section className="settings-section about-section">
          <h3>Application</h3>
          <Field label="nom" value={customization.appName} />
          <Field label="identifiant" value={appConfig.appId} />
          <Field label="description" value={customization.description} />
          <Field label="nom court PWA" value={customization.shortName} />
          <Field label="organisation" value={customization.organizationName || '—'} />
          <Field label="support" value={customization.supportEmail || '—'} />
          <Field label="GitHub" value={customization.githubUrl || '—'} />
          <Field label="site web" value={customization.websiteUrl || '—'} />
          <Field label="version frontend" value={APP_VERSION} />
          <Field label="build timestamp" value={BUILD_TIMESTAMP} />
          <Field label="port par défaut" value={appConfig.defaultPort} />
        </section>
      </section>
    </main>
  );
}
