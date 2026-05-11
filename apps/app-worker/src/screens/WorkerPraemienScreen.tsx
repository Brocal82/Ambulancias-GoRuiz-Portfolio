import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getMyCompanyPraemienConfig } from "../services/company";
import {
  getMonthlyPraemienSummary,
  getPraemienMonthlyHistory,
  getMyFinalClosureDatesForMonth,
  getMyManualDailyEntriesForMonth,
  putMyManualDailyEntry,
  type ManualDailyEntryDto,
  type MonthlyPraemieHistoryItem,
  type MonthlyPraemienSummaryResponse,
} from "../services/praemien";
import { getAssignedDaysForWorker, getMyWorkdaySummaries } from "../services/workday";

function isManualPhaseActive(params: {
  praemienEnabled: boolean;
  praemienMode: "automatic" | "manual" | null | undefined;
  praemienModeEffectiveFrom: { year: number; month: number } | null | undefined;
  now?: Date;
}): boolean {
  const { praemienEnabled, praemienMode, praemienModeEffectiveFrom, now = new Date() } = params;
  if (!praemienEnabled) return false;
  if (praemienMode !== "manual") return false;
  if (
    !praemienModeEffectiveFrom ||
    typeof praemienModeEffectiveFrom.year !== "number" ||
    typeof praemienModeEffectiveFrom.month !== "number"
  ) {
    return false;
  }
  const from = new Date(
    praemienModeEffectiveFrom.year,
    praemienModeEffectiveFrom.month - 1,
    1,
  );
  from.setHours(0, 0, 0, 0);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return today >= from;
}

function formatMonthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });
}

