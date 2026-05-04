import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ApiError } from "../services/http";
import {
  AssignedDay,
  AssignedDayUser,
  WorkdaySummary,
  WorkdayTrip,
  getAssignedDaysForWorker,
  getMyWorkdaySummaries,
  getWorkdayTripsByDate,
} from "../services/workday";
import { AuthUser } from "../types/auth";
import { canStartTripNow } from "../utils/workdayAssignment";
import { WorkerTripStepPanel } from "./WorkerTripStepPanel";

type AssignedDayFull = AssignedDay & {
  driver: { _id: string };
  medic: { _id: string };
};

function userIdFromAssignmentField(value: string | AssignedDayUser | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string") return value.trim() || null;
  const id = value._id?.trim();
  return id || null;
}

function assignmentForTripPanel(day: AssignedDay): AssignedDayFull | null {
  const driverId = userIdFromAssignmentField(day.driver);
  const medicId = userIdFromAssignmentField(day.medic);
  if (!driverId || !medicId) return null;
  return {
    ...day,
    driver: { _id: driverId },
    medic: { _id: medicId },
  };
}

function displayWorkerName(field: string | AssignedDayUser | undefined): string {
  if (field == null) return "—";
  if (typeof field === "string") {
    const t = field.trim();
    if (!t) return "—";
    return t.length > 14 ? `…${t.slice(-10)}` : t;
  }
  const parts = [field.name, field.lastName].filter((p) => (p ?? "").trim()).join(" ");
  return parts.trim() || "—";
}

function displayAmbulanceLine(day: AssignedDay): string {
  if (day.ambulanceNumber?.trim()) return day.ambulanceNumber.trim();
  const amb = day.ambulanceId;
  if (amb && typeof amb === "object") {
    const num = amb.ambulanceNumber?.trim();
    const plate = amb.licensePlate?.trim();
    if (num && plate) return `#${num} · ${plate}`;
    if (num) return `#${num}`;
    if (plate) return plate;
  }
  if (typeof amb === "string" && amb.trim()) return amb.trim();
  return "—";
}

type Props = {
  user: AuthUser;
  /** Chip “jornada en curso” → pantalla completa de cierre (desde WorkerTabsShell). */
  onOpenWorkdayClosure?: () => void;
};

type WorkdayStatus = "no-assignment" | "ready" | "in-progress" | "partial-closed" | "final-closed";

