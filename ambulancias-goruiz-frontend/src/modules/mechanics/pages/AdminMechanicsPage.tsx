import { useEffect, useMemo, useState, useCallback } from "react";
import MechanicsYearGrid from "../components/MechanicsYearGrid";
import {
  buildIssueCountsByMonthForYear,
  filterIssuesByYearMonth,
} from "../utils/issuesByMonth";

import {
  getAllIssueReports,
  deleteIssueReport,
  markIssueSeen,
} from "../domain";
import type { WorkdayIssue } from "../domain/types";
import { useAuth } from "../../../hooks/useAuth";
import { toastT } from "../../../utils/toast";
import { getAllAmbulances } from "../../ambulances/domain/api";
import type { Ambulance } from "../../ambulances/domain/types";
import { useTranslation } from "react-i18next";
import { notifyAdminIssuesChanged } from "../hooks/useAdminIssuesOpenCount";
import { normalizeIssues } from "../utils/normalizeIssue";
import { sortIssuesByDateDesc } from "../utils/sortIssuesByDateDesc";
import DeleteIconButton from "../../../components/common/actions/DeleteIconButton";
import StatusBadge from "../../../components/common/StatusBadge";


const AdminMechanicsPage = () => {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [issues, setIssues] = useState<WorkdayIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // ¢â¦ Grid a±o/mes (igual patr³n que otros m³dulos)
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [openMonth, setOpenMonth] = useState<number | null>(null);




  const countsByMonth = useMemo(
    () => buildIssueCountsByMonthForYear(issues, year),
    [issues, year],
  );

  const monthIssues = useMemo(() => {
    if (openMonth === null) return [];
    const filtered = filterIssuesByYearMonth(issues, year, openMonth);
    return sortIssuesByDateDesc(filtered);
  }, [issues, year, openMonth]);


  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!token) return;

        const issuesData = await getAllIssueReports();
        setIssues(normalizeIssues(issuesData));


        const ambulancesData = await getAllAmbulances();
        setAmbulances(ambulancesData);
      } catch (err) {
        console.error("¢ Error al cargar reportes o ambulancias:", err);
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
      "¿Seguro que quieres eliminar este reporte? Esta acci³n no se puede deshacer.",
    );
    if (!confirmed) return;

    // UI optimista con rollback
    const prev = issues;
    setIssues((cur) => cur.filter((x) => x._id !== id));

    try {
      await deleteIssueReport(id);
      toastT.success(["toasts.mechanics.deleteSuccess"]);
      // Si se borra una no vista, el contador tambi©n baja. Emitimos evento por si acaso.
      notifyAdminIssuesChanged();
    } catch (err) {
      console.error("¢ Error al borrar reporte:", err);
      setIssues(prev); // rollback
      toastT.error(["toasts.mechanics.deleteError"]);
    }
  };

  const toggleExpand = useCallback(
    async (issue: WorkdayIssue) => {
      if (!token) return;

      // ¢â¦ Calculamos esto ANTES del setState (sin estado desfasado)
      const isCurrentlyExpanded = expanded.has(issue._id);
      const shouldMarkSeen = !isCurrentlyExpanded && issue.isSeen !== true;

      // Toggle UI
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(issue._id)) {
          next.delete(issue._id);
        } else {
          next.add(issue._id);
        }
        return next;
      });

      // Marcar como visto solo si se est¡ abriendo por primera vez y era no visto
      if (shouldMarkSeen) {
        try {
          const updated = await markIssueSeen(issue._id);

          setIssues((cur) =>
            cur.map((it) =>
              it._id === issue._id
                ? {
                  ...it,
                  isSeen: true,
                  seenAt: updated.seenAt ?? new Date().toISOString(),
                }
                : it,
            ),
          );

          notifyAdminIssuesChanged();
        } catch (err) {
          console.error("¢ Error al marcar aver­a como vista:", err);
        }
      }
    },
    [expanded, token],
  );



  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-6">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 mb-4 text-center">
            {t("pages.mechanics.adminPage.title")}
          </h1>

          {/* ¢â¦ Grid de meses (siempre visible) */}
          <div className="mb-5">
            <MechanicsYearGrid
              year={year}
              locale="es-ES"
              selectedMonth={openMonth}
              countsByMonth={countsByMonth}
              onSelectMonth={(m) => {
                // toggle: mismo mes cierra
                setOpenMonth((prev) => (prev === m ? null : m));
                // limpiamos expansiones al cambiar de mes (limpio y consistente)
                setExpanded(new Set());
              }}
              onPrevYear={() => {
                setYear((y) => y - 1);
                setOpenMonth(null);
                setExpanded(new Set());
              }}
              onNextYear={() => {
                setYear((y) => y + 1);
                setOpenMonth(null);
                setExpanded(new Set());
              }}
              onThisYear={() => {
                const now = new Date();
                setYear(now.getFullYear());
                setOpenMonth(null);
                setExpanded(new Set());
              }}
            />
          </div>

          {/* ¢â¦ Estado de carga / vac­o (sin ocultar el grid) */}
          {loading ? (
            <p className="text-sm text-slate-600">
              {t("pages.mechanics.adminPage.loading")}
            </p>
          ) : issues.length === 0 ? (
            <p className="text-sm text-slate-600">
              {t("pages.mechanics.adminPage.empty")}
            </p>
          ) : null}

          {/* ¢â¦ Lista SOLO si hay un mes abierto */}
          {openMonth !== null && !loading && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              {monthIssues.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {t(
                    "pages.messages.monthGrid.emptyMonth",
                    "No hay reportes en este mes.",
                  )}
                </p>
              ) : (
                <ul className="space-y-3">
                  {monthIssues.map((issue) => {
                    const isOpen = expanded.has(issue._id);
                    const amb = ambulances.find(
                      (a) => a._id === issue.ambulanceId,
                    );
                    const unseen = issue.isSeen !== true;

                    const btnId = `issue-toggle-${issue._id}`;
                    const panelId = `issue-panel-${issue._id}`;

                    return (
                      <li
                        key={issue._id}
                        className={[
                          "relative rounded-xl ring-1 p-0 bg-white transition overflow-hidden",
                          isOpen
                            ? "ring-slate-300 shadow-sm"
                            : "ring-slate-200 hover:ring-slate-300",
                        ].join(" ")}
                      >
                        <button
                          id={btnId}
                          onClick={() => toggleExpand(issue)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left"
                          aria-expanded={isOpen}
                          aria-controls={panelId}
                          type="button"
                        >
                          <span
                            className={[
                              "inline-block w-2.5 h-2.5 rounded-full",
                              unseen ? "bg-red-500" : "bg-slate-300",
                            ].join(" ")}
                            aria-hidden="true"
                            title={
                              unseen
                                ? (t(
                                  "pages.mechanics.adminPage.badges.unseen",
                                ) as string)
                                : (t(
                                  "pages.mechanics.adminPage.badges.seen",
                                ) as string)
                            }
                          />
                          <span className="font-medium text-slate-800">
                            {t("pages.mechanics.adminPage.labels.ambulance")} {issue.ambulanceNumber}
                          </span>
                          <span className="ml-auto text-sm text-slate-600">
                            {new Date(issue.timestamp).toLocaleString()}
                          </span>

                          <span
                            className={[
                              "ml-2 inline-flex items-center justify-center w-6 h-6 rounded-full text-base transition-transform",
                              isOpen ? "rotate-180" : "rotate-0",
                            ].join(" ")}
                            aria-hidden="true"
                          >
                            ▾                          </span>
                        </button>

                        <div
                          id={panelId}
                          role="region"
                          aria-labelledby={btnId}
                          hidden={!isOpen}
                          className="px-5 pb-5 pt-1 border-t border-slate-100"
                        >
                          <div className="flex items-center justify-end mb-3">
                            <DeleteIconButton
                              onClick={() => handleDelete(issue._id)}
                              title={t("pages.mechanics.adminPage.delete") as string}
                              aria-label={t("pages.mechanics.adminPage.delete") as string}
                            />
                          </div>


                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            <StatusBadge
                              tone="slate"
                              label={`${new Date(issue.timestamp).toLocaleString()}`}
                              className="px-2.5 py-1"
                            />

                            {issue.seenAt && (
                              <StatusBadge
                                tone="emerald"
                                label={`${t("pages.mechanics.adminPage.labels.seenAt")}: ${new Date(issue.seenAt).toLocaleString()}`}
                                className="px-2.5 py-1"
                              />
                            )}
                          </div>


                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
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
          )}

        </div>
      </div>
    </div>
  );
};

export default AdminMechanicsPage;
