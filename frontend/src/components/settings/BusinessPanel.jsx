import { useState, useEffect } from 'react';
import { getBusinessSettings, saveBusinessSettings, uploadLogo } from '../../services/businessService';

export default function BusinessPanel() {
  const [form, setForm] = useState({
    business_name: '', phone: '', email: '', address: '', logo_url: null,
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    getBusinessSettings()
      .then(data => setForm({
        business_name: data.business_name ?? '',
        phone: data.phone ?? '',
        email: data.email ?? '',
        address: data.address ?? '',
        logo_url: data.logo_url ?? null,
      }))
      .finally(() => setLoading(false));
  }, []);

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      let logo_url = form.logo_url;
      if (logoFile) {
        logo_url = await uploadLogo(logoFile); // devuelve la URL pública
      }
      const updated = await saveBusinessSettings({ ...form, logo_url });
      setForm(f => ({ ...f, logo_url: updated.logo_url }));
      setLogoFile(null);
      setSaved(true);
      setIsEditing(false);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-on-surface-variant text-[13px]">Cargando…</div>;

  return (
    <div className="w-full h-full p-4 md:p-6">
    <div className="max-w-4xl mx-auto flex flex-col gap-5">
      <div>
        <h2 className="text-on-surface font-semibold text-base">
          {isEditing ? 'Editar datos del negocio' : 'Datos del negocio'}
        </h2>
        {!isEditing && (
          <p className="text-on-surface-variant text-[12px] mt-0.5">
            Esta información aparecerá en tus tickets de venta
          </p>
        )}
      </div>

      {/* Card */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 md:p-6 relative flex flex-col gap-5">
        {!isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="absolute top-4 right-4 md:top-5 md:right-5 p-2 rounded-full hover:bg-surface-container transition-colors text-primary"
          >
            <span className="material-symbols-outlined text-[20px]">edit</span>
          </button>
        )}

        {/* Logo */}
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="w-20 h-20 md:w-32 md:h-32 rounded-xl overflow-hidden border-2 border-primary shrink-0
                          bg-surface-container-lowest flex items-center justify-center">
            {(logoPreview || form.logo_url)
              ? <img src={logoPreview || form.logo_url} alt="Logo" className="w-full h-full object-contain p-2" />
              : <span className="material-symbols-outlined text-[28px] text-on-surface-variant">store</span>}
          </div>
          {isEditing && (
            <label className="px-3 py-2 border border-outline-variant rounded-lg text-[13px]
                              text-on-surface-variant hover:bg-surface-container cursor-pointer transition-colors">
              Cambiar logo
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            </label>
          )}
        </div>

        {/* Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nombre del negocio" value={form.business_name} editing={isEditing}
            onChange={v => setForm(f => ({ ...f, business_name: v }))} />
          <Field label="Teléfono" value={form.phone} editing={isEditing}
            onChange={v => setForm(f => ({ ...f, phone: v }))} />
          <Field label="Correo electrónico" value={form.email} type="email" editing={isEditing} className="md:col-span-2"
            onChange={v => setForm(f => ({ ...f, email: v }))} />
          <Field label="Ubicación" value={form.address} multiline editing={isEditing} className="md:col-span-2"
            onChange={v => setForm(f => ({ ...f, address: v }))} />
        </div>

        {isEditing && (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setIsEditing(false); setLogoFile(null); setLogoPreview(null); }}
              className="px-4 py-2 text-[13px] font-medium text-on-surface-variant
                         rounded-lg hover:bg-surface-container active:scale-95 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-[13px] font-medium bg-primary text-on-primary
                         rounded-lg hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50"
            >
              {saving ? 'Guardando…' : saved ? '¡Guardado!' : 'Guardar cambios'}
            </button>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', multiline = false, editing = false, className = '' }) {
  const Tag = multiline ? 'textarea' : 'input';
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide">{label}</label>
      {editing ? (
        <Tag
          type={multiline ? undefined : type}
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={multiline ? 2 : undefined}
          className="w-full bg-surface-container-low border border-outline-variant rounded-lg
                     px-3 py-2 text-[13px] text-on-surface
                     focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary"
        />
      ) : (
        <div className={`w-full bg-surface-container-low border border-outline-variant rounded-lg
                         px-3 py-2 text-[13px] text-on-surface ${multiline ? 'min-h-[52px]' : 'min-h-[36px]'} flex items-center`}>
          {value || <span className="text-on-surface-variant/60">—</span>}
        </div>
      )}
    </div>
  );
}