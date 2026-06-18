import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { getDienstsByUser } from "../services/diensts";
import { getMyExcelPlanningWeek } from "../services/excelPlanning";
import { ApiError } from "../services/http";
import { AuthUser, ScheduleSource } from "../types/auth";
import { getMyVacationRequests, VacationRequestItem } from "../services/vacations";
import { getMySickLeaves, SickLeaveItem } from "../services/sickLeaves";
import { isAssignmentForUser, userIdFromAssignmentField } from "../utils/assignmentUserId";

type Props = {
  user: AuthUser;
  scheduleSource: ScheduleSource;
  hasVacationModule: boolean;
  hasSickLeavesModule: boolean;
  initialDate?: string;
  agendaWsTrigger?: number;
};

type DayScheduleItem = {
  dienstId: string;
  dienstName: string;
  dienstNumberLabel: string;
  startTime: string;
  endTime: string;
  workerRole: "driver" | "medic" | "driver/medic";
  ambulanceLabel: string;
  driverLabel: string;
  medicLabel: string;
};

type WeekDay = {
  dateKey: string;
  label: string;
  dayNumber: string;
  isToday: boolean;
  items: DayScheduleItem[];
};

const DAY_NAMES = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

function toIsoDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeDateKey(value?: string): string | null {
  if (!value) return null;
  const direct = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (direct) return value.trim();

  // Backend can return ISO strings; keep only calendar date.
  const isoPrefix = /^(\d{4}-\d{2}-\d{2})T/.exec(value.trim());
  if (isoPrefix) return isoPrefix[1] ?? null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return toIsoDateKey(parsed);
}

function addDaysToDateKey(baseDateKey: string, days: number): string {
  const [y, m, d] = baseDateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate(),
  ).padStart(2, "0")}`;
}

function startOfWeekMonday(input: Date): Date {
  const date = new Date(input);
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diffToMonday);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return `${monday.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
  })} - ${sunday.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" })}`;
}

function normalizeAmbulanceLabel(value: unknown): string {
  if (!value) return "N/A";
  if (typeof value === "string") {
    // Raw ObjectId from unpopulated backend data should not be rendered to workers.
    return /^[0-9a-fA-F]{24}$/.test(value) ? "N/A" : value;
  }
  if (typeof value === "object" && value !== null) {
    const maybeNumber = (value as { ambulanceNumber?: string }).ambulanceNumber;
    const maybePlate = (value as { licensePlate?: string }).licensePlate;
    return maybeNumber ?? maybePlate ?? "N/A";
  }
  return "N/A";
}


function normalizeUserLabel(value: unknown): string {
  if (!value) return "Sin asignar";
  if (typeof value === "string") return "Asignado";
  if (typeof value === "object" && value !== null) {
    const maybeName = (value as { name?: string }).name ?? "";
    const maybeLastName = (value as { lastName?: string }).lastName ?? "";
    const fullName = `${maybeName} ${maybeLastName}`.trim();
    return fullName.length > 0 ? fullName : "Asignado";
  }
  return "Asignado";
}

function toMinuteOfDay(hhmm: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!match) return 24 * 60 + 1;
  const [, h, m] = match;
  return Number(h) * 60 + Number(m);
}

function parseExcelTimeRange(text?: string): { start?: string; end?: string } {
  const value = text?.trim();
  if (!value) return {};
  const parts = value.split(/\s*[-–—]\s*/);
  if (parts.length >= 2) {
    return { start: parts[0]?.trim(), end: parts[parts.length - 1]?.trim() };
  }
  return {};
}

function resolveExcelDriverMedicLabels(row: {
  displayNameFromExcel?: string;
  displayPartnerNameFromExcel?: string;
  primaryAmbulanceRole?: "driver" | "medic" | "both";
  partnerAmbulanceRole?: "driver" | "medic" | "both";
}): { driverLabel: string; medicLabel: string } {
  const primary = row.displayNameFromExcel?.trim() ?? "";
  const partner = row.displayPartnerNameFromExcel?.trim() ?? "";
  const pr = row.primaryAmbulanceRole;
  const xr = row.partnerAmbulanceRole;

  if (!partner) {
    if (pr === "medic") {
      return { driverLabel: "Sin asignar", medicLabel: primary || "Sin asignar" };
    }
    return { driverLabel: primary || "Sin asignar", medicLabel: "Sin asignar" };
  }

  if (pr === "medic" && xr === "driver") {
    return { driverLabel: partner, medicLabel: primary || "Sin asignar" };
  }
  if (pr === "driver" && xr === "medic") {
    return { driverLabel: primary || "Sin asignar", medicLabel: partner };
  }
  if (pr === "medic") {
    return { driverLabel: partner, medicLabel: primary || "Sin asignar" };
  }
  return { driverLabel: primary || "Sin asignar", medicLabel: partner };
}

