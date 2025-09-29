import { useEffect, useMemo, useState, useCallback } from "react";
import { getAllIssueReports, deleteIssueReport, markIssueSeen } from "../api/workdaySummary";
import type { WorkdayIssue } from "../types/workdayIssue";
import { useAuth } from "../hooks/useAuth";
import { toastT } from "../utils/toast";
import { getAllAmbulances } from "../api/ambulances";
import type { Ambulance } from "../types/ambulance";
import { useTranslation } from "react-i18next";
import { notifyAdminIssuesChanged } from "../hooks/useAdminIssuesOpenCount";

const AdminMechanicsPage = () => {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [issues, setIssues] = useState<WorkdayIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const sortedIssues = useMemo(
    () =>
      [...issues].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ),
    [issues]
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!token) return;

        const issuesData = await getAllIssueReports(token);
        // Asegura defaults si el backend aún devuelve sin campos
        const normalized = issuesData.map(i => ({
          ...i,
          isSeen: i.isSeen ?? false,
          seenAt: i.seenAt ?? null,
        }));
        setIssues(normalized);

        const ambulancesData = await getAllAmbulances(token);
        setAmbulances(ambulancesData);
      } catch (err) {
        console.error("❌ Error al cargar reportes o ambulancias:", err);
        toastT.error(["toasts.mechanics.loadError"]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  const handleDelete = async (id: string) => {
    if (!token) return;

    const confirmed = window.confirm(
      (t("pages.mechanics.adminPage.confirmDelete") as string) ||
      "¿Seguro que quieres eliminar este reporte? Esta acción no se puede deshacer."
    );
    if (!confirmed) return;

    // UI optimista con rollback
    const prev = issues;
    setIssues((cur) => cur.filter((x) => x._id !== id));

    try {
      await deleteIssueReport(token, id);
      toastT.success(["toasts.mechanics.deleteSuccess"]);
      // Si se borra una no vista, el contador también baja. Emitimos evento por si acaso.
      notifyAdminIssuesChanged();
    } catch (err) {
      console.error("❌ Error al borrar reporte:", err);
      setIssues(prev); // rollback
      toastT.error(["toasts.mechanics.deleteError"]);
    }
  };

  const toggleExpand = useCallback(async (issue: WorkdayIssue) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(issue._id)) {
        next.delete(issue._id);
      } else {
        next.add(issue._id);
      }
      return next;
    });

    // Si se expande por primera vez y estaba no vista → marcar como vista
    const wasAlreadyExpanded = expanded.has(issue._id);
    if (!wasAlreadyExpanded && issue.isSeen !== true && token) {
      try {
        const updated = await markIssueSeen(token, issue._id);
        // Actualiza estado local
        setIssues(cur =>
          cur.map(it => (it._id === issue._id ? { ...it, isSeen: true, seenAt: updated.seenAt ?? new Date().toISOString() } : it))
        );
        // Notificar al Dashboard para refrescar badge
        notifyAdminIssuesChanged();
      } catch (err) {
        console.error("❌ Error al marcar avería como vista:", err);
        // Sin toast intrusivo; se reintentará al volver a expandir si sigue no vista.
      }
    }
  }, [expanded, token]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-6">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 mb-4 text-center">
            {t("pages.mechanics.adminPage.title")}
          </h1>

          {loading ? (
            <p className="text-sm text-slate-600">{t("pages.mechanics.adminPage.loading")}</p>
          ) : sortedIssues.length === 0 ? (
            <p className="text-sm text-slate-600">{t("pages.mechanics.adminPage.empty")}</p>
          ) : (
            <ul className="space-y-3">
              {sortedIssues.map((issue) => {
                const isOpen = expanded.has(issue._id);
                const amb = ambulances.find((a) => a._id === issue.ambulanceId);
                const unseen = issue.isSeen !== true;

                // IDs únicos para vincular botón y panel
                const btnId = `issue-toggle-${issue._id}`;
                const panelId = `issue-panel-${issue._id}`;

                return (
                  <li
                    key={issue._id}
                    className={[
                      "relative rounded-xl ring-1 p-0 bg-white transition overflow-hidden",
                      isOpen ? "ring-slate-300 shadow-sm" : "ring-slate-200 hover:ring-slate-300",
                    ].join(" ")}
                  >
                    {/* Header clickable (botón de disclosure) */}
                    <button
                      id={btnId}
                      onClick={() => toggleExpand(issue)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left"
                      aria-expanded={isOpen}               // ← boolean real  axe-linter-disable-next-line aria-valid-attr-value
                      aria-controls={panelId}              // ← el panel existe siempre
                      type="button"
                    >
                      {/* Dot rojo si NO vista */}
                      <span
                        className={[
                          "inline-block w-2.5 h-2.5 rounded-full",
                          unseen ? "bg-red-500" : "bg-slate-300",
                        ].join(" ")}
                        aria-hidden="true"
                        title={
                          unseen
                            ? (t("pages.mechanics.adminPage.badges.unseen") as string)
                            : (t("pages.mechanics.adminPage.badges.seen") as string)
                        }
                      />
                      <span className="text-sm text-slate-600">
                        {new Date(issue.timestamp).toLocaleString()}
                      </span>
                      <span className="ml-auto font-medium text-slate-800">
                        {t("pages.mechanics.adminPage.labels.ambulance")} {issue.ambulanceNumber}
                      </span>
                      <span
                        className={[
                          "ml-2 inline-flex items-center justify-center w-6 h-6 rounded-full text-base transition-transform",
                          isOpen ? "rotate-180" : "rotate-0",
                        ].join(" ")}
                        aria-hidden="true"
                      >
                        ▾
                      </span>
                    </button>

                    {/* Panel expandible: SIEMPRE en el DOM, se oculta con hidden */}
                    <div
                      id={panelId}
                      role="region"
                      aria-labelledby={btnId}
                      hidden={!isOpen}
                      className="px-5 pb-5 pt-1 border-t border-slate-100"
                    >
                      {/* Acciones (borrar) */}
                      <div className="flex items-center justify-end mb-3">
                        <button
                          onClick={() => handleDelete(issue._id)}
                          className="text-rose-600 hover:text-rose-700 font-bold text-lg leading-none transition"
                          title={t("pages.mechanics.adminPage.delete") as string}
                          aria-label={t("pages.mechanics.adminPage.delete") as string}
                          type="button"
                        >
                          ×
                        </button>
                      </div>


                      {/* Meta */}
                      <div className="mb-3">
                        <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 px-2.5 py-1 text-xs font-medium ring-1 ring-slate-200">
                          📅 {new Date(issue.timestamp).toLocaleString()}
                        </span>
                        {issue.seenAt && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 px-2.5 py-1 text-xs font-medium ring-1 ring-emerald-200">
                            {t("pages.mechanics.adminPage.labels.seenAt")}:{" "}
                            {new Date(issue.seenAt).toLocaleString()}
                          </span>
                        )}
                      </div>

                      {/* Dos columnas: Ambulancia / Equipo */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        {/* IZQUIERDA: Ambulancia */}
                        <div className="rounded-lg ring-1 ring-slate-200 p-3">
                          {amb ? (
                            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
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

                        {/* DERECHA: Equipo */}
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

                      {/* Texto de avería */}
                      <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3">
                        <p className="text-rose-800 text-sm whitespace-pre-line">
                          <span className="font-semibold">
                            {t("pages.mechanics.adminPage.labels.issue")}{" "}
                          </span>
                          {issue.issueText}
                        </p>
                      </div>
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
