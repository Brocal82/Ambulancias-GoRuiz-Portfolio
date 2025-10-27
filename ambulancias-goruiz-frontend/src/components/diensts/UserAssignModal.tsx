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

type VacFlag = {
  hasVacationInRange: boolean;
  vacationStartInRange?: string; // 'YYYY-MM-DD'
  vacationUntilInRange?: string; // 'YYYY-MM-DD'
  vacationStartFull?: string;    // 'YYYY-MM-DD' 
  vacationUntilFull?: string;    // 'YYYY-MM-DD'  
};

export default function UserAssignModal({ isOpen, onClose, onConfirm, weekStartISO }: Props) {
  const { token } = useAuth();
  const { t } = useTranslation();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<'driver' | 'medic'>('driver');
  const [userId, setUserId] = useState('');

  // Dropdown personalizado para usuarios
  const [openList, setOpenList] = useState(false);

  // Flags de vacaciones en la semana y estado de carga
  const [vacationFlags, setVacationFlags] = useState<Record<string, VacFlag>>({});
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
  const userSelectId = useId(); // lo reutilizamos como id del botón del dropdown

  // Cargar todos los usuarios
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

  // Filtrar por rol de ambulancia
  const filteredByRole = useMemo(() => {
    const need: AmbulanceRole[] = role === 'driver' ? ['driver', 'both'] : ['medic', 'both'];
    return users.filter(u => u.ambulanceRole && need.includes(u.ambulanceRole));
  }, [users, role]);

  // Cargar flags de vacaciones en rango para los usuarios visibles por rol
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

  // P-Schein solo afecta a DRIVER (para colorear/disabled)
  const driverPscheinClass = (pschein?: string | null) => {
    if (!pschein) return '';
    const info = getPscheinInfo(pschein);
    if (info.status === 'expired') return 'text-red-600 font-medium';
    if (info.status === 'warning') return 'text-yellow-600 font-medium';
    return '';
  };

  const isDriverExpired = (u: User) => {
    if (role !== 'driver') return false;
    const info = getPscheinInfo((u as any)?.pscheinExpiry);
    return info.status === 'expired';
  };

  // Combinar clases sin falsy
  const mergeClasses = (...classes: (string | false | null | undefined)[]) =>
    classes.filter(Boolean).join(' ');

  // Tono apagado para quien está de vacaciones
  const dimClass = 'text-slate-400';

// Info de vacaciones por usuario (tooltip SIEMPRE con rango completo)
const userVacationInfo = (u: User) => {
  const vf = vacationFlags[u._id];
  const has = !!vf?.hasVacationInRange;
  if (!has) return { has: false, title: undefined as string | undefined };

  // Tooltip SOLO con el rango completo; si no llega, mostramos solo la palmera sin fechas
  const fullFrom = vf?.vacationStartFull;
  const fullTo = vf?.vacationUntilFull;

  let title: string | undefined;
  if (fullFrom && fullTo) {
    const from = fmtDDMM(fullFrom);
    const to = fmtDDMM(fullTo);
    title = `🏖️ ${t('pages.diensts.weekModals.vacations', 'Vacaciones')}: ${from} → ${to}`;
  } else {
    // evitamos usar los *InRange* para que no recorte por semana
    title = `🏖️ ${t('pages.diensts.weekModals.vacations', 'Vacaciones')}`;
  }

  return { has: true, title };
};


  // Usuario seleccionado (para el rótulo del botón)
  const selectedUser = useMemo(
    () => filteredByRole.find(u => u._id === userId) || null,
    [filteredByRole, userId]
  );

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
          {/* Selector de rol (nativo, se mantiene) */}
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

          {/* Selector de usuario (dropdown personalizado, como TeamAssignModal) */}
          <div>
            <label htmlFor={userSelectId} className="block text-sm font-medium text-slate-700">
              {t('pages.diensts.assignUserModal.user', 'Trabajador')}
            </label>

            <div className="relative">
              <button
                id={userSelectId}
                type="button"
                className="w-full flex items-center justify-between rounded-xl border border-slate-300 ring-1 ring-slate-200 px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
                onClick={() => setOpenList(v => !v)}
                aria-haspopup="listbox"
                aria-expanded={openList}
              >
                <span className="truncate">
                  {loading
                    ? t('common.loading', 'Cargando...')
                    : selectedUser
                      ? (() => {
                          const vac = userVacationInfo(selectedUser);
                          const driverClass =
                            role === 'driver' ? driverPscheinClass((selectedUser as any)?.pscheinExpiry) : '';
                          return (
                            <span
                              className={mergeClasses(driverClass, vac.has && dimClass)}
                              title={vac.title}
                            >
                              {(selectedUser.lastName || '') + ', ' + (selectedUser.name || '')}
                              {vac.has ? ' 🏖️' : ''}
                            </span>
                          );
                        })()
                      : t('common.select', 'Selecciona')
                  }
                </span>
                <svg
                  className="h-4 w-4 shrink-0 text-slate-500"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              {openList && !loading && (
                <div
                  role="listbox"
                  tabIndex={-1}
                  aria-label="Opciones del selector"
                  className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg ring-1 ring-slate-200"
                >
                  {filteredByRole.length === 0 && (
                    <div className="px-3 py-2 text-sm text-slate-500">
                      {t('common.empty', 'No hay resultados')}
                    </div>
                  )}

                  {filteredByRole
                    .slice() // copia para no mutar
                    .sort((a, b) => {
                      // Habilitados (no expirados) primero si role=driver; luego alfabético
                      const da = isDriverExpired(a) ? 1 : 0;
                      const db = isDriverExpired(b) ? 1 : 0;
                      if (da !== db) return da - db;
                      const ka = `${a.lastName || ''} ${a.name || ''}`.toLowerCase();
                      const kb = `${b.lastName || ''} ${b.name || ''}`.toLowerCase();
                      return ka.localeCompare(kb, 'es');
                    })
                    .map(u => {
                      const vac = userVacationInfo(u);
                      const dClass = role === 'driver' ? driverPscheinClass((u as any)?.pscheinExpiry) : '';
                      const expired = role === 'driver' ? isDriverExpired(u) : false;

                      return (
                        <button
                          key={u._id}
                          role="option"
                          aria-selected={userId === u._id}
                          onClick={() => {
                            if (expired) return; // no permitir seleccionar expirado
                            setUserId(u._id);
                            setOpenList(false);
                          }}
                          className={mergeClasses(
                            'w-full text-left px-3 py-2 text-sm hover:bg-slate-50 focus:bg-slate-50 focus:outline-none',
                            userId === u._id && 'bg-slate-50',
                            expired && 'opacity-50 cursor-not-allowed'
                          )}
                          title={vac.title}
                        >
                          <span className={mergeClasses(dClass, vac.has && dimClass)}>
                            {(u.lastName || '') + ', ' + (u.name || '')}{vac.has ? ' 🏖️' : ''}
                          </span>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Leyenda para el caso driver */}
            {role === 'driver' && (
              <p className="mt-1 text-[11px] text-slate-500">
                🚫 {t('pages.diensts.adminPage.legendCantDrive', 'No puede conducir, P-Schein caducado')}
              </p>
            )}

            {/* Hint para tooltip de vacaciones */}
            {flagsLoading ? (
              <p className="mt-1 text-[11px] text-slate-500">
                {t('common.loading', 'Cargando...')}
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-slate-500">
                🏖️ {t('pages.diensts.weekModals.vacationsHint', 'Pasa el ratón para ver fechas de vacaciones')}
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
