import { useEffect, useState, useId } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getTeams, type Team } from '../../api/teams';
import { toastT } from '../../utils/toast';
import { useTranslation } from 'react-i18next';

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
  const selectId = useId(); // Asegura un ID único para accesibilidad

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
        <h3 className="text-lg font-semibold text-slate-900 mb-3">
          {t('pages.diensts.assignTeamModal.title')}
        </h3>

        <div className="space-y-2">
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-slate-700"
          >
            {t('pages.diensts.assignTeamModal.select')}
          </label>
          <select
            id={selectId}
            name="team"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full rounded-xl border border-slate-300 ring-1 ring-slate-200 px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
            disabled={loading}
          >
            <option value="">
              {loading ? t('common.loading') : t('common.select')}
            </option>
            {teams.map((tItem) => (
              <option key={tItem._id} value={tItem._id}>
                {(tItem.driver?.lastName || '') + ', ' + (tItem.driver?.name || '')}
                {' / '}
                {(tItem.medic?.lastName || '') + ', ' + (tItem.medic?.name || '')}
              </option>
            ))}
          </select>
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
