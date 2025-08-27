// frontend/src/pages/AdminMechanicsPage.tsx

import { useEffect, useState } from "react";
import { getAllIssueReports } from "../api/workdaySummary";
import type { WorkdayIssue } from "../types/workdayIssue";
import { useAuth } from "../hooks/useAuth";
import { toast } from "react-toastify";
import { getAllAmbulances } from "../api/ambulances";
import type { Ambulance } from "../types/ambulance";
import { formatYYYYMMDDToDDMMYYYY } from "../utils/timeUtils";
import { useTranslation } from "react-i18next";

const AdminMechanicsPage = () => {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [issues, setIssues] = useState<WorkdayIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!token) return;

        const issuesData = await getAllIssueReports(token);
        const sortedIssues = [...issuesData].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setIssues(sortedIssues);

        const ambulancesData = await getAllAmbulances(token);
        setAmbulances(ambulancesData);

        console.log("🩺 Ambulancias cargadas:", ambulancesData);
      } catch (err) {
        console.error("❌ Error al cargar reportes o ambulancias:", err);
        // Dejamos toasts para más tarde (i18n de toasts al final)
        toast.error("❌ Error al cargar reportes o ambulancias.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">
        {t("pages.mechanics.adminPage.title")}
      </h1>

      {loading ? (
        <p>{t("pages.mechanics.adminPage.loading")}</p>
      ) : issues.length === 0 ? (
        <p className="text-gray-600">{t("pages.mechanics.adminPage.empty")}</p>
      ) : (
        <ul className="space-y-6">
          {issues.map((issue) => (
            <li
              key={issue._id}
              className="bg-white border border-gray-200 p-5 rounded-lg shadow hover:shadow-md transition"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">
                  {t("pages.mechanics.adminPage.dienst", { num: issue.dienstNumber })}
                </span>
                <span className="text-sm text-gray-600">
                  {new Date(issue.timestamp).toLocaleString()}
                </span>
              </div>

              <p className="text-sm text-gray-700">
                <strong>{t("pages.mechanics.adminPage.labels.date")} </strong>
                {formatYYYYMMDDToDDMMYYYY(issue.date)}
              </p>
              <p className="text-sm text-gray-700">
                <strong>{t("pages.mechanics.adminPage.labels.time")} </strong>
                {issue.startTime} – {issue.endTime}
              </p>
              <p className="text-sm text-gray-700">
                <strong>{t("pages.mechanics.adminPage.labels.team")} </strong>
                {issue.team}
              </p>
              <p className="text-sm text-gray-700">
                <strong>{t("pages.mechanics.adminPage.labels.ambulance")} </strong>
                {(() => {
                  console.log("🔍 Buscando ID:", issue.ambulanceId);
                  const amb = ambulances.find((a) => a._id === issue.ambulanceId);
                  return amb
                    ? `${amb.ambulanceNumber} — ${amb.brand} ${amb.modelName} (Matrícula: ${amb.licensePlate})`
                    : t("pages.mechanics.adminPage.ambulanceFallback", {
                        number: issue.ambulanceNumber,
                        id: issue.ambulanceId,
                      });
                })()}
              </p>

              <p className="text-sm text-gray-700">
                <strong>{t("pages.mechanics.adminPage.labels.finalKm")} </strong>
                {issue.finalKm}
              </p>

              <div className="mt-3 bg-red-50 border-l-4 border-red-400 p-3 rounded">
                <p className="text-red-800 text-sm whitespace-pre-line">
                  <strong>{t("pages.mechanics.adminPage.labels.issue")} </strong>
                  {issue.issueText}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AdminMechanicsPage;
