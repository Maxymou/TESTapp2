import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { ROUTES } from '../router.js';
import { useAppCustomization } from '../context/AppCustomizationContext.jsx';
import {
  getAppCustomization,
  resetAppCustomization,
  updateAppCustomization,
  uploadAppLogo,
  uploadPwaIcon
} from '../services/appCustomization.js';

const textFields = [
  ['appName', "Nom de l'application", 'Identité'],
  ['shortName', 'Nom court PWA', 'Identité'],
  ['description', 'Description', 'Identité'],
  ['welcomeText', "Texte d'accueil", 'Identité'],
  ['organizationName', "Nom de l'organisation", 'Informations'],
  ['supportEmail', 'Email de contact/support', 'Informations'],
  ['githubUrl', 'URL GitHub', 'Informations'],
  ['websiteUrl', 'URL site web', 'Informations']
];

const emptyForm = {
  appName: '',
  shortName: '',
  description: '',
  welcomeText: '',
  organizationName: '',
  supportEmail: '',
  primaryColor: '#2563eb',
  secondaryColor: '#64748b',
  logoUrl: '',
  pwaIconUrl: '',
  githubUrl: '',
  websiteUrl: ''
};

const toForm = (customization) => ({ ...emptyForm, ...(customization || {}) });

function TextInput({ label, value, onChange, type = 'text', required = false, multiline = false }) {
  return (
    <label>
      {label}
      {multiline ? <textarea value={value} onChange={(event) => onChange(event.target.value)} required={required} rows="3" /> : <input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} />}
    </label>
  );
}

function ImageUpload({ label, value, onUpload, disabled }) {
  return (
    <div className="image-upload-row">
      <div>
        <span>{label}</span>
        <p>PNG, JPG, WEBP ou SVG — 2 Mo maximum.</p>
        <input type="file" accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml" disabled={disabled} onChange={(event) => event.target.files?.[0] && onUpload(event.target.files[0])} />
      </div>
      <div className="image-preview" aria-label={`Aperçu ${label}`}>
        {value ? <img src={value} alt={`Aperçu ${label}`} /> : <span>Aucun fichier</span>}
      </div>
    </div>
  );
}

export function CustomizationPage() {
  const navigate = useNavigate();
  const { notify, confirm } = useOutletContext();
  const { customization, refreshCustomization } = useAppCustomization();
  const [form, setForm] = useState(() => toForm(customization));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const payload = await getAppCustomization();
        if (active) setForm(toForm(payload.customization));
      } catch (err) {
        const message = err.message || 'Impossible de charger la personnalisation.';
        setError(message);
        notify({ type: 'error', message });
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [notify]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = await updateAppCustomization(form);
      setForm(toForm(payload.customization));
      await refreshCustomization();
      setSuccess('Personnalisation enregistrée.');
      notify({ type: 'success', message: 'Personnalisation enregistrée.' });
    } catch (err) {
      const message = err.message || 'Enregistrement impossible.';
      setError(message);
      notify({ type: 'error', message });
    } finally {
      setSaving(false);
    }
  };

  const uploadImage = async (kind, file) => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = kind === 'logo' ? await uploadAppLogo(file) : await uploadPwaIcon(file);
      const next = toForm(payload.customization);
      setForm(next);
      await refreshCustomization();
      setSuccess(kind === 'logo' ? 'Logo principal mis à jour.' : 'Icône PWA mise à jour.');
      notify({ type: 'success', message: kind === 'logo' ? 'Logo principal mis à jour.' : 'Icône PWA mise à jour.' });
    } catch (err) {
      const message = err.message || 'Upload impossible.';
      setError(message);
      notify({ type: 'error', message });
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    const ok = await confirm({ title: 'Restaurer les valeurs par défaut ?', message: 'Cette action réinitialise les textes, couleurs et chemins de logo de la personnalisation.', confirmLabel: 'Restaurer', variant: 'danger' });
    if (!ok) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = await resetAppCustomization();
      setForm(toForm(payload.customization));
      await refreshCustomization();
      setSuccess('Valeurs par défaut restaurées.');
      notify({ type: 'success', message: 'Valeurs par défaut restaurées.' });
    } catch (err) {
      const message = err.message || 'Restauration impossible.';
      setError(message);
      notify({ type: 'error', message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="page customization-page">
      <header className="sub-header"><button className="ghost-button" onClick={() => navigate(ROUTES.settings)}>← Retour</button><h2>Personnalisation</h2></header>
      {error && <div className="error-box">{error}</div>}
      {success && <div className="success-box">{success}</div>}
      {loading ? <section className="panel"><p>Chargement…</p></section> : (
        <form className="customization-form" onSubmit={submit}>
          <section className="panel customization-section">
            <h3>Identité</h3>
            {textFields.filter(([, , section]) => section === 'Identité').map(([field, label]) => <TextInput key={field} label={label} value={form[field]} onChange={(value) => setField(field, value)} required={['appName', 'shortName'].includes(field)} multiline={['description', 'welcomeText'].includes(field)} />)}
          </section>
          <section className="panel customization-section">
            <h3>Apparence</h3>
            <ImageUpload label="Logo principal" value={form.logoUrl} disabled={saving} onUpload={(file) => uploadImage('logo', file)} />
            <ImageUpload label="Icône PWA" value={form.pwaIconUrl} disabled={saving} onUpload={(file) => uploadImage('pwa-icon', file)} />
            <TextInput label="Couleur principale" type="color" value={form.primaryColor} onChange={(value) => setField('primaryColor', value)} required />
            <TextInput label="Couleur secondaire" type="color" value={form.secondaryColor} onChange={(value) => setField('secondaryColor', value)} required />
          </section>
          <section className="panel customization-section">
            <h3>Informations</h3>
            {textFields.filter(([, , section]) => section === 'Informations').map(([field, label]) => <TextInput key={field} label={label} value={form[field]} onChange={(value) => setField(field, value)} type={field === 'supportEmail' ? 'email' : field.endsWith('Url') ? 'url' : 'text'} />)}
          </section>
          <div className="customization-actions">
            <button type="button" className="danger-button" disabled={saving} onClick={reset}>Restaurer les valeurs par défaut</button>
            <button className="primary-button" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div>
        </form>
      )}
    </main>
  );
}
