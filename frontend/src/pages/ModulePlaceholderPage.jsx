export function ModulePlaceholderPage({ title }) {
  return (
    <main className="page home-page">
      <section className="panel welcome-card">
        <p className="eyebrow">À personnaliser</p>
        <h2>{title}</h2>
        <p>Emplacement réservé pour un futur module métier.</p>
        <div className="placeholder-note">
          <h3>Template</h3>
          <p>Remplacez cette carte par l'écran, les services et les composants métier de votre application.</p>
        </div>
      </section>
    </main>
  );
}
