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
import { parseHHMM } from "../utils/tripValidators";
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

function tripKmForDisplay(trip: WorkdayTrip): string {
  if (typeof trip.totalKm === "number" && !Number.isNaN(trip.totalKm)) {
    return String(Math.round(trip.totalKm));
  }
  const ks = typeof trip.kmStart === "number" && !Number.isNaN(trip.kmStart) ? trip.kmStart : null;
  const ke = typeof trip.kmEnd === "number" && !Number.isNaN(trip.kmEnd) ? trip.kmEnd : null;
  if (ks != null && ke != null && ke >= ks) {
    return String(Math.round(ke - ks));
  }
  return "—";
}

/** Duración del viaje: primer aviso (timeWarning o timeAtHome) hasta cierre (timeEnd HH:MM o timeArrival si timeEnd no es hora). */
function tripDurationMinutes(trip: WorkdayTrip): number | null {
  const candidatesStart = [trip.timeWarning, trip.timeAtHome];
  let startStr: string | undefined;
  for (const c of candidatesStart) {
    const t = c?.trim();
    if (t && !Number.isNaN(parseHHMM(t))) {
      startStr = t;
      break;
    }
  }
  if (!startStr) return null;

  const te = trip.timeEnd?.trim();
  let endStr: string | undefined;
  if (te && !Number.isNaN(parseHHMM(te))) {
    endStr = te;
  } else {
    const ta = trip.timeArrival?.trim();
    if (ta && !Number.isNaN(parseHHMM(ta))) {
      endStr = ta;
    }
  }
  if (!endStr) return null;

  const startMin = parseHHMM(startStr);
  const endMin = parseHHMM(endStr);
  if (Number.isNaN(startMin) || Number.isNaN(endMin)) return null;
  let delta = endMin - startMin;
  if (delta < 0) {
    delta += 24 * 60;
  }
  return delta;
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
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [todayAssignment, setTodayAssignment] = useState<AssignedDay | null>(null);
  const [todayTrips, setTodayTrips] = useState<WorkdayTrip[]>([]);
  /** Solo cierres de hoy para la asignacion actual: alimenta el chip de estado (no se listan en pantalla). */
  const [recentSummaries, setRecentSummaries] = useState<WorkdaySummary[]>([]);
  const [tripsDropdownOpen, setTripsDropdownOpen] = useState(false);

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
      setIsLoading(false);
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

  useEffect(() => {
    if (todayTrips.length === 0 || todayStatus !== "in-progress") {
      setTripsDropdownOpen(false);
    }
  }, [todayTrips.length, todayStatus]);

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
    return (
      <View style={styles.headerMeta}>
        <Text style={styles.headerMetaLine}>
          Conductor: {displayWorkerName(todayAssignment.driver)}
        </Text>
        <Text style={styles.headerMetaLine}>
          Sanitario: {displayWorkerName(todayAssignment.medic)}
        </Text>
        <Text style={styles.headerMetaLine}>
          Dienst #{todayAssignment.dienstNumber ?? "—"} · {todayAssignment.startTime ?? "--:--"} –{" "}
          {todayAssignment.endTime ?? "--:--"}
        </Text>
        <Text style={styles.headerMetaLine}>Ambulancia: {displayAmbulanceLine(todayAssignment)}</Text>
      </View>
    );
  }, [errorMessage, isLoading, todayAssignment]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={styles.title} numberOfLines={1}>
            Mi Jornada
          </Text>
          <Pressable style={styles.refreshButton} onPress={() => void loadWorkday()} hitSlop={8}>
            <Text style={styles.refreshButtonText}>Refrescar</Text>
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
            {todayAssignment && todayStatus === "in-progress" ? (
              <Pressable
                style={[styles.cardCompact, styles.cardCompactExpandable]}
                onPress={() => setTripsDropdownOpen((open) => !open)}
                accessibilityRole="button"
                accessibilityLabel={
                  tripsDropdownOpen ? "Ocultar lista de viajes de hoy" : "Ver lista de viajes de hoy"
                }
              >
                <View style={styles.statusHeaderRow}>
                  <Text style={styles.statusOneLine} numberOfLines={1}>
                    {`${statusLabel} · ${todayTrips.length} viaje(s)`}
                  </Text>
                  <Text style={styles.dropdownChevron}>{tripsDropdownOpen ? "▲" : "▼"}</Text>
                </View>
                {tripsDropdownOpen ? (
                  <View style={styles.tripsDropdownList}>
                    {todayTrips.map((trip) => {
                      const auf = (trip.auftragNumber ?? "").trim() || "—";
                      const pat = (trip.patientName ?? "").trim() || "—";
                      const dur = tripDurationMinutes(trip);
                      const km = tripKmForDisplay(trip);
                      const statsLine =
                        dur != null ? `${dur} min · ${km} km` : `— min · ${km} km`;
                      return (
                        <View key={trip._id} style={styles.tripGridRow}>
                          <View style={styles.tripColAuf}>
                            <Text style={styles.tripCellText} numberOfLines={2} ellipsizeMode="tail">
                              {auf}
                            </Text>
                          </View>
                          <View style={styles.tripColPat}>
                            <Text style={styles.tripCellText} numberOfLines={2} ellipsizeMode="tail">
                              {pat}
                            </Text>
                          </View>
                          <View style={styles.tripColStats}>
                            <Text style={styles.tripStatsLine} numberOfLines={1} ellipsizeMode="tail">
                              {statsLine}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </Pressable>
            ) : (
              <View style={styles.cardCompact}>
                <Text style={styles.statusOneLine}>
                  {todayAssignment ? `${statusLabel} · ${todayTrips.length} viaje(s)` : statusLabel}
                </Text>
              </View>
            )}

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
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
  },
  refreshButton: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#ffffff",
    flexShrink: 0,
  },
  refreshButtonText: {
    color: "#334155",
    fontWeight: "700",
    fontSize: 12,
  },
  headerMeta: {
    gap: 3,
  },
  headerMetaLine: {
    fontSize: 11,
    color: "#475569",
    lineHeight: 15,
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
  tripColStats: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  tripCellText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#334155",
    lineHeight: 15,
  },
  tripStatsLine: {
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