function dateKeyFromYearMonthDay(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizeDateKey(input?: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  const direct = /^(\d{4}-\d{2}-\d{2})$/.exec(trimmed);
  if (direct) return direct[1] ?? null;
  const iso = /^(\d{4}-\d{2}-\d{2})T/.exec(trimmed);
  if (iso) return iso[1] ?? null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function firstWeekdayMondayBased(year: number, month: number): number {
  const jsDay = new Date(year, month - 1, 1).getDay();
  return (jsDay + 6) % 7;
}

function statusColor(status?: string | null): string {
  if (status === "approved") return "#166534";
  if (status === "rejected") return "#b91c1c";
  if (status === "reopened") return "#92400e";
  if (status === "submitted") return "#0369a1";
  return "#475569";
}

function levelStats(average: number, days: { totalCountedPatients: number }[]) {
  const levels = [7, 8, 9, 10];
  const roundToHalf = (value: number) => Math.round(value * 2) / 2;
  return levels.map((threshold) => {
    let totalDifference = 0;
    for (const day of days) totalDifference += day.totalCountedPatients - threshold;
    const accumulatedDiff = totalDifference;
    const percentage = Math.min(100, Math.max(0, (average / threshold) * 100));
    return {
      threshold,
      averageDiff: roundToHalf(accumulatedDiff),
      isPositive: accumulatedDiff >= 0,
    };
  });
}

function statusLabel(status?: string | null): string {
  if (status === "approved") return "";
  if (status === "rejected") return "Rechazado";
  if (status === "reopened") return "Reabierto";
  if (status === "draft") return "Borrador";
  return "Enviado";
}

type Props = {
  hasPraemienModule: boolean;
  userId: string;
};

export function WorkerPraemienScreen({ hasPraemienModule, userId }: Props) {
  const today = useMemo(() => new Date(), []);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<MonthlyPraemienSummaryResponse | null>(null);
  const [history, setHistory] = useState<MonthlyPraemieHistoryItem[]>([]);
  const [mode, setMode] = useState<"automatic" | "manual" | null>(null);
  const [effectiveFrom, setEffectiveFrom] = useState<{ year: number; month: number } | null>(null);
  const [manualYear, setManualYear] = useState(today.getFullYear());
  const [manualMonth, setManualMonth] = useState(today.getMonth() + 1);
  const [closureDates, setClosureDates] = useState<string[]>([]);
  const [monthEntries, setMonthEntries] = useState<ManualDailyEntryDto[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [manualValueInput, setManualValueInput] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState(0);
  const [assignedDateKeys, setAssignedDateKeys] = useState<string[]>([]);
  const [partialTripsByDate, setPartialTripsByDate] = useState<Record<string, number>>({});

  const manualActive = useMemo(
    () =>
      isManualPhaseActive({
        praemienEnabled: hasPraemienModule,
        praemienMode: mode,
        praemienModeEffectiveFrom: effectiveFrom,
      }),
    [effectiveFrom, hasPraemienModule, mode],
  );

  const loadBase = useCallback(async () => {
    if (!hasPraemienModule) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    try {
      const [cfg, monthlySummary, monthlyHistory] = await Promise.all([
        getMyCompanyPraemienConfig(),
        getMonthlyPraemienSummary(),
        getPraemienMonthlyHistory(),
      ]);
      setMode(cfg.praemienMode ?? null);
      setEffectiveFrom(cfg.praemienModeEffectiveFrom ?? null);
      setSummary(monthlySummary);
      setHistory(monthlyHistory);
      const assigned = await getAssignedDaysForWorker(userId).catch(() => []);
      const keys = assigned
        .map((d) => normalizeDateKey(d.date))
        .filter((x): x is string => Boolean(x));
      setAssignedDateKeys(keys);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo cargar Prämie.");
    } finally {
      setLoading(false);
    }
  }, [hasPraemienModule, userId]);

  const loadManualMonth = useCallback(async () => {
    if (!manualActive) return;
    setErrorMessage(null);
    try {
      const [dates, entries, summaries] = await Promise.all([
        getMyFinalClosureDatesForMonth(manualYear, manualMonth),
        getMyManualDailyEntriesForMonth(manualYear, manualMonth),
        getMyWorkdaySummaries().catch(() => []),
      ]);
      setClosureDates(dates);
      setMonthEntries(entries);
      const monthPrefix = `${manualYear}-${String(manualMonth).padStart(2, "0")}-`;
      const partialMap: Record<string, number> = {};
      summaries
        .filter((s) => !s.isFinalClosure)
        .filter((s) => typeof s.date === "string" && s.date.startsWith(monthPrefix))
        .forEach((s) => {
          const key = s.date;
          const value = typeof s.totalRealTrips === "number" && Number.isFinite(s.totalRealTrips)
            ? s.totalRealTrips
            : 0;
          partialMap[key] = (partialMap[key] ?? 0) + value;
        });
      setPartialTripsByDate(partialMap);
      if (selectedDate && !dates.includes(selectedDate)) {
        setSelectedDate(dates[0] ?? "");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo cargar el mes manual.");
    }
  }, [manualActive, manualMonth, manualYear, selectedDate]);

  useEffect(() => {
    void loadBase();
  }, [loadBase]);

  useEffect(() => {
    void loadManualMonth();
  }, [loadManualMonth]);

  useEffect(() => {
    if (!selectedDate) {
      setManualValueInput("");
      return;
    }
    const entry = monthEntries.find((item) => item.date === selectedDate) ?? null;
    if (entry?.workerSubmittedValue != null) {
      setManualValueInput(String(entry.workerSubmittedValue).replace(".", ","));
    } else {
      setManualValueInput("");
    }
  }, [monthEntries, selectedDate]);

  const entryByDate = useMemo(() => {
    const map = new Map<string, ManualDailyEntryDto>();
    monthEntries.forEach((entry) => map.set(entry.date, entry));
    return map;
  }, [monthEntries]);

  const closureSet = useMemo(() => new Set(closureDates), [closureDates]);
  const selectedEntry = useMemo(
    () => (selectedDate ? entryByDate.get(selectedDate) ?? null : null),
    [entryByDate, selectedDate],
  );
  const selectedPartialTrips = useMemo(
    () => (selectedDate ? partialTripsByDate[selectedDate] ?? 0 : 0),
    [partialTripsByDate, selectedDate],
  );

  const summaryByDate = useMemo(() => {
    const map = new Map<string, number>();
    summary?.monthlyData?.forEach((d) => map.set(d.date, d.totalCountedPatients));
    return map;
  }, [summary]);

  const manualSummaryByDate = useMemo(() => {
    const map = new Map<string, number>();
    monthEntries.forEach((e) => {
      const v = e.status === "approved" && e.adminFinalValue != null ? e.adminFinalValue : e.workerSubmittedValue;
      map.set(e.date, v);
    });
    return map;
  }, [monthEntries]);

  const progressItems = useMemo(() => {
    if (manualActive) {
      const manualDays = monthEntries.map((e) => ({
        totalCountedPatients:
          e.status === "approved" && e.adminFinalValue != null
            ? e.adminFinalValue
            : e.workerSubmittedValue,
      }));
      const avg =
        manualDays.length > 0
          ? manualDays.reduce((acc, d) => acc + d.totalCountedPatients, 0) / manualDays.length
          : 0;
      return levelStats(Math.round(avg * 2) / 2, manualDays);
    }
    const avg = summary?.averagePatients ?? 0;
    const days = summary?.monthlyData ?? [];
    return levelStats(Math.round(avg * 2) / 2, days);
  }, [manualActive, monthEntries, summary]);

  const historyPageSize = 6;
  const historyPages = Math.max(1, Math.ceil(history.length / historyPageSize));
  const paginatedHistory = useMemo(() => {
    const start = historyPage * historyPageSize;
    return history.slice(start, start + historyPageSize);
  }, [history, historyPage]);
  const assignedSet = useMemo(() => new Set(assignedDateKeys), [assignedDateKeys]);

  const onSubmitManual = useCallback(async () => {
    if (!selectedDate) return;
    const normalized = Number(manualValueInput.replace(",", "."));
    if (!Number.isFinite(normalized) || normalized < 0) {
      Alert.alert("Prämie", "Introduce un valor válido (>= 0).");
      return;
    }
    setSaving(true);
    try {
      await putMyManualDailyEntry({
        date: selectedDate,
        workerSubmittedValue: normalized,
        status: "submitted",
      });
      await Promise.all([loadManualMonth(), loadBase()]);
      Alert.alert("Prämie", "Valor enviado correctamente.");
    } catch (error) {
      Alert.alert(
        "Prämie",
        error instanceof Error ? error.message : "No se pudo enviar el valor.",
      );
    } finally {
      setSaving(false);
    }
  }, [loadBase, loadManualMonth, manualValueInput, selectedDate]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadBase();
      if (manualActive) {
        await loadManualMonth();
      }
    } finally {
      setRefreshing(false);
    }
  }, [loadBase, loadManualMonth, manualActive]);

  if (!hasPraemienModule) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Prämie</Text>
        <Text style={styles.muted}>Tu empresa no tiene activo el módulo Prämie.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="small" color="#0f766e" />
        <Text style={styles.muted}>Cargando Prämie...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>
            Prämie <Text style={styles.titleMode}>({manualActive ? "Manual" : "Auto"})</Text>
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.iconButtonRound, pressed && styles.iconButtonRoundPressed]}
          onPress={() => void handleRefresh()}
          disabled={refreshing}
          accessibilityRole="button"
          accessibilityLabel="Refrescar Prämie"
        >
          {({ pressed }) => (
            refreshing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="refresh" size={20} color={pressed ? "#f97316" : "#ffffff"} />
            )
          )}
        </Pressable>
      </View>

      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Resumen por nivel</Text>
        <View style={styles.levelGrid}>
          {progressItems.map((item) => (
            <View key={item.threshold} style={styles.levelCard}>
              <Text style={styles.levelTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                Prämie {item.threshold}
              </Text>
              <View style={styles.levelRow}>
                <Text style={[styles.levelDiff, { color: item.isPositive ? "#059669" : "#dc2626" }]}>
                  {item.isPositive ? "+" : ""}
                  {item.averageDiff}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {manualActive ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Calendario manual</Text>
          <View style={styles.monthNav}>
            <Pressable
              onPress={() => {
                const current = new Date(manualYear, manualMonth - 1, 1);
                current.setMonth(current.getMonth() - 1);
                setManualYear(current.getFullYear());
                setManualMonth(current.getMonth() + 1);
              }}
              style={styles.monthBtn}
            >
              <Text style={styles.monthBtnText}>{"<"}</Text>
            </Pressable>
            <Text style={styles.monthLabel}>{formatMonthLabel(manualYear, manualMonth)}</Text>
            <Pressable
              onPress={() => {
                const current = new Date(manualYear, manualMonth - 1, 1);
                current.setMonth(current.getMonth() + 1);
                setManualYear(current.getFullYear());
                setManualMonth(current.getMonth() + 1);
              }}
              style={styles.monthBtn}
            >
              <Text style={styles.monthBtnText}>{">"}</Text>
            </Pressable>
          </View>

          <View style={styles.weekdaysRow}>
            {["L", "M", "X", "J", "V", "S", "D"].map((x) => (
              <Text key={x} style={styles.weekdayLabel}>
                {x}
              </Text>
            ))}
          </View>
          <View style={styles.calendarGrid}>
            {Array.from({ length: firstWeekdayMondayBased(manualYear, manualMonth) }).map((_, idx) => (
              <View key={`empty-${idx}`} style={styles.dayCellEmpty} />
            ))}
            {Array.from({ length: daysInMonth(manualYear, manualMonth) }).map((_, idx) => {
              const day = idx + 1;
              const key = dateKeyFromYearMonthDay(manualYear, manualMonth, day);
              const isEligible = closureSet.has(key);
              const entry = entryByDate.get(key);
              const selected = selectedDate === key;
              const displayValue = manualSummaryByDate.get(key);
              const pendingEntry = isEligible && !entry;
              return (
                <Pressable
                  key={key}
                  onPress={() =>
                    setSelectedDate((prev) => (prev === key ? "" : key))
                  }
                  style={[
                    styles.dayCell,
                    selected && !pendingEntry && styles.dayCellActive,
                    assignedSet.has(key) && styles.dayCellAssigned,
                    pendingEntry && styles.dayCellPending,
                    pendingEntry && selected && styles.dayCellPendingActive,
                    !isEligible && !entry && styles.dayCellDisabled,
                  ]}
                >
                  <Text style={[styles.dayNumber, selected && styles.dayNumberActive]}>{day}</Text>
                  <Text style={styles.dayTripValue}>{displayValue != null ? displayValue : "—"}</Text>
                  {/* status text oculto en móvil para mantener la celda limpia */}
                </Pressable>
              );
            })}
          </View>

          {closureDates.length === 0 ? (
            <Text style={styles.muted}>No hay días con cierre final en este mes.</Text>
          ) : null}

          {selectedDate && closureSet.has(selectedDate) && !selectedEntry ? (
            <View style={styles.manualEditor}>
              <Text style={styles.inputLabel}>Valor diario ({selectedDate})</Text>
              {selectedPartialTrips > 0 ? (
                <Text style={styles.partialHint}>
                  Parcial acumulado: +{selectedPartialTrips}
                </Text>
              ) : null}
              <View style={styles.manualEditorRow}>
                <TextInput
                  value={manualValueInput}
                  onChangeText={setManualValueInput}
                  keyboardType="decimal-pad"
                  placeholder="Ej. 6,5"
                  style={[styles.input, styles.inputRowFlex]}
                />
                <Pressable
                  onPress={() => void onSubmitManual()}
                  disabled={saving}
                  style={[styles.submitIconBtn, saving && styles.submitBtnDisabled]}
                  accessibilityRole="button"
                  accessibilityLabel="Enviar valor"
                >
                  <Ionicons name="send" size={20} color="#ffffff" />
                </Pressable>
              </View>
              {selectedPartialTrips > 0 ? (
                <Text style={styles.partialTotalHint}>
                  Total a enviar: {manualValueInput.trim() === "" ? "0" : manualValueInput} +{" "}
                  {selectedPartialTrips}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Calendario automático</Text>
          <View style={styles.weekdaysRow}>
            {["L", "M", "X", "J", "V", "S", "D"].map((x) => (
              <Text key={`auto-${x}`} style={styles.weekdayLabel}>
                {x}
              </Text>
            ))}
          </View>
          <View style={styles.calendarGrid}>
            {Array.from({ length: firstWeekdayMondayBased(today.getFullYear(), today.getMonth() + 1) }).map(
              (_, idx) => (
                <View key={`auto-empty-${idx}`} style={styles.dayCellEmpty} />
              ),
            )}
            {Array.from({ length: daysInMonth(today.getFullYear(), today.getMonth() + 1) }).map((_, idx) => {
              const day = idx + 1;
              const key = dateKeyFromYearMonthDay(today.getFullYear(), today.getMonth() + 1, day);
              const value = summaryByDate.get(key);
              return (
                <View
                  key={`auto-day-${key}`}
                  style={[styles.dayCell, assignedSet.has(key) && styles.dayCellAssigned]}
                >
                  <Text style={styles.dayNumber}>{day}</Text>
                  <Text style={styles.dayTripValue}>{value != null ? value : "—"}</Text>
                  <Text style={styles.dayStatusTiny}>{value != null ? "Viajes" : ""}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      <View style={styles.card}>
        <View style={styles.monthNav}>
          <Pressable
            onPress={() => setHistoryPage((p) => Math.max(0, p - 1))}
            disabled={historyPage === 0}
            style={[styles.monthBtn, historyPage === 0 && styles.monthBtnDisabled]}
          >
            <Text style={styles.monthBtnText}>{"<"}</Text>
          </Pressable>
          <Text style={styles.sectionTitle}>
            Histórico mensual ({history.length === 0 ? 0 : historyPage + 1}/{historyPages})
          </Text>
          <Pressable
            onPress={() => setHistoryPage((p) => Math.min(historyPages - 1, p + 1))}
            disabled={historyPage >= historyPages - 1}
            style={[styles.monthBtn, historyPage >= historyPages - 1 && styles.monthBtnDisabled]}
          >
            <Text style={styles.monthBtnText}>{">"}</Text>
          </Pressable>
        </View>
        {paginatedHistory.length === 0 ? (
          <Text style={styles.muted}>Aún no hay histórico disponible.</Text>
        ) : (
          paginatedHistory.map((item) => (
            <View key={`${item.year}-${item.month}`} style={styles.historyRow}>
              <Text style={styles.historyDate}>{formatMonthLabel(item.year, item.month)}</Text>
              <Text style={styles.historyValue}>
                {String(Math.round(item.averagePatients * 100) / 100).replace(".", ",")}
              </Text>
            </View>
          ))
        )}
      </View>

      {errorMessage ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fafc" },
  root: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 16, gap: 12, paddingBottom: 28 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    backgroundColor: "#0f172a",
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  headerTextWrap: { flex: 1, minWidth: 0 },
  card: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
  title: { fontSize: 22, fontWeight: "700", color: "#ffffff" },
  titleMode: { fontSize: 16, fontWeight: "600", color: "#94a3b8" },
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
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  muted: { fontSize: 13, color: "#64748b" },
  levelGrid: { flexDirection: "row", flexWrap: "nowrap", gap: 6 },
  levelCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 4,
    backgroundColor: "#ffffff",
    gap: 3,
  },
  levelTitle: { color: "#0f172a", fontWeight: "700", fontSize: 10, textAlign: "center" },
  levelRow: { alignItems: "center", justifyContent: "center" },
  levelDiff: { fontWeight: "700", fontSize: 14, textAlign: "center" },
  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  monthBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  monthBtnDisabled: { opacity: 0.45 },
  monthBtnText: { color: "#0f766e", fontWeight: "700", fontSize: 17 },
  monthLabel: { flex: 1, textAlign: "center", color: "#334155", fontWeight: "700", fontSize: 14 },
  weekdaysRow: { flexDirection: "row", justifyContent: "space-between" },
  weekdayLabel: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "700", color: "#64748b" },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCellEmpty: {
    width: "14.2857%",
    aspectRatio: 1,
    marginBottom: 6,
  },
  dayCell: {
    width: "14.2857%",
    minHeight: 56,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 3,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  dayCellAssigned: {
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
  },
  dayCellPending: {
    borderColor: "#f97316",
  },
  dayCellPendingActive: {
    borderWidth: 2,
    borderColor: "#ea580c",
    shadowColor: "#ea580c",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  dayCellActive: { borderColor: "#0f766e", backgroundColor: "#f0fdfa" },
  dayCellDisabled: { opacity: 0.45 },
  dayNumber: { fontSize: 10, fontWeight: "700", color: "#334155" },
  dayNumberActive: { color: "#0f766e" },
  dayTripValue: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  dayStatusTiny: { fontSize: 9, fontWeight: "600", color: "#64748b", textAlign: "center" },
  manualEditor: { marginTop: 8, gap: 8 },
  manualEditorRow: { flexDirection: "row", gap: 10, alignItems: "stretch" },
  inputLabel: { color: "#334155", fontSize: 13, fontWeight: "600" },
  partialHint: { color: "#92400e", fontSize: 12, fontWeight: "600" },
  partialTotalHint: { color: "#475569", fontSize: 12, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: "#ffffff",
    color: "#0f172a",
    fontSize: 15,
  },
  inputRowFlex: { flex: 1 },
  submitBtn: {
    backgroundColor: "#0f766e",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitIconBtn: {
    width: 48,
    borderRadius: 10,
    backgroundColor: "#0f766e",
    alignItems: "center",
    justifyContent: "center",
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 8,
  },
  historyDate: { color: "#0f172a", fontSize: 13, fontWeight: "600" },
  historyValue: { color: "#0f766e", fontSize: 14, fontWeight: "700" },
  errorBox: {
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    padding: 10,
  },
  errorText: { color: "#b91c1c", fontSize: 12, fontWeight: "600" },
  warnText: { color: "#92400e", fontSize: 12, fontWeight: "600" },
});

