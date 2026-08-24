import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usersService, rolesService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function UsersPanel() {
  const [tab, setTab] = useState('users'); // 'users' | 'roles'

  return (
    <div className="w-full h-full p-4 md:p-6">
      <div className="max-w-4xl mx-auto flex flex-col gap-5">
        <div>
          <h2 className="text-on-surface font-semibold text-base">Usuarios y roles</h2>
          <p className="text-on-surface-variant text-[12px] mt-0.5">
            Administra quién tiene acceso a tu negocio y qué puede hacer cada quien
          </p>
        </div>

        <div className="flex gap-1 border-b border-outline-variant">
          {[
            { id: 'users', label: 'Usuarios' },
            { id: 'roles', label: 'Roles y permisos' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={[
                'px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors',
                tab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'users' ? <UsersTab /> : <RolesTab />}
      </div>
    </div>
  );
}

/* ═══════════════════════ Modal genérico ═══════════════════════════════
   Se monta con un portal directo a document.body (evita que el
   `fixed inset-0` quede atrapado dentro de un ancestro con scroll/
   transform, y evita que el BottomNav quede encima).

   El tamaño y la posición se fuerzan con estilos inline además de las
   clases de Tailwind: en apps que corren en varios targets (web,
   Android/Capacitor, Windows/Electron) cada build puede generar el CSS
   de forma distinta, y `backdrop-filter: blur` es una causa conocida
   de bugs de layout en WebViews cuando se combina con `position:
   fixed` — por eso se quitó el blur y se usa un overlay sólido. ───── */
function Modal({ title, onClose, size = 'md', children }) {
  const maxWidth = size === '2xl' ? 672 : 448;

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      style={{
        position: 'fixed',
        top: 0, right: 0, bottom: 0, left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(24, 28, 32, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant"
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          maxWidth: `${maxWidth}px`,
          maxHeight: '80vh',
        }}
      >
        <div className="px-5 py-4 border-b border-outline-variant flex justify-between items-center shrink-0">
          <h2 className="text-on-surface font-semibold text-base">{title}</h2>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface transition-colors p-1 rounded-full hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div className="overflow-y-auto p-5">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════ Usuarios ═══════════════════════ */
function UsersTab() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersData, rolesData] = await Promise.all([
        usersService.getAll(),
        rolesService.getAll(),
      ]);
      setUsers(usersData);
      setRoles(rolesData);
    } catch (err) {
      setError(err.message || 'Error al cargar usuarios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleToggleActive = async (u) => {
    setError('');
    try {
      await usersService.setStatus(u.id, !u.is_active);
      loadData();
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el estado del usuario.');
    }
  };

  const openNew = () => { setEditingUser(null); setShowForm(true); };
  const openEdit = (u) => { setEditingUser(u); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditingUser(null); };

  if (loading) return <div className="text-on-surface-variant text-[13px] py-4">Cargando…</div>;

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="px-3 py-2 bg-error-container rounded-lg text-on-error-container text-[13px]">
          {error}
        </div>
      )}

      <button
        onClick={openNew}
        className="self-start px-3.5 py-2 text-[13px] font-medium bg-primary text-on-primary rounded-lg hover:bg-primary/90 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm"
      >
        <span className="material-symbols-outlined text-[17px]">add</span>
        Nuevo usuario
      </button>

      {users.length === 0 ? (
        <p className="text-on-surface-variant text-[13px] py-2">Aún no hay usuarios.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {users.map(u => (
            <UserCard
              key={u.id}
              user={u}
              isCurrent={u.id === currentUser?.id}
              onEdit={() => openEdit(u)}
              onToggleActive={() => handleToggleActive(u)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <Modal title={editingUser ? 'Editar usuario' : 'Nuevo usuario'} onClose={closeForm}>
          <UserForm
            roles={roles}
            initial={editingUser}
            onCancel={closeForm}
            onSaved={() => { closeForm(); loadData(); }}
          />
        </Modal>
      )}
    </div>
  );
}

/* ── Tarjeta de usuario ──────────────────────────────────────────────
   Usa UsersUtility, el mismo componente de tarjeta que RoleCard, para
   que ambas secciones (Usuarios y Roles) compartan una única forma
   visual. Toda la card es tocable (abre edición) — en móvil no hay
   hover, así que el toque en cualquier parte debe funcionar igual que
   el lápiz. El toggle de activo/inactivo detiene la propagación para
   no abrir el modal sin querer. ──────────────────────────────────── */
function UserCard({ user, isCurrent, onEdit, onToggleActive }) {
  const initial = (user.name || '?').trim().charAt(0).toUpperCase();

  return (
    <UsersUtility
      avatarLetter={initial}
      onEdit={onEdit}
      onClick={onEdit}
      title={
        <>
          {user.name}
          {isCurrent && <span className="text-on-surface-variant font-normal text-[12px]"> (tú)</span>}
        </>
      }
      subtitle={user.email}
      footer={
        <div className="w-full flex items-center justify-between">
          <span className="text-[11px] px-2 py-1 rounded-full bg-secondary/10 text-secondary font-medium">
            {user.role_name || 'Sin rol'}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleActive(); }}
            disabled={isCurrent}
            title={user.is_active ? 'Desactivar' : 'Activar'}
            className={[
              'relative w-9 h-5 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0',
              user.is_active ? 'bg-secondary' : 'bg-outline-variant',
            ].join(' ')}
          >
            <span className={[
              'absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform',
              user.is_active ? 'translate-x-[18px]' : 'translate-x-0.5',
            ].join(' ')} />
          </button>
        </div>
      }
    />
  );
}

function UserForm({ roles, initial, onCancel, onSaved }) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name || '');
  const [email, setEmail] = useState(initial?.email || '');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState(initial?.role_id || roles[0]?.id || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!name || !email || !roleId || (!isEdit && !password)) {
      setError('Completa todos los campos obligatorios.');
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        const body = { name, email, roleId };
        if (password) body.password = password;
        await usersService.update(initial.id, body);
      } else {
        await usersService.create({ name, email, password, roleId });
      }
      onSaved();
    } catch (err) {
      setError(err.message || 'No se pudo guardar el usuario.');
    } finally {
      setSaving(false);
    }
  };

  const initialLetter = (name || '?').trim().charAt(0).toUpperCase();

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && <div className="px-3 py-2 bg-error-container rounded-lg text-on-error-container text-[13px]">{error}</div>}

      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-secondary/15 text-secondary flex items-center justify-center font-semibold text-[20px] shrink-0">
          {initialLetter}
        </div>
        <div>
          <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide">Usuario</p>
          <p className="text-on-surface text-[13px] mt-0.5">{name || 'Nuevo usuario'}</p>
        </div>
      </div>

      <FormField label="Nombre" value={name} onChange={setName} />
      <FormField label="Correo electrónico" value={email} onChange={setEmail} type="email" />
      <FormField
        label={isEdit ? 'Nueva contraseña (opcional)' : 'Contraseña'}
        value={password} onChange={setPassword} type="password"
        placeholder={isEdit ? 'Dejar en blanco para mantener' : ''}
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide">Rol</label>
        <select
          value={roleId}
          onChange={e => setRoleId(e.target.value)}
          className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-[13px] text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary"
        >
          {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant -mx-5 px-5 -mb-5 pb-5 mt-1">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 text-[13px] font-medium text-on-surface border border-outline-variant rounded-lg hover:bg-surface-container-low transition-colors">
          Cancelar
        </button>
        <button type="submit" disabled={saving}
          className="px-5 py-2 text-[13px] font-medium bg-primary text-on-primary rounded-lg hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50">
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}

