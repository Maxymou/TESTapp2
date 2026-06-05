export function Field({ label, value }) {
  return (
    <div className="field">
      <span>{label}</span>
      <strong>{value ?? '—'}</strong>
    </div>
  );
}