function isDateInRange(dateKey: string, startDate: string, endDate: string): boolean {
  // Parse via local device date so Berlin UTC timestamps map to the correct calendar day.
  const start = toIsoDateKey(new Date(startDate));
  const end = toIsoDateKey(new Date(endDate));
  return dateKey >= start && dateKey <= end;
}

function getEmptyDayStatus(
  dateKey: string,
  sick: SickLeaveItem[],
  vacations: VacationRequestItem[],
): "sick" | "vacation" | "libre" {
  if (
    sick.some(
      (s) =>
        (s.status === "accepted" || s.status === "pending") &&
        isDateInRange(dateKey, s.startDate, s.endDate),
    )
  )
    return "sick";
  if (
    vacations.some(
      (v) => v.status === "accepted" && isDateInRange(dateKey, v.startDate, v.endDate),
    )
  )
    return "vacation";
  return "libre";
}

export function WorkerAgendaScreen({
  user,
  scheduleSource,
  hasVacationModule,
  hasSickLeavesModule,
  initialDate,
  agendaWsTrigger,
}: Props) {
  const [weekStart, setWeekStart] = useState<Date>(() => {
    if (initialDate) {
      const parsed = new Date(initialDate);
      if (!Number.isNaN(parsed.getTime())) return startOfWeekMonday(parsed);
    }
    return startOfWeekMonday(new Date());
  });
  const [hasManualWeekSelection, setHasManualWeekSelection] = useState(false);
  const [allSchedulesByDate, setAllSchedulesByDate] = useState<Record<string, DayScheduleItem[]>>(
    {},
  );
  const [isWeekPublished, setIsWeekPublished] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [vacationItems, setVacationItems] = useState<VacationRequestItem[]>([]);
  const [sickLeaveItems, setSickLeaveItems] = useState<SickLeaveItem[]>([]);

  const sortSchedulesByTime = (byDate: Record<string, DayScheduleItem[]>) => {
    for (const [dateKey, items] of Object.entries(byDate)) {
      byDate[dateKey] = items.sort(
        (a, b) => toMinuteOfDay(a.startTime) - toMinuteOfDay(b.startTime),
      );
    }
  };

  const loadDynamicAgenda = async (): Promise<Record<string, DayScheduleItem[]>> => {
    const byDate: Record<string, DayScheduleItem[]> = {};
    const diensts = await getDienstsByUser(user._id);
    for (const dienst of diensts) {
      const dienstName = dienst.name ?? "Dienst";
      const dienstNumberLabel =
        typeof dienst.dienstNumber === "number"
          ? `#${dienst.dienstNumber}`
          : "#-";
      for (const assignment of dienst.assignments ?? []) {
        if (!isAssignmentForUser(assignment, user._id)) continue;
        const assignmentDateKey = normalizeDateKey(assignment.date);
        if (!assignmentDateKey) continue;
        const item: DayScheduleItem = {
          dienstId: dienst._id,
          dienstName,
          dienstNumberLabel,
          startTime: assignment.startTime ?? "--:--",
          endTime: assignment.endTime ?? "--:--",
          workerRole: "driver/medic",
          ambulanceLabel: normalizeAmbulanceLabel(assignment.ambulanceId),
          driverLabel: normalizeUserLabel(assignment.driver),
          medicLabel: normalizeUserLabel(assignment.medic),
        };

        const driverId = userIdFromAssignmentField(assignment.driver);
        const medicId = userIdFromAssignmentField(assignment.medic);
        if (driverId === user._id && medicId === user._id) {
          item.workerRole = "driver/medic";
        } else if (driverId === user._id) {
          item.workerRole = "driver";
        } else if (medicId === user._id) {
          item.workerRole = "medic";
        }

        byDate[assignmentDateKey] = [...(byDate[assignmentDateKey] ?? []), item];
      }
    }
    return byDate;
  };

  const loadAgenda = async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    if (!silent) {
      setIsLoading(true);
    }
    setErrorMessage(undefined);
    try {
      if (scheduleSource === "none") {
        setAllSchedulesByDate({});
        setIsWeekPublished(false);
        setErrorMessage("Tu empresa no tiene modulo de agenda activo.");
        return;
      }

      const byDate: Record<string, DayScheduleItem[]> = {};

      if (scheduleSource === "dynamic") {
        setIsWeekPublished(true);
        const dynamicByDate = await loadDynamicAgenda();
        Object.assign(byDate, dynamicByDate);
      } else {
        const selectedWeekKey = toIsoDateKey(weekStart);
        const excel = await getMyExcelPlanningWeek(
          hasManualWeekSelection ? selectedWeekKey : undefined,
        );
        setIsWeekPublished(Boolean(excel.published));
        const apiWeekKey = normalizeDateKey(String(excel.weekStart)) ?? selectedWeekKey;
        if (!hasManualWeekSelection && excel.weekStart) {
          const resolvedWeekStart = startOfWeekMonday(new Date(excel.weekStart));
          if (toIsoDateKey(resolvedWeekStart) !== toIsoDateKey(weekStart)) {
            setWeekStart(resolvedWeekStart);
          }
        }
        for (const row of excel.rows ?? []) {
          const rowDateKey =
            typeof row.dayIndex === "number" && row.dayIndex >= 0 && row.dayIndex <= 6
              ? addDaysToDateKey(apiWeekKey, row.dayIndex)
              : normalizeDateKey(row.dayDate);
          if (!rowDateKey) continue;
          const { start, end } = parseExcelTimeRange(row.timeText);
          const labels = resolveExcelDriverMedicLabels(row);
          const item: DayScheduleItem = {
            dienstId: `${rowDateKey}-${row.dienstNumber ?? "excel"}`,
            dienstName: "Dienst Excel",
            dienstNumberLabel: row.dienstNumber ? `#${row.dienstNumber}` : "#-",
            startTime: start ?? "--:--",
            endTime: end ?? "--:--",
            workerRole:
              row.primaryAmbulanceRole === "both"
                ? "driver/medic"
                : row.primaryAmbulanceRole === "medic"
                  ? "medic"
                  : "driver",
            ambulanceLabel: row.vehicleCode ?? "Sin ambulancia",
            driverLabel: labels.driverLabel,
            medicLabel: labels.medicLabel,
          };
          byDate[rowDateKey] = [...(byDate[rowDateKey] ?? []), item];
        }
      }

      sortSchedulesByTime(byDate);

      setAllSchedulesByDate(byDate);
    } catch (error) {
      const shouldFallbackToDynamic =
        scheduleSource === "excel" &&
        error instanceof ApiError &&
        /excel-planning/i.test(error.message) &&
        /(habilitad|enabled)/i.test(error.message);

      if (shouldFallbackToDynamic) {
        try {
          setIsWeekPublished(true);
          const dynamicByDate = await loadDynamicAgenda();
          sortSchedulesByTime(dynamicByDate);
          setAllSchedulesByDate(dynamicByDate);
          setErrorMessage(undefined);
          return;
        } catch {
          // Keep original module error below if dynamic fallback also fails.
        }
      }

      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("No se pudo cargar la agenda.");
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  };

  const prevAgendaWsTrigger = useRef(agendaWsTrigger);
  useEffect(() => {
    if (agendaWsTrigger === undefined || agendaWsTrigger === prevAgendaWsTrigger.current) {
      return;
    }
    prevAgendaWsTrigger.current = agendaWsTrigger;
    void loadAgenda({ silent: true });
  }, [agendaWsTrigger]);

  useEffect(() => {
    void loadAgenda();
  }, [scheduleSource, weekStart]);

  useEffect(() => {
    if (hasVacationModule) {
      getMyVacationRequests().then(setVacationItems).catch(() => setVacationItems([]));
    }
    if (hasSickLeavesModule) {
      getMySickLeaves().then(setSickLeaveItems).catch(() => setSickLeaveItems([]));
    }
  }, [hasVacationModule, hasSickLeavesModule]);

  const weekDays = useMemo<WeekDay[]>(() => {
    const todayKey = toIsoDateKey(new Date());
    return DAY_NAMES.map((dayName, index) => {
      const current = new Date(weekStart);
      current.setDate(weekStart.getDate() + index);
      const dateKey = toIsoDateKey(current);
      return {
        dateKey,
        label: dayName,
        dayNumber: String(current.getDate()).padStart(2, "0"),
        isToday: dateKey === todayKey,
        items: allSchedulesByDate[dateKey] ?? [],
      };
    });
  }, [allSchedulesByDate, weekStart]);


  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Agenda semanal</Text>
        <Pressable
          style={({ pressed }) => [styles.iconButtonRound, pressed && styles.iconButtonRoundPressed]}
          onPress={() => { void loadAgenda(); }}
          accessibilityRole="button"
          accessibilityLabel="Refrescar agenda"
        >
          {({ pressed }) => (
            <Ionicons name="refresh" size={20} color={pressed ? "#f97316" : "#334155"} />
          )}
        </Pressable>
      </View>

      <View style={styles.weekNav}>
        <Pressable
          style={styles.weekButton}
          onPress={() => {
            setHasManualWeekSelection(true);
            setWeekStart((prev) => {
              const next = new Date(prev);
              next.setDate(prev.getDate() - 7);
              return next;
            });
          }}
        >
          <Text style={styles.weekButtonText}>{"<"}</Text>
        </Pressable>
        <Text
          style={styles.weekRange}
          numberOfLines={1}
        >
          {formatWeekRange(weekStart)}
        </Text>
        <Pressable
          style={styles.weekButton}
          onPress={() => {
            setHasManualWeekSelection(true);
            setWeekStart((prev) => {
              const next = new Date(prev);
              next.setDate(prev.getDate() + 7);
              return next;
            });
          }}
        >
          <Text style={styles.weekButtonText}>{">"}</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#0f766e" />
          <Text style={styles.centerText}>Cargando agenda...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.centerState}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => {
              void loadAgenda();
            }}
          >
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </Pressable>
        </View>
      ) : scheduleSource === "excel" && !isWeekPublished ? (
        <View style={styles.centerState}>
          <Text style={styles.centerText}>
            No hay planificacion Excel publicada para esta semana.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {weekDays.map((day) => {
            const dayStatus = getEmptyDayStatus(day.dateKey, sickLeaveItems, vacationItems);
            return (
            <View key={day.dateKey} style={[styles.dayCard, day.isToday && styles.todayCard]}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayTitle}>
                  {day.label} {day.dayNumber}
                </Text>
                {day.isToday ? <Text style={styles.todayBadge}>Hoy</Text> : null}
              </View>

              {dayStatus === "sick" ? (
                <View style={styles.dayStatusRow}>
                  <Ionicons name="thermometer-outline" size={18} color="#ef4444" />
                  <Text style={[styles.dayStatusText, { color: "#ef4444" }]}>Enfermo</Text>
                </View>
              ) : dayStatus === "vacation" ? (
                <View style={styles.dayStatusRow}>
                  <Ionicons name="airplane-outline" size={18} color="#0ea5e9" />
                  <Text style={[styles.dayStatusText, { color: "#0ea5e9" }]}>Vacaciones</Text>
                </View>
              ) : day.items.length === 0 ? (
                <View style={styles.dayStatusRow}>
                  <Ionicons name="sunny-outline" size={18} color="#059669" />
                  <Text style={[styles.dayStatusText, { color: "#059669" }]}>Libre</Text>
                </View>
              ) : (
                day.items.map((item) => (
                  <View key={`${day.dateKey}-${item.dienstId}-${item.startTime}`} style={styles.itemRow}>
                    <View style={styles.itemTopGrid}>
                      <Text style={styles.itemDienst} numberOfLines={1}>
                        {item.dienstName} {item.dienstNumberLabel}
                      </Text>
                      <Text style={styles.itemSchedule}>
                        {item.startTime} - {item.endTime}
                      </Text>
                      <Text style={styles.itemAmbulance} numberOfLines={1}>
                        {item.ambulanceLabel}
                      </Text>
                    </View>
                    <View style={styles.itemBottomRow}>
                      <View style={styles.teamRow}>
                        <Text style={styles.teamTitle}>Equipo</Text>
                        <View style={styles.teamMembersStack}>
                          <Text style={styles.teamMember} numberOfLines={1}>
                            Driver: {item.driverLabel}
                          </Text>
                          <Text style={styles.teamMember} numberOfLines={1}>
                            Medic: {item.medicLabel}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
            );
          })}
        </ScrollView>
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
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
  },
  iconButtonRound: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonRoundPressed: {
    borderColor: "#f97316",
  },
  weekNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 6,
  },
  weekButton: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#ffffff",
  },
  weekButtonText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "600",
  },
  weekRange: {
    flex: 1,
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  dayCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  todayCard: {
    borderColor: "#0f766e",
  },
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dayTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
  },
  todayBadge: {
    color: "#0f766e",
    fontWeight: "700",
    fontSize: 12,
  },
  dayStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dayStatusText: {
    fontSize: 14,
    fontWeight: "700",
  },
  itemRow: {
    flexDirection: "column",
    alignItems: "stretch",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 10,
    gap: 10,
  },
  itemTopGrid: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  itemDienst: {
    flex: 1,
    color: "#334155",
    fontWeight: "700",
    fontSize: 13,
  },
  itemSchedule: {
    minWidth: 88,
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 13,
    textAlign: "center",
  },
  itemAmbulance: {
    flex: 0.9,
    color: "#475569",
    fontSize: 13,
    textAlign: "right",
  },
  itemBottomRow: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 8,
  },
  teamRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  teamTitle: {
    flex: 0.5,
    fontSize: 12,
    color: "#334155",
    fontWeight: "700",
    textAlign: "left",
  },
  teamMembersStack: {
    flex: 1,
    alignItems: "flex-start",
    justifyContent: "center",
    alignSelf: "flex-end",
    gap: 2,
  },
  teamMember: {
    fontSize: 12,
    color: "#475569",
    textAlign: "left",
  },
});
