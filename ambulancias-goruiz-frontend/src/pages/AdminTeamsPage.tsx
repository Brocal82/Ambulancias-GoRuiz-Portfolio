// frontend/src/pages/AdminTeamsPage.tsx
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { getTeams, createTeam, deleteTeam } from '../api/teams';
import type { Team } from '../api/teams';
import TeamCreateModal from '../components/teams/TeamCreateModal';
import { toastT } from '../utils/toast';

export default function AdminTeamsPage() {
  const { token } = useAuth();
  const { t } = useTranslation();

  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

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

const handleCreate = async (payload: { driver: string; medic: string }) => {
  if (!token) return;
  try {
    await createTeam(payload, token);
    toastT.success(['pages.adminTeams.created']); // ✅ solo la clave
    await load();
  } catch (e: any) {
    console.error(e);
    toastT.error([e?.response?.data?.message || 'pages.adminTeams.createError']); // ✅ 1 sola entrada
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
    toastT.success(['pages.adminTeams.deleted']); // ✅ solo la clave
    await load();
  } catch (e: any) {
    console.error(e);
    toastT.error([e?.response?.data?.message || 'pages.adminTeams.deleteError']); // ✅ 1 sola entrada
  }
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
          ➕ {t('pages.adminTeams.newTeam', 'Nuevo equipo')}
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
          {teams.map((team) => (
            <div
              key={team._id}
              className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 shadow-sm"
            >
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                {t('pages.adminTeams.team', 'Equipo')}
              </p>

              <div className="flex items-center justify-between gap-3">
                <div className="text-sm">
                  <p>
                    <span className="font-medium">
                      {(team.driver?.lastName || '—') + ', ' + (team.driver?.name || '—')}
                    </span>
                  </p>
                  <p className="text-slate-500">/</p>
                  <p>
                    <span className="font-medium">
                      {(team.medic?.lastName || '—') + ', ' + (team.medic?.name || '—')}
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
          ))}
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
