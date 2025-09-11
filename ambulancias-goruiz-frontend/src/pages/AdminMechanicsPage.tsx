// frontend/src/pages/AdminMechanicsPage.tsx

import { useEffect, useState } from "react";
import { getAllIssueReports } from "../api/workdaySummary";
import type { WorkdayIssue } from "../types/workdayIssue";
import { useAuth } from "../hooks/useAuth";
import { toastT } from "../utils/toast";
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
        toastT.error(["toasts.mechanics.loadError"]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-6">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 mb-4 text-center">
            {t("pages.mechanics.adminPage.title")}
          </h1>

          {loading ? (
            <p className="text-sm text-slate-600">{t("pages.mechanics.adminPage.loading")}</p>
          ) : issues.length === 0 ? (
            <p className="text-sm text-slate-600">{t("pages.mechanics.adminPage.empty")}</p>
          ) : (
            <ul className="space-y-4">
              {issues.map((issue) => {
                const amb = ambulances.find((a) => a._id === issue.ambulanceId);

                return (
                  <li
                    key={issue._id}
                    className="rounded-xl ring-1 ring-slate-200 bg-white p-5 hover:shadow-sm hover:ring-slate-300 transition"
                  >
                    {/* Timestamp */}
                    <div className="mb-3">
                      <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 px-2.5 py-1 text-xs font-medium ring-1 ring-slate-200">
                        📅 {new Date(issue.timestamp).toLocaleString()}
                      </span>
                    </div>

                    {/* Dos bloques alineados: izquierda (Ambulancia), derecha (Equipo) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      {/* Bloque IZQUIERDA: Ambulancia */}
                      <div className="rounded-lg ring-1 ring-slate-200 p-3">
                        {amb ? (
                          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                            {/* Fila 1: Ambulancia | KM finales */}
                            <div className="truncate">
                              <span className="font-semibold text-slate-800">
                                {t("pages.mechanics.adminPage.labels.ambulance")}
                              </span>{" "}
                              {amb.ambulanceNumber}
                            </div>
                            <div className="truncate">
                              <span className="font-semibold text-slate-800">
                                {t("pages.mechanics.adminPage.labels.finalKm")}
                              </span>{" "}
                              {issue.finalKm}
                            </div>

                            {/* Fila 2: Modelo | Matrícula */}
                            <div className="truncate">
                              <span className="font-semibold text-slate-800">
                                {t("pages.mechanics.adminPage.labels.model")}
                              </span>{" "}
                              {amb.brand} {amb.modelName}
                            </div>
                            <div className="truncate">
                              <span className="font-semibold text-slate-800">
                                {t("pages.mechanics.adminPage.labels.numberPlate")}
                              </span>{" "}
                              {amb.licensePlate}
                            </div>
                          </div>
                        ) : (
                          <div className="text-slate-700">
                            {t("pages.mechanics.adminPage.ambulanceFallback", {
                              number: issue.ambulanceNumber,
                              id: issue.ambulanceId,
                            })}
                            <div className="mt-1">
                              <span className="font-semibold text-slate-800">
                                {t("pages.mechanics.adminPage.labels.finalKm")}
                              </span>{" "}
                              {issue.finalKm}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Bloque DERECHA: Equipo */}
                      <div className="rounded-lg ring-1 ring-slate-200 p-3 flex flex-col items-center justify-center text-center">
                        <span className="font-semibold text-slate-800 mb-1">
                          {t("pages.mechanics.adminPage.labels.team")}
                        </span>
                        <div className="whitespace-pre-line leading-tight text-slate-700">
                          {issue.team.split("+").map((member, idx) => (
                            <p key={idx}>{member.trim()}</p>
                          ))}
                        </div>
                      </div>

                    </div>

                    {/* Bloque de avería */}
                    <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3">
                      <p className="text-rose-800 text-sm whitespace-pre-line">
                        <span className="font-semibold">
                          {t("pages.mechanics.adminPage.labels.issue")}{" "}
                        </span>
                        {issue.issueText}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminMechanicsPage;