function FormField({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-[13px] text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary"
      />
    </div>
  );
}

/* ═══════════════════════ Roles y permisos ═══════════════════════ */
function RolesTab() {
  const [roles, setRoles] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [rolesData, catalogData] = await Promise.all([
        rolesService.getAll(),
        rolesService.getPermissionsCatalog(),
      ]);
      setRoles(rolesData);
      setCatalog(catalogData);
    } catch (err) {
      setError(err.message || 'Error al cargar roles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const categories = catalog.reduce((acc, p) => {
    (acc[p.category] ||= []).push(p);
    return acc;
  }, {});

  const closeModal = () => { setCreating(false); setEditingRole(null); };

  if (loading) return <div className="text-on-surface-variant text-[13px] py-4">Cargando…</div>;

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="px-3 py-2 bg-error-container rounded-lg text-on-error-container text-[13px]">
          {error}
        </div>
      )}

      <button
        onClick={() => setCreating(true)}
        className="self-start px-3.5 py-2 text-[13px] font-medium bg-primary text-on-primary rounded-lg hover:bg-primary/90 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm"
      >
        <span className="material-symbols-outlined text-[17px]">add</span>
        Nuevo rol
      </button>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {roles.map(r => (
          <RoleCard key={r.id} role={r} onEdit={() => setEditingRole(r)} />
        ))}

        <button
          onClick={() => setCreating(true)}
          className="border-2 border-dashed border-outline-variant rounded-xl p-5 flex flex-col items-center
                     justify-center gap-2 text-on-surface-variant hover:text-secondary hover:border-secondary
                     transition-all min-h-[168px]"
        >
          <span className="material-symbols-outlined text-[36px]">add_circle</span>
          <span className="text-[11px] font-semibold uppercase tracking-wide">Crear nuevo rol</span>
        </button>
      </div>

      {(creating || editingRole) && (
        <Modal
          title={editingRole ? `Editar rol · ${editingRole.name}` : 'Nuevo rol'}
          onClose={closeModal}
          size="2xl"
        >
          <RoleForm
            categories={categories}
            initial={editingRole}
            onCancel={closeModal}
            onSaved={() => { closeModal(); loadData(); }}
            onDeleted={() => { closeModal(); loadData(); }}
          />
        </Modal>
      )}
    </div>
  );
}

