// frontend/src/components/diensts/TeamAssignModal.tsx
import { useEffect, useState, useId, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getTeams, type Team } from '../../api/teams';
import { toastT } from '../../utils/toast';
import { useTranslation } from 'react-i18next';
import { getPscheinInfo } from '../../utils/pscheinUtils';
import { getVacationFlagsInRange } from '../../api/vacation';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (teamId: string) => Promise<void> | void;
  weekStartISO: string;
}

type VacFlag = {
  hasVacationInRange: boolean;
  vacationStartInRange?: string; // 'YYYY-MM-DD'
  vacationUntilInRange?: string; // 'YYYY-MM-DD'
};

export default function TeamAssignModal({ isOpen, onClose, onConfirm, weekStartISO }: Props) {
  const { token } = useAuth();
  const { t } = useTranslation();

  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [openList, setOpenList] = useState(false);
  const [flagsLoading, setFlagsLoading] = useState(false);

  // Flags por usuario (driver/medic)
  const [vacationFlags, setVacationFlags] = useState<Record<string, VacFlag>>({});

  const selectId = useId();

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

  // Cargar equipos
  useEffect(() => {
    const load = async () => {
      if (!isOpen || !token) return;
      try {
        setLoading(true);
        const data = await getTeams(token);
        setTeams(data);
      } catch (e) {
        console.error(e);
        toastT.error(['toasts.teams.loadError']);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isOpen, token]);

  // Cargar flags de vacaciones para todos los usuarios (driver/medic) presentes en los equipos
  useEffect(() => {
    if (!isOpen || !token) return;
    if (teams.length === 0) {
      setVacationFlags({});
      return;
    }

    // Recoger IDs únicos de driver y medic
    const ids = new Set<string>();
    for (const t of teams) {
      const dId = (t.driver as any)?._id || (t.driver as any);
      const mId = (t.medic as any)?._id || (t.medic as any);
      if (typeof dId === 'string') ids.add(dId);
      if (typeof mId === 'string') ids.add(mId);
    }
    const userIds = Array.from(ids);
    if (userIds.length === 0) {
      setVacationFlags({});
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setFlagsLoading(true);
        const flags = await getVacationFlagsInRange(token, {
          userIds,
          fromISO: weekStartISO,
          toISO: weekEndISO,
        });
        if (!cancelled) setVacationFlags(flags);
      } catch (e) {
        console.error('❌ Error al obtener flags de vacaciones en rango (teams):', e);
        if (!cancelled) setVacationFlags({});
      } finally {
        if (!cancelled) setFlagsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, token, teams, weekStartISO, weekEndISO]);

  if (!isOpen) return null;

  const selectedTeam = teams.find(t => t._id === selectedId) || null;

  const driverClass = (pschein?: string | null) => {
    if (!pschein) return '';
    const info = getPscheinInfo(pschein);
    if (info.status === 'expired') return 'text-red-600 font-medium';
    if (info.status === 'warning') return 'text-yellow-600 font-medium';
    return '';
  };

  // Combinar clases sin falsy
  const mergeClasses = (...classes: (string | false | null | undefined)[]) =>
    classes.filter(Boolean).join(' ');

  // Tono apagado para quien está de vacaciones
  const dimClass = 'text-slate-400';

  // Info de vacaciones por usuario (driver o medic)
  const userVacationInfo = (user: any) => {
    const uid: string | undefined =
      typeof user === 'object' && user ? (user as any)._id : (user as any);
    if (!uid) return { has: false, title: undefined as string | undefined };

    const vf = vacationFlags[uid];
    const has = !!vf?.hasVacationInRange;

    if (!has) return { has: false, title: undefined as string | undefined };

    const from = fmtDDMM(vf?.vacationStartInRange);
    const to = fmtDDMM(vf?.vacationUntilInRange);
    const title =
      from && to
        ? `🌴 ${t('pages.diensts.weekModals.vacations', 'Vacaciones')}: ${from} → ${to}`
        : `🌴 ${t('pages.diensts.weekModals.vacations', 'Vacaciones')}`;

    return { has: true, title };
  };

  // Render del rótulo seleccionado (🌴 y “apagado” sólo en quien corresponda)
  const renderSelectedTeamLabel = () => {
    if (loading) return t('common.loading');
    if (!selectedTeam) return t('common.select');

    const drv: any = selectedTeam.driver;
    const med: any = selectedTeam.medic;

    const drvVac = userVacationInfo(drv);
    const medVac = userVacationInfo(med);

    return (
      <span className="truncate">
        <span
          className={mergeClasses(
            driverClass(drv?.pscheinExpiry),
            drvVac.has && dimClass
          )}
          title={drvVac.title}
        >
          {(drv?.lastName || '') + ', ' + (drv?.name || '')}{drvVac.has ? ' 🌴' : ''}
        </span>
        {' / '}
        <span
          className={mergeClasses(medVac.has && dimClass)}
          title={medVac.title}
        >
          {(med?.lastName || '') + ', ' + (med?.name || '')}{medVac.has ? ' 🌴' : ''}
        </span>
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
        <h3 className="text-lg font-semibold text-slate-900 mb-3">
          {t('pages.diensts.assignTeamModal.title')}
        </h3>

        <div className="space-y-2">
          <label htmlFor={selectId} className="block text-sm font-medium text-slate-700">
            {t('pages.diensts.assignTeamModal.select')}
          </label>

          {/* Dropdown personalizado para poder colorear solo el nombre del conductor y mostrar 🌴 por miembro */}
          <div className="relative">
            <button
              id={selectId}
              type="button"
              className="w-full flex items-center justify-between rounded-xl border border-slate-300 ring-1 ring-slate-200 px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
              onClick={() => setOpenList(v => !v)}
              aria-haspopup="listbox"
              aria-expanded={openList}
            >
              {renderSelectedTeamLabel()}
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
                {teams.length === 0 && (
                  <div className="px-3 py-2 text-sm text-slate-500">
                    {t('pages.adminTeams.empty', 'Todavía no hay equipos creados.')}
                  </div>
                )}

                {teams.map((tItem) => {
                  const isSelected = selectedId === tItem._id;
                  const drv: any = tItem.driver;
                  const med: any = tItem.medic;

                  const drvVac = userVacationInfo(drv);
                  const medVac = userVacationInfo(med);

                  return (
                    <button
                      key={tItem._id}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        setSelectedId(tItem._id);
                        setOpenList(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 focus:bg-slate-50 focus:outline-none ${isSelected ? 'bg-slate-50' : ''}`}
                    >
                      <span
                        className={mergeClasses(
                          driverClass(drv?.pscheinExpiry),
                          drvVac.has && dimClass
                        )}
                        title={drvVac.title}
                      >
                        {(drv?.lastName || '') + ', ' + (drv?.name || '')}{drvVac.has ? ' 🌴' : ''}
                      </span>
                      <span className="text-slate-500"> / </span>
                      <span className={mergeClasses(medVac.has && dimClass)} title={medVac.title}>
                        {(med?.lastName || '') + ', ' + (med?.name || '')}{medVac.has ? ' 🌴' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

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

        <div className="mt-4 space-y-2">
          <button
            className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-50"
            disabled={!selectedId || loading}
            onClick={async () => {
              if (!selectedId) return;
              await onConfirm(selectedId);
            }}
          >
            {t('pages.diensts.assignTeamModal.confirm')}
          </button>
          <button
            className="w-full rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-300 focus:outline-none focus:ring-4 focus:ring-slate-100"
            onClick={onClose}
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
