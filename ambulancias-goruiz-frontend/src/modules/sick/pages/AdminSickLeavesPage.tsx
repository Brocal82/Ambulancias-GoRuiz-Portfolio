import { useMemo, useState } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { useTranslation } from "react-i18next";
import { toastT } from "../../../utils/toast";
import { buildImageUrl } from "../../../utils/apiOrigins";
import { displayFileNameFromUrl } from "../../../utils/fileName";
import {
  adminAcceptSickLeave,
  adminRejectSickLeave,
  type SickLeaveStatus,
} from "../domain";
import { getYearMonths, rangesOverlap } from "../../../utils/calendarMonthUtils";
import AdminSickMonthGrid from "../components/AdminSickMonthGrid";
import StatusBadge from "../../../components/common/StatusBadge";
import { sickLeaveTone } from "../utils/sickLeavesTone";
import { emitSickLeavesChanged } from "../utils/sickEvents";
import { useAdminSickLeavesSync } from "../hooks/useAdminSickLeavesSync";

function fmtISO(d?: string, locale?: string) {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(locale || "es");
}

export default function AdminSickLeavesPage() {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();

  const { allItems } = useAdminSickLeavesSync({ token });

  const [openDocsId, setOpenDocsId] = useState<string | null>(null);
  const nowYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(nowYear);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number | null>(
    null,
  );

  const decYear = () => {
    setSelectedMonthIndex(null);
    setSelectedYear((y) => y - 1);
  };
  const incYear = () => {
    setSelectedMonthIndex(null);
    setSelectedYear((y) => y + 1);
  };
  const goThisYear = () => {
    setSelectedMonthIndex(null);
    setSelectedYear(nowYear);
  };

  const months = useMemo(
    () => getYearMonths(selectedYear, i18n.language || "es", "Europe/Berlin"),
    [selectedYear, i18n.language],
  );

  const monthlyCounts = useMemo(() => {
    if (!allItems || allItems.length === 0) return Array(12).fill(0);
    return months.map(({ start, end }) => {
      return allItems.filter((sl) => {
        const s = new Date(sl.startDate);
        const e = new Date(sl.endDate || sl.startDate);
        return rangesOverlap(s, e, start, end);
      }).length;
    });
  }, [allItems, months]);

  const monthBorderPriority = useMemo(() => {
    return months.map(({ start, end }) => {
      let hasPending = false;
      let hasAccepted = false;
      let hasRejected = false;

      for (const sl of allItems) {
        const s = new Date(sl.startDate);
        const e = new Date(sl.endDate || sl.startDate);
        if (!rangesOverlap(s, e, start, end)) continue;

        if (sl.status === "pending") hasPending = true;
        else if (sl.status === "accepted") hasAccepted = true;
        else if (sl.status === "rejected") hasRejected = true;
      }

      if (hasPending) return "pending" as const;
      if (hasAccepted) return "accepted" as const;
      if (hasRejected) return "rejected" as const;
      return "none" as const;
    });
  }, [allItems, months]);

  const monthDetailToShow = useMemo(() => {
    if (selectedMonthIndex === null) return [];
    const { start, end } = months[selectedMonthIndex];
    return allItems.filter((sl) => {
      const s = new Date(sl.startDate);
      const e = new Date(sl.endDate || sl.startDate);
      return rangesOverlap(s, e, start, end);
    });
  }, [allItems, months, selectedMonthIndex]);

  const onAccept = async (id: string) => {
    if (!token) return;
    const ok = window.confirm(
      t(
        "pages.sick.admin.confirmAccept",
        "¿Aceptar esta baja y desasignar al trabajador en el rango?",
      ) as string,
    );
    if (!ok) return;
    try {
      await adminAcceptSickLeave(id);
      toastT.success(["pages.sick.admin.acceptOk"]);
      emitSickLeavesChanged();
    } catch (err: unknown) {
      console.error(err);
      toastT.apiError(err, ["pages.sick.admin.acceptErr"]);
    }
  };

  const onReject = async (id: string) => {
    if (!token) return;
    const ok = window.confirm(
      t("pages.sick.admin.confirmReject", "¿Rechazar esta baja?") as string,
    );
    if (!ok) return;
    try {
      await adminRejectSickLeave(id);
      toastT.success(["pages.sick.admin.rejectOk"]);
      emitSickLeavesChanged();
    } catch (err: unknown) {
      console.error(err);
      toastT.apiError(err, ["pages.sick.admin.rejectErr"]);
    }
  };


  const badge = (st: SickLeaveStatus) => (
    <StatusBadge tone={sickLeaveTone(st)} label={t(`pages.sick.status.${st}`, st)} />
  );



  // ✅ Estilos tabla estilo AdminVacations
  const tableClass =
    "min-w-full table-fixed text-sm shadow-sm ring-1 ring-slate-200 rounded-xl overflow-hidden text-center";
  const thClass = "px-3 py-2 text-xs font-medium uppercase tracking-wide";
  const trClass =
    "border-t border-slate-200 hover:bg-slate-50/70 transition-colors";

  // ✅ Botones estilo AdminVacations (emoji, redondos, hover con tint)
  const btnAcceptClass =
    "inline-flex items-center justify-center rounded-full px-2.5 py-1.5 text-sm shadow-sm hover:bg-emerald-100 focus:outline-none focus:ring-4 focus:ring-emerald-100 text-white";
  const btnRejectClass =
    "inline-flex items-center justify-center rounded-full px-2.5 py-1.5 text-sm shadow-sm hover:bg-rose-100 focus:outline-none focus:ring-4 focus:ring-rose-100 text-white";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6">
        {/* ✅ H1 fuera del “borde” */}
        <div className="mb-4">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t("pages.sick.admin.title", "Bajas por enfermedad")}
          </h1>
          <p className="text-slate-600 text-sm">
            {t(
              "pages.sick.admin.subtitle",
              "Gestiona solicitudes y documentos",
            )}
          </p>
        </div>

        {/* ✅ El borde ahora envuelve: selector año + leyenda + grid + detalle */}
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-6">
          {/* Controles + leyenda (misma línea) */}
          <div className="flex items-center justify-between gap-4 flex-wrap">


            {/* DERECHA: leyenda */}
            <div className="flex flex-wrap items-center justify-end gap-3 text-xs text-slate-600">
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded border-2 border-amber-300" />
                {t("pages.sick.admin.legend.pending", "Pendientes")}
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded border-2 border-emerald-300" />
                {t("pages.sick.admin.legend.accepted", "Aceptadas")}
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded border-2 border-rose-300" />
                {t("pages.sick.admin.legend.rejected", "Rechazadas")}
              </span>
            </div>
          </div>

          {/* Grid de meses (con bordes por estado) */}
          <div className="mt-4">
            <AdminSickMonthGrid
              year={selectedYear}
              months={months}
              monthlyCounts={monthlyCounts}
              selectedMonthIndex={selectedMonthIndex}
              onSelect={(idx) => setSelectedMonthIndex(idx)}
              locale={i18n.language || "es"}
              countLabel={(n) =>
                t("pages.sick.admin.grid.count", "{{n}} baja(s)", { n }) as string
              }
              onPrevYear={decYear}
              onNextYear={incYear}
              onThisYear={goThisYear}
              monthBorderClass={(idx) => {
                const p = monthBorderPriority[idx];
                if (p === "pending") return "border-amber-300 ring-2 ring-amber-200";
                if (p === "accepted") return "border-emerald-300 ring-2 ring-emerald-100";
                if (p === "rejected") return "border-rose-300 ring-2 ring-rose-100";
                return "";
              }}
            />

          </div>

          {/* Detalle del mes (solo cuando hay mes seleccionado) */}
          {selectedMonthIndex !== null && (
            <div className="mt-6 mb-2 rounded-xl ring-1 ring-slate-200 bg-white">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div className="text-sm font-medium text-slate-800 flex items-center gap-2">
                  <span aria-hidden>🗓</span>
                  <span className="capitalize">
                    {t(
                      "pages.sick.admin.month.header",
                      "Bajas {{month}} {{year}}",
                      {
                        month: months[selectedMonthIndex].label,
                        year: selectedYear,
                      },
                    )}
                  </span>
                  <span className="text-slate-500">
                    ({monthDetailToShow.length})
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedMonthIndex(null)}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-100 rounded-full px-3 py-1.5"
                >
                  {t("pages.sick.admin.month.back", "Volver al grid")}
                </button>
              </div>

              {monthDetailToShow.length === 0 ? (
                <div className="p-4 text-sm text-slate-600 text-center">
                  {t(
                    "pages.sick.admin.month.empty",
                    "No hay bajas en este mes",
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className={tableClass}>
                    <colgroup>
                      <col className="w-[26%]" />
                      <col className="w-[20%]" />
                      <col className="w-[10%]" />
                      <col className="w-[16%]" />
                      <col className="w-[18%]" />
                      <col className="w-[10%]" />
                    </colgroup>

                    <thead className="sticky top-0 bg-slate-50 z-10">
                      <tr className="text-slate-600 border-b border-slate-200">
                        <th className={thClass}>
                          {t("pages.sick.admin.th.user", "Trabajador")}
                        </th>
                        <th className={thClass}>
                          {t("pages.sick.admin.th.dates", "Fechas")}
                        </th>
                        <th className={thClass}>
                          {t("pages.sick.admin.th.days", "Días")}
                        </th>
                        <th className={thClass}>
                          {t("pages.sick.admin.th.status", "Estado")}
                        </th>
                        <th className={thClass}>
                          {t("pages.sick.admin.th.doc", "Documentos")}
                        </th>
                        <th className={thClass}>
                          {t("pages.sick.admin.th.actions", "Acciones")}
                        </th>
                      </tr>
                    </thead>

                    <tbody className="[&>tr:nth-child(odd)]:bg-slate-50/30">
                      {monthDetailToShow.map((it) => {
                        const u = (it.user as any) || {};
                        const fullname =
                          (u?.lastName ? `${u.lastName}, ` : "") +
                          (u?.name ?? "—");

                        return (
                          <tr key={`month-${it._id}`} className={trClass}>
                            {/* Trabajador */}
                            <td className="px-3 py-2 align-top">
                              <div className="text-slate-800 font-medium truncate">
                                {fullname || "—"}
                              </div>
                            </td>

                            {/* Fechas */}
                            <td className="px-3 py-2 align-top">
                              <div className="text-slate-800 whitespace-nowrap">
                                {fmtISO(it.startDate, i18n.language)} —{" "}
                                {fmtISO(it.endDate, i18n.language)}
                              </div>
                            </td>

                            {/* Días */}
                            <td className="px-3 py-2 align-top">
                              {(() => {
                                const s = new Date(it.startDate);
                                const e = new Date(it.endDate);
                                s.setHours(0, 0, 0, 0);
                                e.setHours(0, 0, 0, 0);
                                const diff =
                                  Math.round(
                                    (e.getTime() - s.getTime()) / 86400000,
                                  ) + 1;
                                const days = isNaN(diff)
                                  ? "—"
                                  : Math.max(diff, 1);
                                return days;
                              })()}
                            </td>

                            {/* Estado */}
                            <td className="px-3 py-2 align-top whitespace-nowrap">
                              {badge(it.status)}
                            </td>

                            {/* Documentos */}
                            <td className="px-3 py-2 align-top text-center">
                              {(() => {
                                const rawDocUrls: string[] = [
                                  ...(it.documentUrl ? [it.documentUrl] : []),
                                  ...(Array.isArray(it.documents)
                                    ? it.documents
                                    : []),
                                ];
                                const seen = new Set<string>();
                                const docUrls = rawDocUrls.filter((u2) => {
                                  const key =
                                    displayFileNameFromUrl(u2).toLowerCase();
                                  if (seen.has(key)) return false;
                                  seen.add(key);
                                  return true;
                                });

                                const count = docUrls.length;
                                const isOpen = openDocsId === it._id;

                                if (count === 0) {
                                  return (
                                    <span className="text-slate-500">
                                      {t(
                                        "pages.sick.docs.none",
                                        "Sin documento",
                                      )}
                                    </span>
                                  );
                                }

                                return (
                                  <div className="inline-flex flex-col items-center">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setOpenDocsId(isOpen ? null : it._id)
                                      }
                                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-100"
                                      aria-expanded={isOpen}
                                      aria-controls={`docs-panel-month-${it._id}`}
                                    >
                                      <span className="whitespace-nowrap">
                                        {t(
                                          "pages.sick.docs.count",
                                          "{{n}} documentos",
                                          { n: count },
                                        )}
                                      </span>
                                    </button>

                                    <div
                                      id={`docs-panel-month-${it._id}`}
                                      className={`overflow-hidden transition-all duration-200 ease-out ${isOpen
                                        ? "opacity-100 max-h-56 mt-2"
                                        : "opacity-0 max-h-0 mt-0"
                                        }`}
                                    >
                                      <ul className="flex flex-wrap justify-center gap-2">
                                        {docUrls.map((url, idx) => {
                                          const label =
                                            displayFileNameFromUrl(url);
                                          return (
                                            <li
                                              key={url + idx}
                                              className="inline-flex items-center max-w-full rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-[11px]"
                                              title={label}
                                            >
                                              <span
                                                aria-hidden="true"
                                                className="mr-1"
                                              >
                                                📎
                                              </span>
                                              <a
                                                href={buildImageUrl(url)}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="truncate max-w-[180px] text-slate-700 hover:text-slate-900"
                                              >
                                                {label}
                                              </a>
                                            </li>
                                          );
                                        })}
                                      </ul>
                                    </div>
                                  </div>
                                );
                              })()}
                            </td>

                            {/* Acciones: solo si está pendiente */}
                            <td className="px-3 py-2 align-top">
                              {it.status === "pending" ? (
                                <div className="flex justify-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => onAccept(it._id)}
                                    className={btnAcceptClass}
                                    title={
                                      t("common.accept", "Aceptar") as string
                                    }
                                    aria-label={
                                      t("common.accept", "Aceptar") as string
                                    }
                                  >
                                    ✅
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onReject(it._id)}
                                    className={btnRejectClass}
                                    title={
                                      t("common.reject", "Rechazar") as string
                                    }
                                    aria-label={
                                      t("common.reject", "Rechazar") as string
                                    }
                                  >
                                    ❌
                                  </button>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-xs">
                                  —
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Estado cuando NO hay mes seleccionado */}
          {selectedMonthIndex === null && (
            <div className="mt-4 text-center text-sm text-slate-600">
              {t(
                "pages.sick.admin.pickMonth",
                "Haz click en un mes para ver las bajas de ese mes.",
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



