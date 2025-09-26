// frontend/src/pages/AdminSummariesPage.tsx
import { useEffect, useState, Fragment, useCallback, useMemo, useRef } from "react";
import { getAllSummaries, markSummaryReviewed } from "../api/workdaySummary";
import type { WorkdaySummary } from "../types/workdaySummary";
import ReviewSummary from "../components/workday/ReviewSummary";
import { useAuth } from "../hooks/useAuth";
import { formatYYYYMMDDToDDMMYYYY } from "../utils/timeUtils";
import { useTranslation } from "react-i18next";
import AdminSummariesMonthGrid from "../components/workday/AdminSummariesMonthGrid";

const ADMIN_SUMMARIES_CHANGED_EVENT = "admin-summaries-changed";
const notifySummariesChanged = () =>
  window.dispatchEvent(new Event(ADMIN_SUMMARIES_CHANGED_EVENT));

// 🎨 Borde “no leído”
const UNREAD_BORDER_COLOR = "border-amber-400";
const UNREAD_BORDER_THICKNESS = "border-l-4";

// Helper ISO yyyy-mm-dd
const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const AdminSummariesPage = () => {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();

  // ⬇️ por defecto: SIN día seleccionado → solo calendario
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // mes visible en el grid: mes actual
  const today = new Date();
  const [viewDate, setViewDate] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), 1));

  const [summaries, setSummaries] = useState<WorkdaySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const tableRef = useRef<HTMLDivElement | null>(null);

  const fetchSummaries = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getAllSummaries(token);
      setSummaries(data);
    } catch (error) {
      console.error("❌ Error al obtener resúmenes:", error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    void fetchSummaries();
  }, [token, fetchSummaries]);

  // 🔄 Refrescar al recuperar foco/visibilidad y por evento global
  useEffect(() => {
    const onFocus = () => fetchSummaries();
    const onVisibility = () => {
      if (document.visibilityState === "visible") fetchSummaries();
    };
    const onChanged = () => fetchSummaries();

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener(ADMIN_SUMMARIES_CHANGED_EVENT as any, onChanged as EventListener);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(ADMIN_SUMMARIES_CHANGED_EVENT as any, onChanged as EventListener);
    };
  }, [fetchSummaries]);

  // 🧮 Mapa YYYY-MM-DD -> { total, unread }
  const summariesByDate = useMemo(() => {
    const map: Record<string, { total: number; unread: number }> = {};
    for (const s of summaries) {
      const key = s.date;
      if (!map[key]) map[key] = { total: 0, unread: 0 };
      map[key].total += 1;
      const isUnread = (s as any).isReviewed === false || typeof (s as any).isReviewed === "undefined";
      if (isUnread) map[key].unread += 1;
    }
    return map;
  }, [summaries]);

  // 🌍 locale para el grid
  const locale = i18n.language === "de" ? "de-DE" : i18n.language === "en" ? "en-US" : "es-ES";

  // 👇 Click en fila: expandir y marcar como revisado si procede
  const onRowClick = async (
    s: WorkdaySummary & { _id?: string; isReviewed?: boolean },
    rowKey: string
  ) => {
    const isExpanded = expandedKey === rowKey;
    setExpandedKey(isExpanded ? null : rowKey);

    if (isExpanded || s.isReviewed) return;

    const id = s._id as string | undefined;
    if (!token || !id) return;

    try {
      await markSummaryReviewed(token, id);
      notifySummariesChanged();
      setSummaries((prev) =>
        prev.map((item) =>
          (item as any)._id === id
            ? ({ ...(item as any), isReviewed: true, reviewedAt: new Date().toISOString() } as any)
            : item
        )
      );
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("No se pudo marcar como revisado:", e);
    }
  };

  // 📆 Navegación mes
  const handlePrevMonth = () => {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };
  const handleToday = () => {
    const now = new Date();
    const nowISO = toISODate(now);
    setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(nowISO); // ← selecciona hoy y muestra tabla
    setExpandedKey(null);
    setTimeout(() => tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  // 📅 Filtrar resúmenes del día seleccionado
  const daySummaries = useMemo(
    () =>
      selectedDate
        ? summaries
            .filter((s) => s.date === selectedDate)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        : [],
    [summaries, selectedDate]
  );

  if (loading) {
    return <p className="text-center mt-8">{t("pages.summaries.admin.loading")}</p>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-center mb-6">
        {t("pages.summaries.admin.title")}
      </h1>

      {/* 🔷 Grid del mes */}
      <div className="mb-6">
        <AdminSummariesMonthGrid
          summariesByDate={summariesByDate}
          selectedDate={selectedDate ?? undefined}
          locale={locale}
          viewDate={viewDate}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onToday={handleToday}
          onSelectDate={(iso) => {
            // toggle: si clicas el mismo día, se oculta la tabla
            setSelectedDate((prev) => (prev === iso ? null : iso));
            setExpandedKey(null);
            // si se selecciona (no null), hacemos scroll
            setTimeout(() => {
              const willShow = selectedDate !== iso; // si era distinto, ahora se mostrará
              if (willShow) tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 0);
          }}
        />
      </div>

      {/* 🔶 Tabla del día seleccionado: SOLO si hay selección */}
      {selectedDate && (
        <div ref={tableRef}>
          <section className="mb-10">
            <div className="mb-3">
              <h2 className="text-lg font-semibold text-blue-700">
                {t("pages.summaries.admin.dateHeader", {
                  date: formatYYYYMMDDToDDMMYYYY(selectedDate),
                })}
              </h2>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white w-full shadow-sm">
              <table className="min-w-full table-fixed text-sm">
                <thead className="bg-gray-100 text-xs uppercase text-gray-600">
                  <tr className="text-center">
                    <th className="px-3 py-2 whitespace-nowrap w-40">{t("pages.summaries.admin.table.headers.dienstTime")}</th>
                    <th className="px-3 py-2 whitespace-nowrap w-24">{t("pages.summaries.admin.table.headers.ambulance")}</th>
                    <th className="px-3 py-2 whitespace-nowrap w-44">{t("pages.summaries.admin.table.headers.team")}</th>
                    <th className="px-3 py-2 whitespace-nowrap w-36">{t("pages.summaries.admin.table.headers.kmRange")}</th>
                    <th className="px-3 py-2 whitespace-nowrap w-24">{t("pages.summaries.admin.table.headers.kmTotal")}</th>
                    <th className="px-3 py-2 whitespace-nowrap w-20">{t("pages.summaries.admin.table.headers.trips")}</th>
                    <th className="px-3 py-2 whitespace-nowrap w-24">{t("pages.summaries.admin.table.headers.premie")}</th>
                    <th className="px-3 py-2 whitespace-nowrap w-52">{t("pages.summaries.admin.table.headers.noteReason")}</th>
                    <th className="px-3 py-2 whitespace-nowrap w-28">{t("pages.summaries.admin.table.headers.closure")}</th>
                  </tr>
                </thead>

                <tbody className="text-center align-middle">
                  {daySummaries
                    .sort((a, b) => {
                      if (a.assignmentId !== b.assignmentId) {
                        return a.assignmentId.localeCompare(b.assignmentId);
                      }
                      const aIsPartial = !a.isFinalClosure;
                      const bIsPartial = !b.isFinalClosure;
                      return aIsPartial === bIsPartial ? 0 : aIsPartial ? -1 : 1;
                    })
                    .map((s, i) => {
                      const key = `${s.assignmentId}-${i}`;
                      const isExpanded = expandedKey === key;
                      const isUnread =
                        (s as any).isReviewed === false || typeof (s as any).isReviewed === "undefined";

                      return (
                        <Fragment key={key}>
                          <tr
                            className={`border-t hover:bg-blue-50 cursor-pointer ${
                              isExpanded ? "bg-blue-100" : !s.isFinalClosure ? "bg-orange-50" : ""
                            }`}
                            onClick={() => onRowClick(s as any, key)}
                          >
                            {/* Dienst / Horario */}
                            <td
                              className={`p-2 font-semibold ${
                                isUnread ? `${UNREAD_BORDER_THICKNESS} ${UNREAD_BORDER_COLOR}` : ""
                              }`}
                            >
                              {t("pages.summaries.admin.row.dienstNumber", { num: (s as any).dienstNumber ?? "-" })}
                              <div className="text-xs text-gray-500">
                                {s.startTime && s.endTime
                                  ? `${s.startTime} → ${s.endTime}`
                                  : t("pages.summaries.admin.row.noSchedule")}
                              </div>
                            </td>

                            {/* Ambulancia */}
                            <td className="p-2">{(s as any).ambulanceNumber ?? "—"}</td>

                            {/* Team */}
                            <td className="p-2 text-sm leading-tight">
                              {/* DRIVER */}
                              <div
                                className="whitespace-nowrap overflow-hidden text-ellipsis"
                                title={
                                  typeof (s as any).driver === "object" && (s as any).driver !== null
                                    ? `${(s as any).driver.lastName}, ${(s as any).driver.name}`
                                    : "-"
                                }
                              >
                                {typeof (s as any).driver === "object" && (s as any).driver !== null
                                  ? `${(s as any).driver.lastName}, ${(s as any).driver.name}`
                                  : "-"}
                              </div>

                              {/* MEDIC */}
                              <div
                                className="whitespace-nowrap overflow-hidden text-ellipsis"
                                title={
                                  typeof (s as any).medic === "object" && (s as any).medic !== null
                                    ? `${(s as any).medic.lastName}, ${(s as any).medic.name}`
                                    : "-"
                                }
                              >
                                {typeof (s as any).medic === "object" && (s as any).medic !== null
                                  ? `${(s as any).medic.lastName}, ${(s as any).medic.name}`
                                  : "-"}
                              </div>
                            </td>


                            {/* Km inicio / fin */}
                            <td className="p-2 text-sm whitespace-pre-line leading-tight">
                              {t("pages.summaries.admin.row.start")} {s.initialKm}
                              {"\n"}
                              {t("pages.summaries.admin.row.end")} {s.finalKm}
                            </td>

                            {/* Km totales */}
                            <td className="p-2">{s.totalDienstKm}</td>

                            {/* Viajes */}
                            <td className="p-2">{typeof s.totalRealTrips === "number" ? s.totalRealTrips : "-"}</td>

                            {/* Prämie */}
                            <td className="p-2">{(s as any).totalEffectivePatients ?? "-"}</td>

                            {/* Nota / Motivo */}
                            <td className="p-2">
                              <span
                                className="inline-block max-w-[16ch] truncate align-middle"
                                title={(s as any).extraNote || (s as any).partialClosureReason || "-"}
                              >
                                {(s as any).extraNote || (s as any).partialClosureReason || "-"}
                              </span>
                            </td>

                            {/* Cierre */}
                            <td className="p-2">
                              {s.isFinalClosure
                                ? t("pages.summaries.admin.row.final")
                                : t("pages.summaries.admin.row.partial")}
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr>
                              <td colSpan={9} className="p-4 bg-green-50 border border-green-400 rounded-lg shadow-sm">
                                <ReviewSummary
                                  assignedDay={{
                                    assignmentId: s.assignmentId,
                                    dienstId: (s as any).dienstId || s.assignmentId,
                                    dienstNumber: (s as any).dienstNumber ?? 0,
                                    date: s.date,
                                    startTime: s.startTime || "",
                                    endTime: s.endTime || "",
                                    ambulanceId: (s as any).ambulanceId,
                                    driver:
                                      typeof (s as any).driver === "object"
                                        ? (s as any).driver
                                        : { name: "", lastName: (s as any).driver as string, _id: "" },
                                    medic:
                                      typeof (s as any).medic === "object"
                                        ? (s as any).medic
                                        : { name: "", lastName: (s as any).medic as string, _id: "" },
                                  }}
                                  ambulanceNumber={(s as any).ambulanceNumber ?? ""}
                                  initialKm={s.initialKm}
                                  finalKm={s.finalKm!}
                                  trips={[...s.trips].sort((a, b) => a.timeWarning.localeCompare(b.timeWarning))}
                                  hideHeader
                                />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default AdminSummariesPage;
