import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
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

type Props = {
  user: AuthUser;
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

function summaryStateForAssignment(summaries: WorkdaySummary[], assignmentId: string): WorkdayStatus {
  const sameAssignmentToday = summaries.filter((item) => item.assignmentId === assignmentId);
  const hasFinal = sameAssignmentToday.some((item) => item.isFinalClosure === true);
  if (hasFinal) return "final-closed";
  const hasPartial = sameAssignmentToday.some((item) => item.isFinalClosure === false);
  if (hasPartial) return "partial-closed";
  return "ready";
}

export function WorkerWorkdayScreen({ user }: Props) {
  const { height: windowHeight } = useWindowDimensions();
  const bottomPanelMaxHeight = Math.min(260, Math.round(windowHeight * 0.3));

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [todayAssignment, setTodayAssignment] = useState<AssignedDay | null>(null);
  const [todayTrips, setTodayTrips] = useState<WorkdayTrip[]>([]);
  const [recentSummaries, setRecentSummaries] = useState<WorkdaySummary[]>([]);

  const loadWorkday = useCallback(async () => {
    setIsLoading(true);
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

      setTodayAssignment(assignment);
      setTodayTrips(trips);
      setRecentSummaries(summariesSorted.slice(0, 8));
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("No se pudo cargar Mi Jornada.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [user._id]);

  useEffect(() => {
    void loadWorkday();
  }, [loadWorkday]);

  const todayStatus = useMemo<WorkdayStatus>(() => {
    if (!todayAssignment) return "no-assignment";
    const today = todayDateKey();
    const todaySummariesForAssignment = recentSummaries.filter(
      (item) => toDateKey(item.date) === today && item.assignmentId === todayAssignment.assignmentId,
    );
    const summaryState = summaryStateForAssignment(
      todaySummariesForAssignment,
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Mi Jornada</Text>
        <Text style={styles.subtitle}>Estado operativo de hoy</Text>
        <Pressable style={styles.refreshButton} onPress={() => void loadWorkday()}>
          <Text style={styles.refreshButtonText}>Refrescar</Text>
        </Pressable>
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
            <View style={styles.cardCompact}>
              <Text style={styles.statusOneLine}>
                {todayAssignment
                  ? `${statusLabel} · Dienst #${todayAssignment.dienstNumber ?? "-"} · ${todayTrips.length} viajes`
                  : statusLabel}
              </Text>
            </View>

            {todayAssignment && tripPanelAssignment ? (
              <View style={styles.tripPanelShell}>
                <WorkerTripStepPanel
                  assignedDay={tripPanelAssignment}
                  canStartWork={canStartWork}
                  blocked={tripsBlocked}
                  onTripCreated={() => void loadWorkday()}
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
          </View>

          <View style={styles.bottomPanel}>
            <ScrollView
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              style={[styles.bottomPanelScroll, { maxHeight: bottomPanelMaxHeight }]}
              contentContainerStyle={styles.bottomPanelScrollContent}
              showsVerticalScrollIndicator
            >
              <View style={styles.bottomCard}>
                <Text style={styles.bottomSectionTitle}>Viajes de hoy (no cerrados)</Text>
                {todayTrips.length === 0 ? (
                  <Text style={styles.emptyText}>Ninguno. Los guardados aqui aparecen al refrescar.</Text>
                ) : (
                  todayTrips.map((trip) => (
                    <View key={trip._id} style={styles.tripRow}>
                      <View style={styles.summaryLeft}>
                        <Text style={styles.summaryDate} numberOfLines={1}>
                          {trip.patientName?.trim() || "Paciente"} · Auf. {trip.auftragNumber?.trim() || "—"}
                        </Text>
                        <Text style={styles.summaryMeta} numberOfLines={1}>
                          {trip.wasCancelled ? "Cancelado · " : ""}
                          {trip.timeWarning ? `Aviso ${trip.timeWarning}` : "Sin hora aviso"}
                          {trip.timeEnd ? ` → Fin ${trip.timeEnd}` : ""}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>

              <View style={[styles.bottomCard, styles.bottomCardSpaced]}>
                <Text style={styles.bottomSectionTitle}>Cierres de jornada</Text>
                <Text style={styles.bottomSectionHint}>Cierres parciales o finales ya enviados al servidor.</Text>
                {recentSummaries.length === 0 ? (
                  <Text style={styles.emptyText}>Sin cierres registrados aun.</Text>
                ) : (
                  recentSummaries.map((item) => {
                    const asgTail =
                      item.assignmentId && item.assignmentId.length >= 8
                        ? ` · …${item.assignmentId.slice(-6)}`
                        : item.assignmentId
                          ? ` · ${item.assignmentId}`
                          : "";
                    return (
                      <View key={item._id} style={styles.summaryRow}>
                        <View style={styles.summaryLeft}>
                          <Text style={styles.summaryDate}>{item.date}</Text>
                          <Text style={styles.summaryMeta}>
                            {item.isFinalClosure ? "Cierre final" : "Cierre parcial"} · Viajes:{" "}
                            {item.totalRealTrips ?? 0}
                            {asgTail}
                          </Text>
                        </View>
                        <Text style={styles.summaryKm}>{item.totalDienstKm ?? 0} km</Text>
                      </View>
                    );
                  })
                )}
              </View>
            </ScrollView>
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
    paddingTop: 10,
    paddingBottom: 8,
    gap: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
  },
  refreshButton: {
    marginTop: 6,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#ffffff",
  },
  refreshButtonText: {
    color: "#334155",
    fontWeight: "700",
    fontSize: 12,
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
  bottomPanel: {
    flexShrink: 0,
    flexGrow: 0,
    width: "100%",
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 8,
  },
  bottomPanelScroll: {
    flexGrow: 0,
  },
  bottomPanelScrollContent: {
    paddingBottom: 8,
    gap: 10,
  },
  bottomCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  bottomCardSpaced: {
    marginTop: 2,
  },
  bottomSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  bottomSectionHint: {
    fontSize: 11,
    color: "#64748b",
    lineHeight: 15,
  },
  tripRow: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 8,
    backgroundColor: "#f8fafc",
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
  statusOneLine: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
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
  emptyText: {
    color: "#64748b",
    fontSize: 13,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#f8fafc",
  },
  summaryLeft: {
    flex: 1,
    gap: 2,
  },
  summaryDate: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "700",
  },
  summaryMeta: {
    color: "#64748b",
    fontSize: 12,
  },
  summaryKm: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "700",
  },
});
