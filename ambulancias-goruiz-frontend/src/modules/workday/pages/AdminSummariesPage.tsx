// src/modules/workday/pages/AdminSummariesPage.tsx
import { useEffect, useState, useCallback, useMemo } from "react";
import { getAllSummaries, markSummaryReviewed } from "../domain";
import type { WorkdaySummary } from "../domain";
import { useAuth } from "../../../hooks/useAuth";
import { useTranslation } from "react-i18next";
import {
  AdminSummariesMonthGrid,
  DaySummariesModal,
  AdminSummaryGroupModal,
} from "../components";

const ADMIN_SUMMARIES_CHANGED_EVENT = "admin-summaries-changed";
const notifySummariesChanged = () =>
  window.dispatchEvent(new Event(ADMIN_SUMMARIES_CHANGED_EVENT));

// Helper ISO yyyy-mm-dd
const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

const AdminSummariesPage = () => {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();

  // ⬇️ por defecto: SIN día seleccionado → solo calendario
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // mes visible en el grid: mes actual
  const today = new Date();
  const [viewDate, setViewDate] = useState<Date>(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );

  const [summaries, setSummaries] = useState<WorkdaySummary[]>([]);
  const [loading, setLoading] = useState(true);

  // 🪟 Modal con grid de resúmenes por día
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  // 🪟 Modal con detalle de grupo (parciales + final)
  const [selectedSummaryGroup, setSelectedSummaryGroup] = useState<
    WorkdaySummary[] | null
  >(null);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);

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
    window.addEventListener(
      ADMIN_SUMMARIES_CHANGED_EVENT as any,
      onChanged as EventListener,
    );

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(
        ADMIN_SUMMARIES_CHANGED_EVENT as any,
        onChanged as EventListener,
      );
    };
  }, [fetchSummaries]);

  // 🧮 Mapa YYYY-MM-DD -> { total, unread }
  // total = Nº de DIENST únicos (no nº de resúmenes)
  // unread = Nº de DIENST únicos que tienen al menos 1 resumen sin revisar
  const summariesByDate = useMemo(() => {
    const map: Record<string, { total: number; unread: number }> = {};

    const dayGroups = new Map<string, Set<string>>();
    const dayUnreadGroups = new Map<string, Set<string>>();

    for (const summary of summaries) {
      const dayKey = summary.date;

      const s: any = summary;
      const dienstNumber = s.dienstNumber ?? "no-dienst";
      const assignmentId = summary.assignmentId ?? "no-assignment";

      const groupKey = `${dienstNumber}__${assignmentId}`;

      if (!dayGroups.has(dayKey)) dayGroups.set(dayKey, new Set());
      dayGroups.get(dayKey)!.add(groupKey);

      const isUnread =
        (s as any).isReviewed === false ||
        typeof (s as any).isReviewed === "undefined";

      if (isUnread) {
        if (!dayUnreadGroups.has(dayKey))
          dayUnreadGroups.set(dayKey, new Set());
        dayUnreadGroups.get(dayKey)!.add(groupKey);
      }
    }

    for (const [dayKey, groupsSet] of dayGroups.entries()) {
      const total = groupsSet.size;
      const unread = dayUnreadGroups.get(dayKey)?.size ?? 0;
      map[dayKey] = { total, unread };
    }

    return map;
  }, [summaries]);

  // 🌍 locale para el grid
  const locale =
    i18n.language === "de"
      ? "de-DE"
      : i18n.language === "en"
        ? "en-US"
        : "es-ES";

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
    setSelectedDate(nowISO);
    setIsDayModalOpen(true);
  };

  // 📅 Filtrar resúmenes del día seleccionado
  const daySummaries = useMemo(
    () =>
      selectedDate
        ? summaries
          .filter((s) => s.date === selectedDate)
          .sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
          )
        : [],
    [summaries, selectedDate],
  );

  // ✅ Marcar como revisado TODOS los resúmenes "unread" dentro de un grupo
  const markGroupAsReviewed = useCallback(
    async (group: WorkdaySummary[]) => {
      if (!token) return;

      const unreadIds = group
        .filter(
          (s: any) =>
            (s as any).isReviewed === false ||
            typeof (s as any).isReviewed === "undefined",
        )
        .map((s: any) => s._id as string | undefined)
        .filter(Boolean) as string[];

      if (unreadIds.length === 0) return;

      try {
        // 1) backend: marcar todos como leídos
        await Promise.all(
          unreadIds.map((id) => markSummaryReviewed(token, id)),
        );

        // 2) refrescar contadores/cambios globales (si lo usas en badges)
        notifySummariesChanged();

        // 3) actualizar state local para que desaparezca el naranja sin recargar
        const reviewedAt = new Date().toISOString();
        setSummaries((prev) =>
          prev.map((item: any) =>
            unreadIds.includes(item?._id)
              ? ({ ...item, isReviewed: true, reviewedAt } as any)
              : item,
          ),
        );
      } catch (err) {
        console.warn("No se pudieron marcar como revisados:", err);
      }
    },
    [token],
  );

  // 👉 Recibimos un GRUPO de resúmenes (mismo Dienst: parciales + final).
  //    Marcamos como leído y abrimos el modal de detalle.
  const handleSelectDaySummaryGroup = async (group: WorkdaySummary[]) => {
    // eslint-disable-next-line no-console
    console.log(
      "Grupo de resúmenes seleccionado desde DaySummariesModal:",
      group,
    );

    await markGroupAsReviewed(group);

    setSelectedSummaryGroup(group);
    setIsDayModalOpen(false);
    setIsGroupModalOpen(true);
  };

  if (loading) {
    return (
      <p className="text-center mt-8">{t("pages.summaries.admin.loading")}</p>
    );
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
            const isSameDay = selectedDate === iso;
            const willSelect = !isSameDay;

            setSelectedDate(isSameDay ? null : iso);
            setIsDayModalOpen(willSelect);
          }}
        />
      </div>

      {/* 🪟 Modal con grid de resúmenes del día seleccionado */}
      <DaySummariesModal
        isOpen={isDayModalOpen}
        date={selectedDate}
        summaries={daySummaries}
        onClose={() => setIsDayModalOpen(false)}
        onSelectSummaryGroup={handleSelectDaySummaryGroup}
      />

      {/* 🪟 Modal con detalle de un grupo (parciales + final del mismo Dienst) */}
      <AdminSummaryGroupModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        summaries={selectedSummaryGroup ?? []}
      />
    </div>
  );
};

export default AdminSummariesPage;
