// src/pages/AdminUserPraemienTab.tsx
import { useEffect, useMemo, useState } from "react";
import { getMonthlyPraemienSummary } from "../api/praemien";
import { useAuth } from "../hooks/useAuth";
import WorkerPraemienHistory from "./WorkerPraemienHistory";
import { useTranslation } from "react-i18next";

interface Props {
  userId: string;
}

const AdminUserPraemienTab = ({ userId }: Props) => {
  const { token } = useAuth();
  const { t } = useTranslation();

  const [averagePatients, setAveragePatients] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !userId) return;
    setLoading(true);

    getMonthlyPraemienSummary(token, userId)
      .then((data) => setAveragePatients(data.averagePatients))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, userId]);

  const levelLabel = useMemo(() => {
    if (averagePatients == null) return '';
    if (averagePatients >= 10) return t('pages.praemien.levels.10');
    if (averagePatients >= 9)  return t('pages.praemien.levels.9');
    if (averagePatients >= 8)  return t('pages.praemien.levels.8');
    if (averagePatients >= 7)  return t('pages.praemien.levels.7');
    return t('pages.praemien.levels.none');
  }, [averagePatients, t]);

  if (loading) return <p>{t('pages.praemien.page.loading')}</p>;

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">
        {t('pages.praemien.adminUserTab.currentTitle')}
      </h2>

      {averagePatients != null ? (
        <p>
          {t('pages.praemien.adminUserTab.levelPrefix')}{' '}
          <strong>{levelLabel}</strong>{' '}
          ({t('pages.praemien.adminUserTab.average', { avg: averagePatients.toFixed(2) })})
        </p>
      ) : (
        <p>{t('pages.praemien.adminUserTab.noData')}</p>
      )}

      <h2 className="text-xl font-semibold mt-8 mb-4">
        {t('pages.praemien.history.title')}
      </h2>

      <WorkerPraemienHistory userId={userId} />
    </div>
  );
};

export default AdminUserPraemienTab;

