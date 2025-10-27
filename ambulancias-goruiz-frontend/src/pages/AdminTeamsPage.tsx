// frontend/src/pages/AdminTeamsPage.tsx
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { getTeams, createTeam, deleteTeam } from '../api/teams';
import type { Team } from '../api/teams';
import TeamCreateModal from '../components/teams/TeamCreateModal';
import { toastT } from '../utils/toast';
import { getPscheinInfo } from '../utils/pscheinUtils';
import { getVacationFlagsInRange } from '../api/vacation';

export default function AdminTeamsPage() {
  const { token } = useAuth();
  const { t } = useTranslation();

  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // 🏖️  Flags semanales por usuario
  type VacFlag = {
    hasVacationInRange: boolean;
    vacationStartInRange?: string; // 'YYYY-MM-DD' (dentro de la semana)
    vacationUntilInRange?: string; // 'YYYY-MM-DD' (dentro de la semana)
  };
  const [vacationFlags, setVacationFlags] = useState<Record<string, VacFlag>>({});
  

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

  const fmtDDMM = (iso?: string) => {
    if (!iso) return '';
    const [, mm, dd] = iso.split('-');
    return `${dd}/${mm}`;
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

 // 🏖️  Cargar flags semanales para todos los usuarios listados en equipos
useEffect(() => {
  if (!token || teams.length === 0) {
    setVacationFlags({});
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
    return;
  }

  const { weekStartISO, weekEndISO } = getBerlinWeekRangeISO();
  let cancelled = false;

  (async () => {
    try {
      const flags = await getVacationFlagsInRange(token, {
        userIds,
        fromISO: weekStartISO,
        toISO: weekEndISO,
      });
      if (!cancelled) setVacationFlags(flags);
    } catch (e) {
      console.error('❌ Error al cargar flags de vacaciones (semanal) en AdminTeamsPage:', e);
      if (!cancelled) setVacationFlags({});
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
      title: t('pages.diensts.adminPage.driverPscheinExpired') as string,
      expired: true,
      warning: false,
    };
  }

  if (info.status === 'warning') {
    return {
      cls: 'text-amber-600 font-medium',
      title: t('pages.diensts.adminPage.driverPscheinWarning', { months: info.monthsLeft ?? 0 }) as string,
      expired: false,
      warning: true,
    };
  }

  return { cls: '', title: undefined, expired: false, warning: false };
};


  // 🔎 Vacaciones (semanal o “hoy” heredado del backend)
  const getVacationPersonDecor = (person: any) => {
    const id: string | undefined = typeof person === 'object' && person ? person._id : person;
    const weekly = id ? vacationFlags[id] : undefined;
    const hasWeek = !!weekly?.hasVacationInRange;

    // Compat “hoy” (backend) — no lo quitamos
    const hasToday = !!person?.isOnVacation;

    const has = hasWeek || hasToday;

    let title: string | undefined;
    if (hasWeek) {
      const from = fmtDDMM(weekly?.vacationStartInRange);
      const to = fmtDDMM(weekly?.vacationUntilInRange);
      title = from && to
        ? `🏖️  ${t('pages.diensts.weekModals.vacations', 'Vacaciones')}: ${from} → ${to}`
        : `🏖️  ${t('pages.diensts.weekModals.vacations', 'Vacaciones')}`;
    } else if (hasToday) {
      title = `🏖️  ${t('pages.diensts.weekModals.vacations', 'Vacaciones')}`;
    }

    return {
      hasVacation: has,
      cls: has ? 'text-slate-400' : '',
      icon: has ? ' 🏖️ ' : '',
      title,
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

  // Vacaciones por persona (semana/hoy)
  const driverVac = getVacationPersonDecor(team.driver);
  const medicVac = getVacationPersonDecor(team.medic);

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
            <span className={`font-medium ${driverPscheinCls} ${driverVac.cls}`}>
              {(team.driver?.lastName || '—') + ', ' + (team.driver?.name || '—')}

              {/* 🏖️  vacaciones (icono con tooltip propio) */}
              {driverVac.icon && (
                <span title={driverVac.title} className="cursor-help">
                  {driverVac.icon}
                </span>
              )}

              {/* 🚫 P-Schein caducado (icono con tooltip propio) */}
              {driverExpired && (
                <span
                  title={driverPscheinTitle || t('pages.diensts.adminPage.driverPscheinExpired', 'P-Schein caducado, no puede conducir')}
                  className="cursor-help"
                >
                  {' 🚫'}
                </span>
              )}

              {/* ⚠️ P-Schein caduca pronto (icono con tooltip propio) */}
              {!driverExpired && driverWarning && (
                <span
                  title={driverPscheinTitle || t('pages.diensts.adminPage.driverPscheinWarning', 'P-Schein caduca pronto')}
                  className="cursor-help"
                >
                  {' ⚠️'}
                </span>
              )}
            </span>
          </p>

          <p className="text-slate-400">/</p>

          {/* 🧑‍⚕️ Sanitario */}
          <p>
            <span className={`font-medium ${medicVac.cls}`}>
              {(team.medic?.lastName || '—') + ', ' + (team.medic?.name || '—')}

              {/* 🏖️ vacaciones (icono con tooltip propio) */}
              {medicVac.icon && (
                <span title={medicVac.title} className="cursor-help">
                  {medicVac.icon}
                </span>
              )}
            </span>
          </p>
        </div>

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
