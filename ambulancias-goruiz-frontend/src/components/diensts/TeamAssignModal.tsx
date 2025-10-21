import { useEffect, useState, useId } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getTeams, type Team } from '../../api/teams';
import { toastT } from '../../utils/toast';
import { useTranslation } from 'react-i18next';
import { getPscheinInfo } from '../../utils/pscheinUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (teamId: string) => Promise<void> | void;
}

export default function TeamAssignModal({ isOpen, onClose, onConfirm }: Props) {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [openList, setOpenList] = useState(false);
  const selectId = useId();

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

  if (!isOpen) return null;

  const selectedTeam = teams.find(t => t._id === selectedId) || null;

  const driverClass = (pschein?: string | null) => {
    if (!pschein) return '';
    const info = getPscheinInfo(pschein);
    if (info.status === 'expired') return 'text-red-600 font-medium';
    if (info.status === 'warning') return 'text-yellow-600 font-medium';
    return '';
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

          {/* Dropdown personalizado para poder colorear solo el nombre del conductor */}
          <div className="relative">
            <button
              id={selectId}
              type="button"
              className="w-full flex items-center justify-between rounded-xl border border-slate-300 ring-1 ring-slate-200 px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
              onClick={() => setOpenList(v => !v)}
              aria-haspopup="listbox"
              aria-expanded={openList}
            >
              <span className="truncate">
                {loading
                  ? t('common.loading')
                  : selectedTeam
                    ? (
                        <>
                          <span className={driverClass((selectedTeam.driver as any)?.pscheinExpiry)}>
                            {(selectedTeam.driver?.lastName || '') + ', ' + (selectedTeam.driver?.name || '')}
                          </span>
                          {' / '}
                          <span>
                            {(selectedTeam.medic?.lastName || '') + ', ' + (selectedTeam.medic?.name || '')}
                          </span>
                        </>
                      )
                    : t('common.select')}
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
                className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg ring-1 ring-slate-200"
              >
                {teams.length === 0 && (
                  <div className="px-3 py-2 text-sm text-slate-500">
                    {t('pages.adminTeams.empty', 'Todavía no hay equipos creados.')}
                  </div>
                )}

                {teams.map((tItem) => (
                  <button
                    key={tItem._id}
                    role="option"
                    aria-selected={selectedId === tItem._id}
                    onClick={() => {
                      setSelectedId(tItem._id);
                      setOpenList(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 focus:bg-slate-50 focus:outline-none ${
                      selectedId === tItem._id ? 'bg-slate-50' : ''
                    }`}
                  >
                    <span className={driverClass((tItem.driver as any)?.pscheinExpiry)}>
                      {(tItem.driver?.lastName || '') + ', ' + (tItem.driver?.name || '')}
                    </span>
                    <span className="text-slate-500"> / </span>
                    <span>
                      {(tItem.medic?.lastName || '') + ', ' + (tItem.medic?.name || '')}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
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
