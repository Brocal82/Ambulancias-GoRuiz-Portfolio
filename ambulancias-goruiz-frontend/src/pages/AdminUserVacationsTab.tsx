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

  if (loading) return <p>{t('pages.vacations.adminUserTab.loading')}</p>;
  if (error) return <p className="text-red-500">{error}</p>;
  if (vacations.length === 0) return <p>{t('pages.vacations.adminUserTab.empty')}</p>;

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">
        {t('pages.vacations.adminUserTab.title')}
      </h3>

      <ul className="list-disc pl-6 space-y-2">
        {vacations.map(v => (
          <li key={v._id} className="flex items-center justify-between">
            <span>
              {formatISOToDDMMYYYY(v.startDate)} - {formatISOToDDMMYYYY(v.endDate)}
            </span>
            <div className="space-x-2">
              <button
                className="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                onClick={() => handleEditVacation(v._id)}
              >
                {t('pages.vacations.adminUserTab.actions.edit')}
              </button>
              <button
                className="bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
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
