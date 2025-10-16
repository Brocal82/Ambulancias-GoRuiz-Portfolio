import { useEffect, useId, useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { getAllUsers } from '../../api/users';
import type { AmbulanceRole, User } from '../../types/user';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (params: { role: 'driver' | 'medic'; userId: string }) => Promise<void> | void;
}

export default function UserAssignModal({ isOpen, onClose, onConfirm }: Props) {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<'driver' | 'medic'>('driver');
  const [userId, setUserId] = useState('');
  const roleId = useId();
  const userSelectId = useId();

  useEffect(() => {
    if (!isOpen || !token) return;
    (async () => {
      try {
        setLoading(true);
        const data = await getAllUsers(token);
        setUsers(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen, token]);

  const filtered = useMemo(() => {
    const need: AmbulanceRole[] = role === 'driver' ? ['driver', 'both'] : ['medic', 'both'];
    return users
      .filter(u => u.ambulanceRole && need.includes(u.ambulanceRole))
      .sort((a, b) => (a.lastName || '').localeCompare(b.lastName || '', 'es'));
  }, [users, role]);

  if (!isOpen) return null;

  const canAssign = !!userId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
        <h3 className="text-lg font-semibold text-slate-900 mb-3">
          {t('pages.diensts.assignUserModal.title', 'Asignar trabajador a la semana')}
        </h3>

        <div className="space-y-3">
          <div>
            <label htmlFor={roleId} className="block text-sm font-medium text-slate-700">
              {t('pages.diensts.assignUserModal.role', 'Rol')}
            </label>
            <select
              id={roleId}
              value={role}
              onChange={(e) => { setRole(e.target.value as 'driver'|'medic'); setUserId(''); }}
              className="w-full rounded-xl border border-slate-300 ring-1 ring-slate-200 px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
              disabled={loading}
            >
              <option value="driver">{t('pages.diensts.assignUserModal.roleDriver', 'Conductor')}</option>
              <option value="medic">{t('pages.diensts.assignUserModal.roleMedic', 'Sanitario')}</option>
            </select>
          </div>

          <div>
            <label htmlFor={userSelectId} className="block text-sm font-medium text-slate-700">
              {t('pages.diensts.assignUserModal.user', 'Trabajador')}
            </label>
            <select
              id={userSelectId}
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 ring-1 ring-slate-200 px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
              disabled={loading}
            >
              <option value="">{loading ? t('common.loading', 'Cargando...') : t('common.select', 'Selecciona')}</option>
              {filtered.map(u => (
                <option key={u._id} value={u._id}>
                  {(u.lastName || '') + ', ' + (u.name || '')}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <button
            className="w-full rounded-xl bg-slate-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-200 disabled:opacity-50"
            disabled={!canAssign || loading}
            onClick={async () => {
              if (!canAssign) return;
              await onConfirm({ role, userId });
            }}
          >
            {t('pages.diensts.assignUserModal.confirm', 'Asignar')}
          </button>
          <button
            className="w-full rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-300 focus:outline-none focus:ring-4 focus:ring-slate-100"
            onClick={onClose}
          >
            {t('common.cancel', 'Cancelar')}
          </button>
        </div>
      </div>
    </div>
  );
}
