import { useAppCustomization } from '../context/AppCustomizationContext.jsx';

export function HomePage() {
  const { customization } = useAppCustomization();

  return (
    <main className="page home-page">
      <section className="panel welcome-card">
        {customization.logoUrl && <img className="welcome-logo" src={customization.logoUrl} alt="Logo de l'application" />}
        <p className="eyebrow">Accueil</p>
        <h2>{customization.appName}</h2>
        <p>{customization.welcomeText}</p>
        <div className="placeholder-note">
          <h3>Point de départ</h3>
          <p>{customization.description}</p>
        </div>
      </section>
    </main>
  );
}
