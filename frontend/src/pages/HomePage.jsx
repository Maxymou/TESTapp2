import { appConfig } from '../config/appConfig.js';

export function HomePage() {
  return (
    <main className="page home-page">
      <section className="panel welcome-card">
        <p className="eyebrow">Accueil</p>
        <h2>{appConfig.appName}</h2>
        <p>Bienvenue dans l'application.</p>
        <div className="placeholder-note">
          <h3>Point de départ</h3>
          <p>Cette page est le point de départ du futur module métier. Remplacez ce contenu par les pages spécifiques de la nouvelle application.</p>
        </div>
      </section>
    </main>
  );
}
