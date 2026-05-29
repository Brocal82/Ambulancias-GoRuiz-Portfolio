import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ApiError } from "../services/http";
import {
  cancelMyVacationRequest,
  createVacationRequest,
  getMyVacationRequests,
  getVacationAvailability,
  removeMyDeniedVacationRequest,
  respondToAlternativeDate,
  VacationAvailabilityResponse,
  VacationRequestItem,
  VacationRequestStatus,
} from "../services/vacations";

function dateOnly(value: string): string {
  const trimmed = (value ?? "").trim();
  const direct = /^(\d{4}-\d{2}-\d{2})$/.exec(trimmed);
  if (direct) return direct[1] ?? trimmed;
  const iso = /^(\d{4}-\d{2}-\d{2})T/.exec(trimmed);
  if (iso) return iso[1] ?? trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDayKey(day: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function formatDateLabel(day: string): string {
  const parsed = parseDayKey(day);
  if (!parsed) return day;
  return parsed.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function calcVacationDays(start: string, end: string): number {
  const startDt = parseDayKey(start);
  const endDt = parseDayKey(end);
  if (!startDt || !endDt) return 0;
  startDt.setHours(0, 0, 0, 0);
  endDt.setHours(0, 0, 0, 0);
  const diff = endDt.getTime() - startDt.getTime();
  if (diff < 0) return 0;
  return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function isPastDay(day: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parsed = parseDayKey(day);
  if (!parsed) return false;
  parsed.setHours(0, 0, 0, 0);
  return parsed.getTime() < today.getTime();
}

function buildDayKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getWeekdayMondayIndex(year: number, month: number, day: number): number {
  const jsDay = new Date(year, month - 1, day).getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

function iterDateRange(start: string, end: string): string[] {
  const out: string[] = [];
  let cursor = parseDayKey(start);
  const until = parseDayKey(end);
  if (!cursor || !until) return out;
  while (cursor.getTime() <= until.getTime()) {
    out.push(buildDayKey(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate()));
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
  }
  return out;
}

type CalendarCell = {
  key: string;
  day: number;
  dateKey: string;
};

const MONTH_NAMES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

function formatStatus(status: VacationRequestStatus): string {
  switch (status) {
    case "pending":
      return "Pendiente";
    case "accepted":
      return "Aprobada";
    case "cancelled":
      return "Cancelada";
    case "option_sent":
      return "Alternativa enviada";
    case "cancel_requested":
      return "Cancelacion solicitada";
    default:
      return status;
  }
}

function statusStyle(status: VacationRequestStatus) {
  switch (status) {
    case "accepted":
      return { bg: "#f8fafc", text: "#047857", border: "#22c55e" };
    case "pending":
      return { bg: "#f8fafc", text: "#a16207", border: "#eab308" };
    case "option_sent":
      return { bg: "#f8fafc", text: "#1d4ed8", border: "#3b82f6" };
    case "cancel_requested":
      return { bg: "#f8fafc", text: "#a16207", border: "#eab308" };
    case "cancelled":
      return { bg: "#f8fafc", text: "#b91c1c", border: "#ef4444" };
    default:
      return { bg: "#f8fafc", text: "#475569", border: "#cbd5e1" };
  }
}

function resolveRequestBorderColor(item: VacationRequestItem, fallbackBorder: string): string {
  if (item.status === "cancelled") return "#ef4444";
  return fallbackBorder;
}

function sortByRequestedAtDesc(items: VacationRequestItem[]): VacationRequestItem[] {
  return [...items].sort(
    (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime(),
  );
}

export function WorkerVacationsScreen({ wsTrigger }: { wsTrigger?: number }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [requests, setRequests] = useState<VacationRequestItem[]>([]);
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [selectedEnd, setSelectedEnd] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [adminMessageModal, setAdminMessageModal] = useState<{
    open: boolean;
    title: string;
    message: string;
  }>({
    open: false,
    title: "",
    message: "",
  });
  const [availabilitySummary, setAvailabilitySummary] = useState<{
    green: number;
    yellow: number;
    red: number;
    maxPerDay: number;
  } | null>(null);
  const [availabilityByMonth, setAvailabilityByMonth] = useState<
    Record<string, VacationAvailabilityResponse>
  >({});

  const activeRequests = useMemo(
    () =>
      requests.filter(
        (r) =>
          r.status === "pending" ||
          r.status === "accepted" ||
          r.status === "option_sent" ||
          r.status === "cancel_requested",
      ),
    [requests],
  );

  const selectedRangeLabel = useMemo(() => {
    if (!selectedStart) return "Sin rango seleccionado";
    if (!selectedEnd) return `Inicio: ${formatDateLabel(selectedStart)}`;
    return `${formatDateLabel(selectedStart)} - ${formatDateLabel(selectedEnd)}`;
  }, [selectedEnd, selectedStart]);
  const hasSelection = Boolean(selectedStart);

  const ensureMonthAvailability = useCallback(
    async (targetYear: number, targetMonth: number): Promise<VacationAvailabilityResponse> => {
      const key = monthKey(targetYear, targetMonth);
      const data = await getVacationAvailability(targetYear, targetMonth);
      setAvailabilityByMonth((prev) => ({ ...prev, [key]: data }));
      return data;
    },
    [],
  );

  const loadAll = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = Boolean(opts?.silent);
      if (!silent) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setErrorMessage(undefined);
      try {
        const [myRequests, availability] = await Promise.all([
          getMyVacationRequests(),
          ensureMonthAvailability(year, month),
        ]);

        const green = availability.days.filter((d) => d.state === "green").length;
        const yellow = availability.days.filter((d) => d.state === "yellow").length;
        const red = availability.days.filter((d) => d.state === "red").length;

        setAvailabilitySummary({
          green,
          yellow,
          red,
          maxPerDay: availability.maxPerDay,
        });
        setAvailabilityByMonth((prev) => ({
          ...prev,
          [monthKey(year, month)]: availability,
        }));
        setRequests(sortByRequestedAtDesc(myRequests));
      } catch (error) {
        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("No se pudieron cargar las vacaciones.");
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [ensureMonthAvailability, month, year],
  );

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const prevWsTrigger = useRef(wsTrigger);
  useEffect(() => {
    if (wsTrigger === undefined || wsTrigger === prevWsTrigger.current) return;
    prevWsTrigger.current = wsTrigger;
    void loadAll({ silent: true });
  }, [wsTrigger, loadAll]);

  const isRedDay = useCallback(
    (dayKey: string): boolean => {
      const date = parseDayKey(dayKey);
      if (!date) return false;
      const key = monthKey(date.getFullYear(), date.getMonth() + 1);
      const monthData = availabilityByMonth[key];
      const dayInfo = monthData?.days.find((d) => d.day === date.getDate());
      return dayInfo?.state === "red";
    },
    [availabilityByMonth],
  );

  const isInSelectedRange = useCallback(
    (dayKey: string): boolean => {
      if (!selectedStart || !selectedEnd) return false;
      return dayKey >= selectedStart && dayKey <= selectedEnd;
    },
    [selectedEnd, selectedStart],
  );

  const isSelectableDay = useCallback(
    (dayKey: string): boolean => !isPastDay(dayKey) && !isRedDay(dayKey),
    [isRedDay],
  );

  const selectCalendarDay = useCallback(
    (dayKey: string) => {
      if (!isSelectableDay(dayKey)) {
        Alert.alert(
          "Dia no disponible",
          "No puedes seleccionar dias en rojo o dias pasados.",
        );
        return;
      }
      if (!selectedStart || (selectedStart && selectedEnd)) {
        setSelectedStart(dayKey);
        setSelectedEnd(null);
        return;
      }
      if (dayKey < selectedStart) {
        setSelectedStart(dayKey);
        setSelectedEnd(null);
        return;
      }
      setSelectedEnd(dayKey);
    },
    [isSelectableDay, selectedEnd, selectedStart],
  );

  const validateCreate = (): { ok: true; start: string; end: string } | { ok: false } => {
    const start = selectedStart ? dateOnly(selectedStart) : "";
    const end = dateOnly(selectedEnd ?? selectedStart ?? "");
    if (!start || !end) {
      Alert.alert("Datos incompletos", "Selecciona un rango en el calendario.");
      return { ok: false };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      Alert.alert("Formato invalido", "Usa formato YYYY-MM-DD.");
      return { ok: false };
    }
    if (start > end) {
      Alert.alert("Rango invalido", "La fecha de inicio no puede ser posterior a la de fin.");
      return { ok: false };
    }
    return { ok: true, start, end };
  };

  const ensureAvailabilityLoadedForRange = useCallback(
    async (start: string, end: string) => {
      let cursor = parseDayKey(start);
      const until = parseDayKey(end);
      if (!cursor || !until) return;
      while (
        cursor.getFullYear() < until.getFullYear() ||
        (cursor.getFullYear() === until.getFullYear() &&
          cursor.getMonth() <= until.getMonth())
      ) {
        await ensureMonthAvailability(cursor.getFullYear(), cursor.getMonth() + 1);
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      }
    },
    [ensureMonthAvailability],
  );

  const handleCreate = async () => {
    const validated = validateCreate();
    if (!validated.ok) return;
    setIsSubmitting(true);
    try {
      await ensureAvailabilityLoadedForRange(validated.start, validated.end);
      const blocked = iterDateRange(validated.start, validated.end).some((d) => !isSelectableDay(d));
      if (blocked) {
        Alert.alert(
          "Rango no valido",
          "El rango contiene dias rojos o pasados. Selecciona otro tramo.",
        );
        return;
      }
      await createVacationRequest({
        startDate: validated.start,
        endDate: validated.end,
      });
      setSelectedStart(null);
      setSelectedEnd(null);
      Alert.alert("Solicitud enviada", "Tu solicitud de vacaciones se ha registrado.");
      await loadAll({ silent: true });
    } catch (error) {
      if (error instanceof ApiError) {
        Alert.alert("No se pudo crear", error.message);
      } else {
        Alert.alert("No se pudo crear", "Ha ocurrido un error inesperado.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async (item: VacationRequestItem) => {
    Alert.alert("Cancelar solicitud", "Quieres continuar con la cancelacion?", [
      { text: "No", style: "cancel" },
      {
        text: "Si, cancelar",
        style: "destructive",
        onPress: async () => {
          try {
            await cancelMyVacationRequest(item._id);
            await loadAll({ silent: true });
          } catch (error) {
            if (error instanceof ApiError) {
              Alert.alert("No se pudo cancelar", error.message);
            } else {
              Alert.alert("No se pudo cancelar", "Ha ocurrido un error inesperado.");
            }
          }
        },
      },
    ]);
  };

  const handleAlternativeResponse = async (item: VacationRequestItem, accept: boolean) => {
    try {
      await respondToAlternativeDate(item._id, { accept });
      await loadAll({ silent: true });
    } catch (error) {
      if (error instanceof ApiError) {
        Alert.alert("No se pudo responder", error.message);
      } else {
        Alert.alert("No se pudo responder", "Ha ocurrido un error inesperado.");
      }
    }
  };

  const handleRemoveCancelled = async (item: VacationRequestItem) => {
    Alert.alert("Eliminar solicitud", "Quieres eliminar esta solicitud cancelada?", [
      { text: "No", style: "cancel" },
      {
        text: "Si, eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await removeMyDeniedVacationRequest(item._id);
            await loadAll({ silent: true });
          } catch (error) {
            if (error instanceof ApiError) {
              Alert.alert("No se pudo eliminar", error.message);
            } else {
              Alert.alert("No se pudo eliminar", "Ha ocurrido un error inesperado.");
            }
          }
        },
      },
    ]);
  };


  const calendarCells = useMemo<CalendarCell[]>(() => {
    const totalDays = getDaysInMonth(year, month);
    const leading = getWeekdayMondayIndex(year, month, 1);
    const cells: CalendarCell[] = [];
    for (let i = 0; i < leading; i++) {
      cells.push({
        key: `blank-${i}`,
        day: 0,
        dateKey: "",
      });
    }
    for (let day = 1; day <= totalDays; day++) {
      const dateKey = buildDayKey(year, month, day);
      cells.push({
        key: dateKey,
        day,
        dateKey,
      });
    }
    return cells;
  }, [month, year]);

  const availability = availabilityByMonth[monthKey(year, month)];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Vacaciones</Text>
        <Pressable
          style={({ pressed }) => [styles.iconButtonRound, pressed && styles.iconButtonRoundPressed]}
          onPress={() => void loadAll({ silent: true })}
          disabled={isRefreshing}
          accessibilityRole="button"
          accessibilityLabel="Refrescar vacaciones"
        >
          {({ pressed }) => (
            isRefreshing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="refresh" size={20} color={pressed ? "#f97316" : "#ffffff"} />
            )
          )}
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#0f766e" />
          <Text style={styles.centerText}>Cargando vacaciones...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.centerState}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <Pressable style={styles.retryButton} onPress={() => void loadAll()}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Calendario de solicitud</Text>
            <View style={styles.filtersRow}>
              <View style={styles.filterBlock}>
                <View style={styles.filterControls}>
                  <Pressable
                    style={styles.filterArrowButton}
                    onPress={() => {
                      const nextMonth = month === 1 ? 12 : month - 1;
                      const nextYear = month === 1 ? year - 1 : year;
                      setMonth(nextMonth);
                      setYear(nextYear);
                    }}
                  >
                    <Text style={styles.filterArrowText}>{"<"}</Text>
                  </Pressable>
                  <Text style={styles.filterValue} numberOfLines={1}>
                    {MONTH_NAMES[month - 1]}
                  </Text>
                  <Pressable
                    style={styles.filterArrowButton}
                    onPress={() => {
                      const nextMonth = month === 12 ? 1 : month + 1;
                      const nextYear = month === 12 ? year + 1 : year;
                      setMonth(nextMonth);
                      setYear(nextYear);
                    }}
                  >
                    <Text style={styles.filterArrowText}>{">"}</Text>
                  </Pressable>
                </View>
              </View>
              <View style={styles.filterBlock}>
                <View style={styles.filterControls}>
                  <Pressable
                    style={styles.filterArrowButton}
                    onPress={() => setYear((prev) => prev - 1)}
                  >
                    <Text style={styles.filterArrowText}>{"<"}</Text>
                  </Pressable>
                  <Text style={styles.filterValue} numberOfLines={1}>
                    {year}
                  </Text>
                  <Pressable
                    style={styles.filterArrowButton}
                    onPress={() => setYear((prev) => prev + 1)}
                  >
                    <Text style={styles.filterArrowText}>{">"}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
            <View style={styles.monthNav}>
              <Pressable
                style={styles.monthArrowButton}
                onPress={() => {
                  const nextMonth = month === 1 ? 12 : month - 1;
                  const nextYear = month === 1 ? year - 1 : year;
                  setMonth(nextMonth);
                  setYear(nextYear);
                }}
              >
                <Text style={styles.monthArrowText}>{"<"}</Text>
              </Pressable>
              <Text style={styles.monthLabel}>
                {String(month).padStart(2, "0")}/{year}
                {isRefreshing ? "..." : ""}
              </Text>
              <Pressable
                style={styles.monthArrowButton}
                onPress={() => {
                  const nextMonth = month === 12 ? 1 : month + 1;
                  const nextYear = month === 12 ? year + 1 : year;
                  setMonth(nextMonth);
                  setYear(nextYear);
                }}
              >
                <Text style={styles.monthArrowText}>{">"}</Text>
              </Pressable>
            </View>
            <View style={styles.weekHeader}>
              {["L", "M", "X", "J", "V", "S", "D"].map((w) => (
                <Text key={w} style={styles.weekHeaderText}>
                  {w}
                </Text>
              ))}
            </View>
            <View style={styles.calendarGrid}>
              {calendarCells.map((cell) => {
                if (cell.day === 0) {
                  return <View key={cell.key} style={styles.calendarCellBlank} />;
                }
                const dayInfo = availability?.days.find((d) => d.day === cell.day);
                const state = dayInfo?.state ?? "green";
                const isBlocked = !isSelectableDay(cell.dateKey);
                const isStart = selectedStart === cell.dateKey;
                const isEnd = selectedEnd === cell.dateKey;
                const inRange = isInSelectedRange(cell.dateKey);
                const stateStyle =
                  state === "red"
                    ? styles.dayRed
                    : state === "yellow"
                      ? styles.dayYellow
                      : styles.dayGreen;
                return (
                  <Pressable
                    key={cell.key}
                    style={styles.calendarCell}
                    onPress={() => selectCalendarDay(cell.dateKey)}
                  >
                    <View
                      style={[
                        styles.calendarCellInner,
                        stateStyle,
                        inRange && styles.dayInRange,
                        (isStart || isEnd) && styles.dayEdge,
                        isBlocked && styles.dayBlocked,
                      ]}
                    >
                      <Text style={styles.calendarCellText}>{cell.day}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.calendarActionRow}>
              <Pressable
                style={[
                  styles.iconActionButton,
                  !hasSelection && styles.iconActionButtonDisabled,
                ]}
                onPress={() => {
                  setSelectedStart(null);
                  setSelectedEnd(null);
                }}
                disabled={!hasSelection}
                accessibilityRole="button"
                accessibilityLabel="Limpiar seleccion"
              >
                <Ionicons name="trash-outline" size={20} color="#ffffff" />
              </Pressable>
              <Pressable
                style={[
                  styles.iconActionButton,
                  styles.submitIconButton,
                  !hasSelection && styles.iconActionButtonDisabled,
                  isSubmitting && styles.buttonDisabled,
                ]}
                onPress={() => void handleCreate()}
                disabled={isSubmitting || !hasSelection}
                accessibilityRole="button"
                accessibilityLabel="Crear solicitud"
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Ionicons name="send-outline" size={20} color="#ffffff" />
                )}
              </Pressable>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Solicitudes ({requests.length})</Text>
            {requests.length === 0 ? (
              <Text style={styles.emptyText}>Todavia no tienes solicitudes.</Text>
            ) : (
              requests.map((item) => {
                const tone = statusStyle(item.status);
                const hasAlternative =
                  item.status === "option_sent" &&
                  item.adminOptionStartDate &&
                  item.adminOptionEndDate;
                const canCancel =
                  (item.status === "pending" || item.status === "accepted") && !hasAlternative;
                const canDeleteCancelled = item.status === "cancelled";
                const startKey = dateOnly(item.startDate);
                const endKey = dateOnly(item.endDate);
                const totalDays = calcVacationDays(startKey, endKey);
                const hasAdminMessage = Boolean(item.adminNote && item.adminNote.trim().length > 0);

                return (
                  <View
                    key={item._id}
                    style={[
                      styles.requestItem,
                      { borderColor: resolveRequestBorderColor(item, tone.border) },
                    ]}
                  >
                    <View style={styles.requestCompactLeft}>
                      {hasAlternative ? (
                        <View style={styles.alternativeDatesBlock}>
                          <Text style={styles.requestRangeCompact} numberOfLines={1}>
                            {formatDateLabel(startKey)} - {formatDateLabel(endKey)}
                          </Text>
                          <Text style={styles.requestRangeAlternative} numberOfLines={1}>
                            {formatDateLabel(dateOnly(item.adminOptionStartDate ?? ""))} -{" "}
                            {formatDateLabel(dateOnly(item.adminOptionEndDate ?? ""))}
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.requestRangeCompact} numberOfLines={1}>
                          {formatDateLabel(startKey)} - {formatDateLabel(endKey)}
                        </Text>
                      )}
                      <View style={styles.daysBadge}>
                        <Text style={styles.daysBadgeText}>{totalDays}d</Text>
                      </View>
                    </View>
                    <View style={styles.requestCompactRight}>
                      {hasAlternative && hasAdminMessage ? (
                        <Pressable
                          style={[styles.iconMiniButton, styles.messageButton]}
                          onPress={() =>
                            setAdminMessageModal({
                              open: true,
                              title: "Mensaje del administrador",
                              message: item.adminNote?.trim() ?? "",
                            })
                          }
                          accessibilityLabel="Ver mensaje del administrador"
                        >
                          <Ionicons name="mail-outline" size={16} color="#ffffff" />
                        </Pressable>
                      ) : null}
                      {hasAlternative ? (
                        <>
                          <Pressable
                            style={[styles.iconMiniButton, styles.approveButton]}
                            onPress={() => void handleAlternativeResponse(item, true)}
                            accessibilityLabel="Aceptar propuesta"
                          >
                            <Ionicons name="checkmark" size={16} color="#ffffff" />
                          </Pressable>
                          <Pressable
                            style={[styles.iconMiniButton, styles.rejectButton]}
                            onPress={() => void handleAlternativeResponse(item, false)}
                            accessibilityLabel="Rechazar propuesta"
                          >
                            <Ionicons name="close" size={16} color="#ffffff" />
                          </Pressable>
                        </>
                      ) : null}
                      {!hasAlternative && hasAdminMessage ? (
                        <Pressable
                          style={[styles.iconMiniButton, styles.messageButton]}
                          onPress={() =>
                            setAdminMessageModal({
                              open: true,
                              title: "Mensaje del administrador",
                              message: item.adminNote?.trim() ?? "",
                            })
                          }
                          accessibilityLabel="Ver mensaje del administrador"
                        >
                          <Ionicons name="mail-outline" size={16} color="#ffffff" />
                        </Pressable>
                      ) : null}
                      {canCancel ? (
                        <Pressable
                          style={[styles.iconMiniButton, styles.cancelButton]}
                          onPress={() => void handleCancel(item)}
                          accessibilityLabel={
                            item.status === "accepted"
                              ? "Solicitar cancelacion"
                              : "Cancelar solicitud"
                          }
                        >
                          <Ionicons
                            name={item.status === "accepted" ? "stop-outline" : "close-outline"}
                            size={16}
                            color="#ffffff"
                          />
                        </Pressable>
                      ) : null}
                      {canDeleteCancelled ? (
                        <Pressable
                          style={[styles.iconMiniButton, styles.rejectButton]}
                          onPress={() => void handleRemoveCancelled(item)}
                          accessibilityLabel="Eliminar solicitud cancelada"
                        >
                          <Ionicons name="trash-outline" size={16} color="#ffffff" />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}

      <Modal
        visible={adminMessageModal.open}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setAdminMessageModal({ open: false, title: "", message: "" })
        }
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={styles.modalBackdropDismiss}
            onPress={() => setAdminMessageModal({ open: false, title: "", message: "" })}
          />
          <View style={styles.modalAlignCenter} pointerEvents="box-none">
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{adminMessageModal.title}</Text>
                <Pressable
                  onPress={() => setAdminMessageModal({ open: false, title: "", message: "" })}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar mensaje"
                >
                  <Ionicons name="close" size={24} color="#334155" />
                </Pressable>
              </View>
              <View style={styles.modalBody}>
                <Text style={styles.modalMessageText}>{adminMessageModal.message}</Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#ffffff",
  },
  iconButtonRound: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonRoundPressed: {
    borderColor: "#f97316",
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 14,
  },
  centerState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 10,
  },
  centerText: {
    color: "#64748b",
  },
  errorText: {
    color: "#b91c1c",
    textAlign: "center",
  },
  retryButton: {
    borderWidth: 1,
    borderColor: "#0f766e",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#ffffff",
  },
  retryButtonText: {
    color: "#0f766e",
    fontWeight: "700",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 10,
  },
  card: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  metaText: {
    color: "#475569",
    fontSize: 13,
  },
  availabilityRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  greenText: {
    color: "#047857",
    fontSize: 12,
    fontWeight: "700",
  },
  yellowText: {
    color: "#a16207",
    fontSize: 12,
    fontWeight: "700",
  },
  redText: {
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: "700",
  },
  monthActions: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  filtersRow: {
    marginTop: 4,
    marginBottom: 8,
    flexDirection: "row",
    gap: 10,
  },
  filterBlock: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
  },
  filterLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "700",
  },
  filterControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  filterArrowButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  filterArrowText: {
    color: "#334155",
    fontWeight: "700",
    fontSize: 14,
  },
  filterValue: {
    flex: 1,
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 14,
    textAlign: "center",
  },
  monthNav: {
    marginTop: 6,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  monthLabel: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "700",
  },
  monthArrowButton: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  monthArrowText: {
    color: "#334155",
    fontWeight: "700",
    fontSize: 16,
  },
  monthButton: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#ffffff",
  },
  monthButtonText: {
    color: "#334155",
    fontWeight: "700",
    fontSize: 12,
  },
  weekHeader: {
    marginTop: 4,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  weekHeaderText: {
    width: `${100 / 7}%`,
    textAlign: "center",
    color: "#475569",
    fontWeight: "700",
    fontSize: 12,
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
  },
  calendarCellBlank: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 2,
  },
  calendarCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 2,
  },
  calendarCellInner: {
    flex: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#dbeafe",
  },
  calendarCellText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
  },
  dayGreen: {
    backgroundColor: "#dcfce7",
    borderColor: "#86efac",
  },
  dayYellow: {
    backgroundColor: "#fef9c3",
    borderColor: "#fde047",
  },
  dayRed: {
    backgroundColor: "#fee2e2",
    borderColor: "#fca5a5",
  },
  dayBlocked: {
    opacity: 0.45,
  },
  dayInRange: {
    borderColor: "#0ea5e9",
    borderWidth: 2,
  },
  dayEdge: {
    backgroundColor: "#0ea5e9",
  },
  calendarActionRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#334155",
  },
  submitIconButton: {
    backgroundColor: "#0f766e",
  },
  iconActionButtonDisabled: {
    opacity: 0.35,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  emptyText: {
    color: "#64748b",
  },
  requestItem: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    backgroundColor: "#f8fafc",
  },
  requestCompactLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  requestRangeCompact: {
    flex: 1,
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 11,
  },
  alternativeDatesBlock: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  requestRangeAlternative: {
    color: "#1d4ed8",
    fontWeight: "700",
    fontSize: 11,
  },
  daysBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "#e2e8f0",
  },
  daysBadgeText: {
    color: "#334155",
    fontSize: 11,
    fontWeight: "700",
  },
  requestCompactRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  iconMiniButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  messageButton: {
    backgroundColor: "#0f766e",
  },
  requestTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  requestRange: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 13,
    flex: 1,
  },
  requestMeta: {
    color: "#475569",
    fontSize: 12,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  requestActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  actionButton: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actionButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 12,
  },
  approveButton: {
    backgroundColor: "#059669",
  },
  rejectButton: {
    backgroundColor: "#dc2626",
  },
  cancelButton: {
    backgroundColor: "#334155",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  modalBackdropDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  modalAlignCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  modalBody: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  modalMessageText: {
    color: "#334155",
    fontSize: 14,
    lineHeight: 20,
  },
});