function toDateKey(input?: string): string | null {
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

function todayDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Viajes que suman al contador de “jornada en curso” (incluye Storno con +1). */
function tripCountsTowardWorkdayBanner(trip: WorkdayTrip): boolean {
  return trip.countsTrip !== 0;
}

function summaryStateForAssignment(summaries: WorkdaySummary[], assignmentId: string): WorkdayStatus {
  const sameAssignmentToday = summaries.filter((item) => item.assignmentId === assignmentId);
  const hasFinal = sameAssignmentToday.some((item) => item.isFinalClosure === true);
  if (hasFinal) return "final-closed";
  const hasPartial = sameAssignmentToday.some((item) => item.isFinalClosure === false);
  if (hasPartial) return "partial-closed";
  return "ready";
}

export function WorkerWorkdayScreen({ user, onOpenWorkdayClosure }: Props) {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [todayAssignment, setTodayAssignment] = useState<AssignedDay | null>(null);
  const [todayTrips, setTodayTrips] = useState<WorkdayTrip[]>([]);
  /** Solo cierres de hoy para la asignacion actual: alimenta el chip de estado (no se listan en pantalla). */
  const [recentSummaries, setRecentSummaries] = useState<WorkdaySummary[]>([]);
  const loadWorkday = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    if (!silent) {
      setIsLoading(true);
    }
    setErrorMessage(undefined);
    try {
      const today = todayDateKey();
      const [assignedDays, trips, summaries] = await Promise.all([
        getAssignedDaysForWorker(user._id),
        getWorkdayTripsByDate(today),
        getMyWorkdaySummaries(),
      ]);

      const assignment = assignedDays.find((item) => toDateKey(item.date) === today) ?? null;
      const summariesSorted = [...summaries].sort((a, b) => b.date.localeCompare(a.date));
      const summariesForTodayStatus =
        assignment == null
          ? []
          : summariesSorted.filter(
              (s) => toDateKey(s.date) === today && s.assignmentId === assignment.assignmentId,
            );

      setTodayAssignment(assignment);
      setTodayTrips(trips);
      setRecentSummaries(summariesForTodayStatus);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("No se pudo cargar Mi Jornada.");
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, [user._id]);

  useEffect(() => {
    void loadWorkday();
  }, [loadWorkday]);

  const todayStatus = useMemo<WorkdayStatus>(() => {
    if (!todayAssignment) return "no-assignment";
    const summaryState = summaryStateForAssignment(
      recentSummaries,
      todayAssignment.assignmentId,
    );
    if (summaryState === "final-closed") return "final-closed";
    if (summaryState === "partial-closed") return "partial-closed";
    if (todayTrips.length > 0) return "in-progress";
    return "ready";
  }, [todayAssignment, todayTrips.length, recentSummaries]);

  const tripPanelAssignment = useMemo(
    () => (todayAssignment ? assignmentForTripPanel(todayAssignment) : null),
    [todayAssignment],
  );

  const tripsCountForBanner = useMemo(
    () => todayTrips.filter(tripCountsTowardWorkdayBanner).length,
    [todayTrips],
  );

  const canStartWork = useMemo(() => {
    if (!todayAssignment) return false;
    return canStartTripNow(todayAssignment.startTime, todayAssignment.date);
  }, [todayAssignment]);

  const tripsBlocked = todayStatus === "final-closed";

  const statusLabel = useMemo(() => {
    switch (todayStatus) {
      case "no-assignment":
        return "Sin asignacion para hoy";
      case "ready":
        return "Asignado, sin viajes registrados";
      case "in-progress":
        return "Jornada en curso";
      case "partial-closed":
        return "Cierre parcial enviado";
      case "final-closed":
        return "Jornada cerrada (final)";
      default:
        return "Estado no disponible";
    }
  }, [todayStatus]);

  const headerAssignmentBlock = useMemo(() => {
    if (isLoading) {
      return <Text style={styles.headerMetaMuted}>Cargando asignacion…</Text>;
    }
    if (errorMessage) {
      return null;
    }
    if (!todayAssignment) {
      return <Text style={styles.headerMetaMuted}>Sin asignacion para hoy.</Text>;
    }
    const dienstNum =
      todayAssignment.dienstNumber != null && String(todayAssignment.dienstNumber).trim() !== ""
        ? String(todayAssignment.dienstNumber).trim()
        : "—";

    return (
      <View style={styles.headerMeta}>
        <View style={styles.headerThreeColRow}>
          <View style={[styles.headerCol, styles.headerColLeft]}>
            <Text style={styles.headerColLabel}>Dienst</Text>
            <Text style={styles.headerDienstNumber} numberOfLines={1}>
              {dienstNum === "—" ? "—" : `#${dienstNum}`}
            </Text>
            <Text style={styles.headerSchedule} numberOfLines={1}>
              {todayAssignment.startTime ?? "--:--"} – {todayAssignment.endTime ?? "--:--"}
            </Text>
          </View>

          <View style={[styles.headerCol, styles.headerColCenter]}>
            <Text style={[styles.headerColLabel, styles.headerColLabelCenter]}>Team</Text>
            <Text
              style={[styles.headerTeamName, styles.headerTeamNameCenter]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {displayWorkerName(todayAssignment.driver)}
            </Text>
            <Text
              style={[styles.headerTeamName, styles.headerTeamNameCenter]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {displayWorkerName(todayAssignment.medic)}
            </Text>
          </View>

          <View style={[styles.headerCol, styles.headerColRight]}>
            <Text style={[styles.headerColLabel, styles.headerColLabelRight]}>Ambulancia</Text>
            <Text style={styles.headerAmbValue} numberOfLines={3}>
              {displayAmbulanceLine(todayAssignment)}
            </Text>
          </View>
        </View>
      </View>
    );
  }, [errorMessage, isLoading, todayAssignment]);

  const showHeaderTripCountChip =
    !isLoading && !errorMessage && todayAssignment && todayStatus === "in-progress";

  return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View style={styles.headerTitleCluster}>
              <Text style={styles.title} numberOfLines={1}>
                Mi Jornada
              </Text>
              {showHeaderTripCountChip ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.headerTripCountChip,
                    pressed ? styles.headerTripCountChipPressed : null,
                  ]}
                  onPress={() => onOpenWorkdayClosure?.()}
                  accessibilityRole="button"
                  accessibilityLabel={`${tripsCountForBanner} viajes — abrir cierre de jornada`}
                  hitSlop={6}
                >
                  <Text style={styles.headerTripCountText}>{tripsCountForBanner}</Text>
                </Pressable>
              ) : null}
            </View>
            <Pressable
              style={({ pressed }) => [styles.refreshFab, pressed ? styles.refreshFabPressed : null]}
              onPress={() => void loadWorkday()}
              accessibilityRole="button"
              accessibilityLabel="Refrescar"
              hitSlop={6}
            >
              <Ionicons name="refresh" size={22} color="#334155" />
            </Pressable>
          </View>
          {headerAssignmentBlock}
        </View>

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#0f766e" />
          <Text style={styles.centerText}>Cargando jornada...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.centerState}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <Pressable style={styles.retryButton} onPress={() => void loadWorkday()}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.mainColumn}>
          <View style={styles.topSection}>
            {todayAssignment && tripPanelAssignment ? (
              <View style={styles.tripPanelShell}>
                <WorkerTripStepPanel
                  assignedDay={tripPanelAssignment}
                  canStartWork={canStartWork}
                  blocked={tripsBlocked}
                  onTripCreated={() => void loadWorkday({ silent: true })}
                />
              </View>
            ) : todayAssignment && !tripPanelAssignment ? (
              <View style={styles.card}>
                <Text style={styles.hintText}>
                  La asignacion de hoy no incluye conductor y medico identificados; no se puede registrar
                  un viaje desde la app.
                </Text>
              </View>
            ) : null}

            {todayStatus !== "in-progress" ? (
              <View style={[styles.cardCompact, styles.workdayStatusBelowForm]}>
                <Text style={styles.statusOneLine}>
                  {todayAssignment
                    ? `${statusLabel} · ${tripsCountForBanner} viaje(s)`
                    : statusLabel}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      )}
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
    paddingTop: 8,
    paddingBottom: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerTitleCluster: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
    gap: 8,
  },
  title: {
    flexShrink: 1,
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
  },
  headerTripCountChip: {
    height: 32,
    minWidth: 36,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    flexShrink: 0,
  },
  headerTripCountChipPressed: {
    opacity: 0.9,
    backgroundColor: "#d1fae5",
  },
  headerTripCountText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#047857",
    fontVariant: ["tabular-nums"],
  },
  refreshFab: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    flexShrink: 0,
  },
  refreshFabPressed: {
    backgroundColor: "#f1f5f9",
    opacity: 0.92,
  },
  headerMeta: {
    gap: 0,
  },
  headerThreeColRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  headerCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  headerColLeft: {
    alignItems: "flex-start",
  },
  headerColCenter: {
    alignItems: "center",
  },
  headerColRight: {
    alignItems: "flex-end",
  },
  headerColLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748b",
    alignSelf: "stretch",
  },
  headerColLabelCenter: {
    textAlign: "center",
  },
  headerColLabelRight: {
    textAlign: "right",
  },
  headerDienstNumber: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0f172a",
    alignSelf: "stretch",
  },
  headerSchedule: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
    lineHeight: 15,
    fontVariant: ["tabular-nums"],
    alignSelf: "stretch",
  },
  headerTeamName: {
    fontSize: 11,
    fontWeight: "600",
    color: "#334155",
    lineHeight: 14,
    alignSelf: "stretch",
  },
  headerTeamNameCenter: {
    textAlign: "center",
  },
  headerAmbValue: {
    fontSize: 11,
    fontWeight: "600",
    color: "#334155",
    lineHeight: 15,
    textAlign: "right",
    alignSelf: "stretch",
  },
  headerMetaMuted: {
    fontSize: 11,
    color: "#94a3b8",
    lineHeight: 15,
  },
  centerState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 24,
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
  mainColumn: {
    flex: 1,
  },
  topSection: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 16,
    paddingTop: 0,
    gap: 8,
  },
  tripPanelShell: {
    flex: 1,
    minHeight: 0,
    width: "100%",
  },
  workdayStatusBelowForm: {
    flexShrink: 0,
    alignSelf: "stretch",
  },
  card: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  cardCompact: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  cardCompactExpandable: {
    gap: 6,
    alignSelf: "stretch",
    width: "100%",
  },
  statusHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusOneLine: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  dropdownChevron: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "700",
    width: 18,
    textAlign: "center",
  },
  tripsDropdownList: {
    alignSelf: "stretch",
    width: "100%",
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  tripGridRow: {
    flexDirection: "row",
    alignItems: "stretch",
    alignSelf: "stretch",
    width: "100%",
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  tripColAuf: {
    flex: 1.1,
    minWidth: 0,
    justifyContent: "center",
  },
  tripColPat: {
    flex: 1.2,
    minWidth: 0,
    justifyContent: "center",
  },
  tripColMin: {
    width: 64,
    flexShrink: 0,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  tripColKm: {
    width: 64,
    flexShrink: 0,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  tripCellText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#334155",
    lineHeight: 15,
  },
  tripCellStorno: {
    color: "#be123c",
  },
  tripStornoBadge: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: "700",
    color: "#be123c",
    letterSpacing: 0.2,
  },
  tripMetricText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0f172a",
    lineHeight: 16,
    fontVariant: ["tabular-nums"],
    textAlign: "right",
    width: "100%",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  statusText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f766e",
  },
  detailsList: {
    gap: 4,
  },
  detailLine: {
    color: "#475569",
    fontSize: 13,
  },
  hintText: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 18,
  },
});