/* ── Protección de roles ─────────────────────────────────────────────
   El rol del Dueño real (role.is_owner_role) siempre está protegido.
   Además, por decisión de producto, el rol "Administrador" debe ser
   intocable por defecto para todos — sin importar lo que reporte el
   backend en is_owner_role — para evitar que alguien se quede sin un
   rol con permisos completos por accidente. ─────────────────────── */
function isProtectedRole(role) {
  if (!role) return false;
  return role.is_owner_role || role.name?.trim().toLowerCase() === 'administrador';
}

/* ── Tarjeta de rol ───────────────────────────────────────────────────
   También construida sobre UsersUtility — misma forma que UserCard. ── */
function RoleCard({ role, onEdit }) {
  const protectedRole = isProtectedRole(role);

  return (
    <UsersUtility
      avatarIcon={protectedRole ? 'shield_person' : 'badge'}
      avatarBg={protectedRole ? 'bg-secondary/15' : 'bg-surface-container'}
      avatarColor={protectedRole ? 'text-secondary' : 'text-on-surface-variant'}
      onEdit={onEdit}
      onClick={onEdit}
      title={
        <>
          {role.name}
          {protectedRole && (
            <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-secondary/10 text-secondary align-middle">
              {role.is_owner_role ? 'Dueño' : 'Protegido'}
            </span>
          )}
        </>
      }
      subtitle={`${role.user_count} usuario${role.user_count === 1 ? '' : 's'} asignado${role.user_count === 1 ? '' : 's'}`}
      footer={
        <span className="text-[11px] font-semibold text-secondary uppercase tracking-wide">Ver permisos</span>
      }
    />
  );
}

/* ── UsersUtility ─────────────────────────────────────────────────────
   Tarjeta genérica compartida por Usuarios y Roles: mismo borde,
   padding, ícono/avatar circular, lápiz de edición arriba a la
   derecha, título + subtítulo centrados y un pie con divisor. Cada
   sección solo cambia el contenido del avatar y del footer. Toda la
   tarjeta es tocable — no depende de hover — así que en móvil basta
   un toque para entrar a editar. ─────────────────────────────────── */
