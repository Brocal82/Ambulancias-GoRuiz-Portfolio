// src/pages/AdminUserPraemienTab.tsx
import { useEffect, useMemo, useState } from "react";
import { getMonthlyPraemienSummary } from "../api/praemien";
import { useAuth } from "../hooks/useAuth";
import WorkerPraemienHistory from "./WorkerPraemienHistory";
import { useTranslation } from "react-i18next";
import {
  getPraemieI18nKey,
  getPraemieLevelFromAverage,
} from "../utils/praemien/praemienLevels";

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
    if (averagePatients == null) return "";
    const level = getPraemieLevelFromAverage(averagePatients);
    return t(getPraemieI18nKey(level));
  }, [averagePatients, t]);

  if (loading) return <p>{t("pages.praemien.page.loading")}</p>;

  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm ring-1 ring-gray-200">
      <h2 className="text-lg font-bold text-gray-800 mb-4">
        {t("pages.praemien.adminUserTab.currentTitle")}
      </h2>

      {averagePatients != null ? (
        <p className="text-gray-700">
          {t("pages.praemien.adminUserTab.levelPrefix")}{" "}
          <span className="font-semibold text-blue-600">{levelLabel}</span>{" "}
          <span className="text-sm text-gray-500">
            (
            {t("pages.praemien.adminUserTab.average", {
              avg: averagePatients.toFixed(2),
            })}
            )
          </span>
        </p>
      ) : (
        <p className="text-gray-500">{t("pages.praemien.adminUserTab.noData")}</p>
      )}

      <div className="mt-8 border-t pt-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">
          {t("pages.praemien.history.title")}
        </h2>
        <WorkerPraemienHistory userId={userId} />
      </div>
    </div>
  );
};

export default AdminUserPraemienTab;
