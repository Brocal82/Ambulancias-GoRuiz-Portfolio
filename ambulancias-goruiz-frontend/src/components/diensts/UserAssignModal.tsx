// frontend/src/components/diensts/UserAssignModal.tsx
import { useEffect, useId, useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { getAllUsers } from '../../api/users';
import type { AmbulanceRole, User } from '../../types/user';
import { getPscheinInfo } from '../../utils/pscheinUtils';
import { getVacationFlagsInRange } from '../../api/vacation';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (params: { role: 'driver' | 'medic'; userId: string }) => Promise<void> | void;
  weekStartISO: string;
}

export default function UserAssignModal({ isOpen, onClose, onConfirm, weekStartISO }: Props) {
  const { token } = useAuth();
  const { t } = useTranslation();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<'driver' | 'medic'>('driver');
  const [userId, setUserId] = useState('');

  // --- NUEVO: flags de vacaciones en la semana y estado de carga ---
  const [vacationFlags, setVacationFlags] = useState<Record<string, {
    hasVacationInRange: boolean;
    vacationStartInRange?: string; // 'YYYY-MM-DD'
    vacationUntilInRange?: string; // 'YYYY-MM-DD'
  }>>({});
  const [flagsLoading, setFlagsLoading] = useState(false);

  // Helpers locales
  const addDaysISO = (iso: string, days: number) => {
    const d = new Date(iso);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };
  const fmtDDMM = (iso?: string) => {
    if (!iso) return '';
    const [, m, d] = iso.split('-');
    return `${d}/${m}`;
  };

  // Fin de semana = inicio + 6 días
  const weekEndISO = useMemo(() => addDaysISO(weekStartISO, 6), [weekStartISO]);

  const roleId = useId();
  const userSelectId = useId();

  // Cargar todos los usuarios (como ya hacías)
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

  // 1) Filtra por rol de ambulancia (driver|both para driver, medic|both para medic)
  const filteredByRole = useMemo(() => {
    const need: AmbulanceRole[] = role === 'driver' ? ['driver', 'both'] : ['medic', 'both'];
    return users.filter(u => u.ambulanceRole && need.includes(u.ambulanceRole));
  }, [users, role]);

  // 2) Cargar flags de vacaciones en rango para los usuarios visibles por rol
  useEffect(() => {
    if (!isOpen || !token) return;
    if (filteredByRole.length === 0) {
      setVacationFlags({});
      return;
    }

    const ids = filteredByRole.map(u => u._id).filter(Boolean);
    let cancelled = false;

    (async () => {
      try {
        setFlagsLoading(true);
        const flags = await getVacationFlagsInRange(token, {
          userIds: ids,
          fromISO: weekStartISO,
          toISO: weekEndISO,
        });
        if (!cancelled) setVacationFlags(flags);
      } catch (e) {
        console.error('❌ Error al obtener flags de vacaciones en rango:', e);
        if (!cancelled) setVacationFlags({});
      } finally {
        if (!cancelled) setFlagsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isOpen, token, filteredByRole, weekStartISO, weekEndISO]);

  // 3) Prepara opciones: P-Schein + 🌴 vacaciones (tooltip desde → hasta)
  const options = useMemo(() => {
    return filteredByRole
      .map(u => {
        const baseLabel = `${u.lastName || ''}${u.lastName ? ', ' : ''}${u.name || ''}` || '—';
        const sortKey = `${u.lastName || ''} ${u.name || ''}`.toLowerCase();

        // P-Schein (solo afecta a driver)
        let disabled = false;
        let label = baseLabel;
        if (role === 'driver') {
          const info = getPscheinInfo((u as any).pscheinExpiry);
          if (info.status === 'expired') {
            disabled = true;
            label = `${baseLabel} — ${t('pages.diensts.adminPage.driverPscheinExpired', 'P-Schein caducado')}`;
          } else if (info.status === 'warning') {
            const months = info.monthsLeft ?? 0;
            label = `${baseLabel} — ⚠️ (${months} ${months === 1 ? t('common.month', 'mes') : t('common.months', 'meses')} ${t('common.left', 'restantes')})`;
          }
        }

        // 🌴 Vacaciones en la semana objetivo
        const vf = vacationFlags[u._id];
        let title: string | undefined;
        if (vf?.hasVacationInRange) {
          label = `${label} 🌴`;
          const from = fmtDDMM(vf.vacationStartInRange);
          const to = fmtDDMM(vf.vacationUntilInRange);
          title = from && to
            ? `🌴 ${t('pages.diensts.weekModals.vacations', 'Vacaciones')}: ${from} → ${to}`
            : `🌴 ${t('pages.diensts.weekModals.vacations', 'Vacaciones')}`;
        }

        return {
          id: u._id,
          label,
          title,     // se inyecta en <option title="...">
          disabled,
          sortKey,
        };
      })
      // Habilitados primero, luego alfabético
      .sort((a, b) => {
        if (+a.disabled !== +b.disabled) return +a.disabled - +b.disabled;
        return a.sortKey.localeCompare(b.sortKey, 'es');
      });
  }, [filteredByRole, role, t, vacationFlags]);

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
              onChange={(e) => { setRole(e.target.value as 'driver' | 'medic'); setUserId(''); }}
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
              <option value="">
                {loading ? t('common.loading', 'Cargando...') : t('common.select', 'Selecciona')}
              </option>
              {options.map(opt => (
                <option key={opt.id} value={opt.id} disabled={opt.disabled} title={opt.title}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Leyenda para el caso driver */}
            {role === 'driver' && (
              <p className="mt-1 text-[11px] text-slate-500">
                ❌ {t('pages.diensts.adminPage.legendExpired', 'P-Schein caducado')} ·{' '}
                🚫 {t('pages.diensts.adminPage.legendCantDrive', 'No puede conducir')}
              </p>
            )}

            {/* Hint para tooltip de vacaciones */}
            {flagsLoading ? (
              <p className="mt-1 text-[11px] text-slate-500">
                {t('common.loading', 'Cargando...')}
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-slate-500">
                🌴 {t('pages.diensts.weekModals.vacationsHint', 'Pasa el ratón para ver fechas de vacaciones')}
              </p>
            )}
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
