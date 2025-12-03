// frontend/src/pages/AdminTeamsPage.tsx
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { getTeams, createTeam, deleteTeam } from '../api/teams';
import type { Team } from '../api/teams';
import TeamCreateModal from '../components/teams/TeamCreateModal';
import { toastT } from '../utils/toast';
import { getPscheinInfo } from '../utils/pscheinUtils';
import { getVacationFlagsInRange, type VacFlag } from '../api/vacation';
import { getSickFlagsInRange, type SickFlag } from '../api/sickLeaves';
import { fmtDDMM } from '../utils/timeUtils';

export default function AdminTeamsPage() {
  const { token } = useAuth();
  const { t } = useTranslation();

  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // 🏖️ / 🤒 Flags semanales por usuario (mapas por userId)
  const [vacationFlags, setVacationFlags] = useState<Record<string, VacFlag>>({});
  const [sickFlags, setSickFlags] = useState<Record<string, SickFlag>>({});

  // =========================
  // Fecha (Europe/Berlin)
  // =========================
  const getBerlinYMD = (d: Date) => {
    const y = Number(d.toLocaleString('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric' }));
    const m = Number(d.toLocaleString('en-CA', { timeZone: 'Europe/Berlin', month: '2-digit' }));
    const day = Number(d.toLocaleString('en-CA', { timeZone: 'Europe/Berlin', day: '2-digit' }));
    return { y, m, day };
  };
  const toISO = (y: number, m: number, d: number) =>
    `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  // Semana actual (Lun→Dom) en Berlin
  const getBerlinWeekRangeISO = () => {
    const now = new Date();
    const { y, m, day } = getBerlinYMD(now);
    const todayUTC = new Date(Date.UTC(y, m - 1, day));
    const dow = todayUTC.getUTCDay(); // 0=Dom, 1=Lun, ... 6=Sáb
    const diffToMonday = dow === 0 ? -6 : 1 - dow;
    const mondayUTC = new Date(Date.UTC(y, m - 1, day + diffToMonday));
    const sundayUTC = new Date(Date.UTC(y, m - 1, day + diffToMonday + 6));
    return {
      weekStartISO: toISO(mondayUTC.getUTCFullYear(), mondayUTC.getUTCMonth() + 1, mondayUTC.getUTCDate()),
      weekEndISO: toISO(sundayUTC.getUTCFullYear(), sundayUTC.getUTCMonth() + 1, sundayUTC.getUTCDate()),
    };
  };

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getTeams(token);
      setTeams(data);
    } catch (e: any) {
      console.error(e);
      setError(
        e?.response?.data?.message ??
        t('pages.adminTeams.loadError', 'No se pudieron cargar los equipos')
      );
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    load();
  }, [load]);

  // 🏖️/🤒 Cargar flags semanales para todos los usuarios listados en equipos (includeFullSpan para tooltips FULL)
  useEffect(() => {
    if (!token || teams.length === 0) {
      setVacationFlags({});
      setSickFlags({});
      return;
    }

    const ids = new Set<string>();
    for (const team of teams) {
      const dId = (team.driver as any)?._id || (team.driver as any);
      const mId = (team.medic as any)?._id || (team.medic as any);
      if (typeof dId === 'string') ids.add(dId);
      if (typeof mId === 'string') ids.add(mId);
    }
    const userIds = Array.from(ids);
    if (userIds.length === 0) {
      setVacationFlags({});
      setSickFlags({});
      return;
    }

    const { weekStartISO, weekEndISO } = getBerlinWeekRangeISO();
    let cancelled = false;

    (async () => {
      try {
        const vacPromise = getVacationFlagsInRange(token, {
          userIds,
          fromISO: weekStartISO,
          toISO: weekEndISO,
          includeFullSpan: true,
        });
        const sickPromise = getSickFlagsInRange({
          userIds,
          fromISO: weekStartISO,
          toISO: weekEndISO,
          includeFullSpan: true,
        });

        const [vFlags, sFlags] = await Promise.all([vacPromise, sickPromise]);
        if (!cancelled) {
          setVacationFlags(vFlags);
          setSickFlags(sFlags);
        }
      } catch (e) {
        console.error('❌ Error al cargar flags (vacaciones/bajas) en AdminTeamsPage:', e);
        if (!cancelled) {
          setVacationFlags({});
          setSickFlags({});
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, teams]);

  const handleCreate = async (payload: { driver: string; medic: string }) => {
    if (!token) return;
    try {
      await createTeam(payload, token);
      toastT.success(['pages.adminTeams.created']);
      await load();
    } catch (e: any) {
      console.error(e);
      toastT.error([e?.response?.data?.message || 'pages.adminTeams.createError']);
    }
  };

  const handleDelete = async (teamId: string) => {
    if (!token) return;
    const confirmed = confirm(
      t('pages.adminTeams.confirmDelete', '¿Eliminar este equipo?')
    );
    if (!confirmed) return;

    try {
      await deleteTeam(teamId, token);
      toastT.success(['pages.adminTeams.deleted']);
      await load();
    } catch (e: any) {
      console.error(e);
      toastT.error([e?.response?.data?.message || 'pages.adminTeams.deleteError']);
    }
  };

  // ⚙️ Estilo visual + iconos para conductor según P-Schein
  const getDriverDecor = (team: Team) => {
    const d = team?.driver as any;
    if (!d || typeof d !== 'object') {
      return { cls: '', title: undefined as string | undefined, expired: false, warning: false };
    }

    const info = getPscheinInfo(d.pscheinExpiry ?? undefined);

    if (info.status === 'expired') {
      return {
        cls: 'text-red-600 font-medium',
        title: t('pages.diensts.adminPage.driverPscheinExpired', 'P-Schein caducado, no puede conducir') as string,
        expired: true,
        warning: false,
      };
    }

    if (info.status === 'warning') {
      return {
        cls: 'text-amber-600 font-medium',
        title: t('pages.diensts.adminPage.driverPscheinWarning', { count: info.monthsLeft ?? 0 }) as string,
        expired: false,
        warning: true,
      };
    }

    return { cls: '', title: undefined, expired: false, warning: false };
  };

  // 🔎 Decor vacaciones+baja por persona (tooltip SOLO en iconos; fechas DD/MM; FULL si está)
  const getPersonLeaveDecor = (person: any) => {
    const id: string | undefined = typeof person === 'object' && person ? person._id : person;
    const vf = id ? vacationFlags[id] : undefined;
    const sf = id ? sickFlags[id] : undefined;

    const hasVac = !!vf?.hasVacationInRange;
    const hasSick = !!sf?.hasSickInRange;

    // Vacaciones tooltip
    const vacFromFull = vf?.vacationStartFull;
    const vacToFull = vf?.vacationUntilFull;
    const vacTitle = hasVac
      ? (vacFromFull && vacToFull
        ? `🏖️ ${t('pages.diensts.weekModals.vacations', 'Vacaciones')}: ${fmtDDMM(vacFromFull)} → ${fmtDDMM(vacToFull)}`
        : `🏖️ ${t('pages.diensts.weekModals.vacations', 'Vacaciones')}`)
      : undefined;

    // Bajas tooltip
    const sickFromFull = sf?.sickStartFull || sf?.sickStartInRange;
    const sickToFull = sf?.sickUntilFull || sf?.sickUntilInRange;
    const sickTitle = hasSick
      ? (sickFromFull && sickToFull
        ? `🤒 ${t('pages.sick.tooltip.full', 'Baja médica')}: ${fmtDDMM(sickFromFull)} → ${fmtDDMM(sickToFull)}`
        : `🤒 ${t('pages.sick.tooltip.full', 'Baja médica')}`)
      : undefined;

    return {
      dimCls: (hasVac || hasSick) ? 'text-slate-400' : '',
      vacTitle,
      sickTitle,
      showVac: hasVac,
      showSick: hasSick,
    };
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t('pages.adminTeams.title', 'Equipos (driver + medic)')}
          </h1>
          <p className="text-slate-600">
            {t('pages.adminTeams.subtitle', 'Crea y gestiona parejas fijas.')}
          </p>
        </div>

        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
        >
          ➕ {t('pages.adminTeams.createBtn', 'Nuevo equipo')}
        </button>
      </div>

      {loading && (
        <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
          {t('common.loading', 'Cargando...')}
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl bg-rose-50 text-rose-700 ring-1 ring-rose-200 p-4">
          {error}
        </div>
      )}

      {!loading && !error && teams.length === 0 && (
        <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200 text-slate-600">
          {t('pages.adminTeams.empty', 'Todavía no hay equipos creados.')}
        </div>
      )}

      {!loading && !error && teams.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {teams.map((team) => {
            // P-Schein conductor
            const {
              cls: driverPscheinCls,
              title: driverPscheinTitle,
              expired: driverExpired,
              warning: driverWarning,
            } = getDriverDecor(team);

            // Vacaciones / Baja por persona (semana FULL tooltip)
            const driverLeave = getPersonLeaveDecor(team.driver);
            const medicLeave = getPersonLeaveDecor(team.medic);

            // Rotación del equipo
            const rotationMode = team.rotationMode ?? 'rotating';
            const rotationLabel =
              rotationMode === 'fixed'
                ? t(
                  'pages.adminTeams.rotation.fixedShort',
                  `Dienst fijo nº ${team.fixedDienstNumber ?? '—'}`
                )
                : rotationMode === 'none'
                  ? t(
                    'pages.adminTeams.rotation.noneShort',
                    'Sin rotación especial (manual)'
                  )
                  : t(
                    'pages.adminTeams.rotation.rotatingShort',
                    'Rotación normal (sigue la rotación de Dienst)'
                  );

            // 🚑 Etiqueta amigable para la ambulancia fija del equipo
            const teamAmbulanceLabel = team.ambulanceId
              ? (() => {
                const num = team.ambulanceId.ambulanceNumber || '—';
                const plate = team.ambulanceId.licensePlate || '';
                // Ej: "A-12 (B-AB 1234)" o solo "A-12"
                return plate ? `${num} (${plate})` : num;
              })()
              : t(
                'pages.adminTeams.noFixedAmbulance',
                'Ninguna (sin ambulancia fija)'
              );


            return (
              <div
                key={team._id}
                className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 shadow-sm hover:shadow-md transition-shadow"
              >
                <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                  {t('pages.adminTeams.team', 'Equipo')}
                </p>

                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm leading-snug">
                    {/* 🚗 Conductor */}
                    <p>
                      <span className={`font-medium ${driverPscheinCls} ${driverLeave.dimCls}`}>
                        {(team.driver?.lastName || '—') + ', ' + (team.driver?.name || '—')}
                        {/* 🏖️ Vacaciones (icono con tooltip propio) */}
                        {driverLeave.showVac && (
                          <span title={driverLeave.vacTitle} className="cursor-help ml-1 align-middle text-slate-400">
                            🏖️
                          </span>
                        )}
                        {/* 🤒 Baja (icono con tooltip propio) */}
                        {driverLeave.showSick && (
                          <span title={driverLeave.sickTitle} className="cursor-help ml-1 align-middle text-slate-500">
                            🤒
                          </span>
                        )}
                        {/* 🚫 P-Schein caducado */}
                        {driverExpired && (
                          <span
                            title={driverPscheinTitle || t('pages.diensts.adminPage.driverPscheinExpired', 'P-Schein caducado, no puede conducir')}
                            className="cursor-help ml-1 align-middle"
                          >
                            🚫
                          </span>
                        )}
                        {/* ⚠️ P-Schein por caducar */}
                        {!driverExpired && driverWarning && (
                          <span
                            title={driverPscheinTitle}
                            className="cursor-help ml-1 align-middle"
                          >
                            ⚠️
                          </span>
                        )}

                      </span>
                    </p>

                    <p className="text-slate-400">/</p>

                    {/* 🧑‍⚕️ Sanitario */}
                    <p>
                      <span className={`font-medium ${getPersonLeaveDecor(team.medic).dimCls}`}>
                        {(team.medic?.lastName || '—') + ', ' + (team.medic?.name || '—')}
                        {/* 🏖️ vacaciones */}
                        {medicLeave.showVac && (
                          <span title={medicLeave.vacTitle} className="cursor-help ml-1 align-middle text-slate-400">
                            🏖️
                          </span>
                        )}
                        {/* 🤒 baja */}
                        {medicLeave.showSick && (
                          <span title={medicLeave.sickTitle} className="cursor-help ml-1 align-middle text-slate-500">
                            🤒
                          </span>
                        )}
                      </span>
                    </p>

                    {/* 🚑 Ambulancia fija del equipo */}
                    <p
                      className={`mt-1 text-xs ${team.ambulanceId ? 'text-slate-500' : 'text-slate-400 italic'
                        }`}
                    >
                      🚑 {t('pages.adminTeams.teamAmbulance', 'Ambulancia fija')}: {teamAmbulanceLabel}
                    </p>

                    {/* 🔁 Info de rotación del equipo */}
                    <p className="mt-1 text-xs text-slate-500">
                      {(() => {
                        const mode = team.rotationMode || 'rotating';

                        if (mode === 'fixed') {
                          const num = team.fixedDienstNumber;
                          return num
                            ? t(
                              'pages.adminTeams.rotation.badgeFixedWithNum',
                              'Rotación: Dienst fijo #{num}'
                            ).replace('{num}', String(num))
                            : t(
                              'pages.adminTeams.rotation.badgeFixed',
                              'Rotación: Dienst fijo (número sin definir)'
                            );
                        }

                        if (mode === 'none') {
                          return t(
                            'pages.adminTeams.rotation.badgeNone',
                            'Rotación: sin rotación especial (manual)'
                          );
                        }

                        // 'rotating' o undefined → rotación normal
                        return t(
                          'pages.adminTeams.rotation.badgeRotating',
                          'Rotación: normal (sigue la rotación general de Dienst)'
                        );
                      })()}
                    </p>


                  </div>

                  {/* Rotación resumen corta en lateral */}
                  <p className="mt-2 text-[11px] text-slate-500">
                    🔁 {rotationLabel}
                  </p>

                  <button
                    onClick={() => handleDelete(team._id)}
                    className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-rose-700 focus:outline-none focus:ring-4 focus:ring-rose-100"
                  >
                    {t('common.delete', 'Eliminar')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <TeamCreateModal
          isOpen={showCreate}
          onClose={() => setShowCreate(false)}
          onConfirm={handleCreate}
        />
      )}
    </div>
  );
}