function UsersUtility({
  avatarIcon,
  avatarLetter,
  avatarBg = 'bg-secondary/15',
  avatarColor = 'text-secondary',
  title,
  subtitle,
  footer,
  onEdit,
  onClick,
}) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') onClick?.(); }}
      className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5
                 flex flex-col shadow-sm hover:shadow-md active:scale-[0.99] transition-all cursor-pointer"
    >
      <div className="flex justify-end -mt-1 -mr-1">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="text-on-surface-variant hover:text-secondary transition-colors p-1.5 rounded-full hover:bg-surface-container"
          title="Editar"
        >
          <span className="material-symbols-outlined text-[18px]">edit</span>
        </button>
      </div>

      <div className="flex flex-col items-center text-center -mt-2 flex-1">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 shrink-0 ${avatarBg} ${avatarColor}`}>
          {avatarIcon ? (
            <span className="material-symbols-outlined text-[26px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              {avatarIcon}
            </span>
          ) : (
            <span className="font-semibold text-[20px]">{avatarLetter}</span>
          )}
        </div>
        <h3 className="text-on-surface font-semibold text-[14px] mb-1">{title}</h3>
        {subtitle && <p className="text-on-surface-variant text-[12px] leading-snug break-words">{subtitle}</p>}
      </div>

      {footer && (
        <div className="mt-4 pt-3 border-t border-outline-variant flex items-center justify-center gap-2">
          {footer}
        </div>
      )}
    </div>
  );
}

function RoleForm({ categories, initial, onCancel, onSaved, onDeleted }) {
  const isEdit = !!initial;
  const protectedRole = isProtectedRole(initial);
  const [name, setName] = useState(initial?.name || '');
  const [selected, setSelected] = useState(new Set(initial?.permissions || []));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggle = (code) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  const handleSave = async () => {
    setError('');
    if (!name.trim()) { setError('El nombre del rol es obligatorio.'); return; }
    setSaving(true);
    try {
      const permissionCodes = Array.from(selected);
      if (isEdit) {
        await rolesService.update(initial.id, { name, permissionCodes });
      } else {
        await rolesService.create({ name, permissionCodes });
      }
      onSaved();
    } catch (err) {
      setError(err.message || 'No se pudo guardar el rol.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar el rol "${initial.name}"? Esta acción no se puede deshacer.`)) return;
    setError('');
    try {
      await rolesService.delete(initial.id);
      onDeleted();
    } catch (err) {
      setError(err.message || 'No se pudo eliminar el rol.');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {error && <div className="px-3 py-2 bg-error-container rounded-lg text-on-error-container text-[13px]">{error}</div>}

      {protectedRole && (
        <div className="px-3 py-2 bg-secondary/10 rounded-lg text-secondary text-[12px] flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">lock</span>
          Este rol está protegido y no puede editarse ni eliminarse.
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide">Nombre del rol</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          disabled={protectedRole}
          className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 text-[13px] text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary disabled:opacity-60"
        />
      </div>

      <div className="flex flex-col gap-4">
        {Object.entries(categories).map(([cat, perms]) => (
          <div key={cat} className="border-t border-outline-variant pt-4 first:border-t-0 first:pt-0">
            <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide mb-2.5">{cat}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {perms.map(p => {
                const isOn = selected.has(p.code);
                return (
                  <button
                    key={p.code}
                    type="button"
                    disabled={protectedRole}
                    onClick={() => toggle(p.code)}
                    className="flex items-center justify-between gap-3 w-full text-left p-3 rounded-lg
                               border border-outline-variant bg-surface-container-low
                               hover:bg-surface-container transition-colors
                               disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-surface-container-low"
                  >
                    <span className="text-[13px] text-on-surface">{p.label}</span>
                    <span className={`relative w-9 h-5 rounded-full shrink-0 transition-colors ${isOn ? 'bg-secondary' : 'bg-outline-variant'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${isOn ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 pt-3 border-t border-outline-variant -mx-5 px-5 -mb-5 pb-5 mt-1">
        {isEdit && !protectedRole ? (
          <button onClick={handleDelete}
            className="px-3 py-2 text-[13px] font-medium text-error hover:bg-error-container/50 rounded-lg transition-colors">
            Eliminar rol
          </button>
        ) : <span />}
        <div className="flex gap-2">
          <button type="button" onClick={onCancel}
            className="px-4 py-2 text-[13px] font-medium text-on-surface border border-outline-variant rounded-lg hover:bg-surface-container-low transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving || protectedRole}
            className="px-5 py-2 text-[13px] font-medium bg-primary text-on-primary rounded-lg hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50">
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}