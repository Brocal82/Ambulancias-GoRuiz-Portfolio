// src/pages/AdminUserVacationsTab.tsx
import { useEffect, useState } from 'react';
import type { IVacationRequest } from '../types/vacationRequest';
import { getVacationRequests, deleteVacationRequest } from '../api/vacation';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { toastT } from "../utils/toast";
import { formatISOToDDMMYYYY } from '../utils/timeUtils';

interface Props {
  userId: string;
}

const AdminUserVacationsTab = ({ userId }: Props) => {
  const { token } = useAuth();
  const { t } = useTranslation();

  const [vacations, setVacations] = useState<IVacationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token || !userId) return;

    const fetchVacations = async () => {
      setLoading(true);
      try {
        const allVacations = await getVacationRequests(token);
        const acceptedVacations = allVacations.filter(
          (v: IVacationRequest) => v.user._id === userId && v.status === 'accepted'
        );

        setVacations(acceptedVacations);
        setError('');
      } catch {
        setError(t('pages.vacations.adminUserTab.error'));
      } finally {
        setLoading(false);
      }
    };

    fetchVacations();
  }, [token, userId, t]);

  const handleDeleteVacation = async (id: string) => {
    if (!token) return;

    if (!window.confirm(t('pages.vacations.adminUserTab.confirmDelete'))) return;

    try {
      await deleteVacationRequest(token, id);
      setVacations(prev => prev.filter(v => v._id !== id));
      toastT.success(["toasts.vacations.deleted"]);
    } catch {
      toastT.error(["toasts.vacations.deleteError"]);
    }
  };

  const handleEditVacation = (id: string) => {
    toastT.info(["toasts.vacations.editPending", { id }]);
  };

  if (loading) return <p className="text-sm text-slate-600">{t('pages.vacations.adminUserTab.loading')}</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (vacations.length === 0) return <p className="text-sm text-slate-600">{t('pages.vacations.adminUserTab.empty')}</p>;

  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-4">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">
        {t('pages.vacations.adminUserTab.title')}
      </h3>

      <ul className="space-y-3">
        {vacations.map(v => (
          <li
            key={v._id}
            className="flex items-center justify-between rounded-xl ring-1 ring-slate-200 px-3 py-2 hover:bg-slate-50 transition"
          >
            <span className="text-sm text-slate-800">
              {formatISOToDDMMYYYY(v.startDate)} — {formatISOToDDMMYYYY(v.endDate)}
            </span>

            <div className="flex gap-2">
              <button
                className="inline-flex items-center rounded-xl bg-white px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-100"
                onClick={() => handleEditVacation(v._id)}
              >
                {t('pages.vacations.adminUserTab.actions.edit')}
              </button>
              <button
                className="inline-flex items-center rounded-xl bg-red-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-100"
                onClick={() => handleDeleteVacation(v._id)}
              >
                {t('pages.vacations.adminUserTab.actions.delete')}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AdminUserVacationsTab;
