import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getDienstsByUser } from "../services/diensts";
import { getMyExcelPlanningWeek } from "../services/excelPlanning";
import { ApiError } from "../services/http";
import { AuthUser, ScheduleSource } from "../types/auth";

type Props = {
  user: AuthUser;
  scheduleSource: ScheduleSource;
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
  if (!value) return "Sin ambulancia";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null) {
    const maybePlate = (value as { licensePlate?: string }).licensePlate;
    const maybeNumber = (value as { ambulanceNumber?: string }).ambulanceNumber;
    return maybePlate ?? maybeNumber ?? "Ambulancia asignada";
  }
  return "Ambulancia asignada";
}

function normalizeObjectId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null) {
    const maybeId = (value as { _id?: string })._id;
    return maybeId ?? null;
  }
  return null;
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

export function WorkerAgendaScreen({ user, scheduleSource }: Props) {
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekMonday(new Date()));
  const [hasManualWeekSelection, setHasManualWeekSelection] = useState(false);
  const [allSchedulesByDate, setAllSchedulesByDate] = useState<Record<string, DayScheduleItem[]>>(
    {},
  );
  const [isWeekPublished, setIsWeekPublished] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  const loadAgenda = async () => {
    setIsLoading(true);
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
        const diensts = await getDienstsByUser(user._id);
        for (const dienst of diensts) {
          const dienstName = dienst.name ?? "Dienst";
          const dienstNumberLabel =
            typeof dienst.dienstNumber === "number"
              ? `#${dienst.dienstNumber}`
              : "#-";
          for (const assignment of dienst.assignments ?? []) {
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

            const driverId = normalizeObjectId(assignment.driver);
            const medicId = normalizeObjectId(assignment.medic);
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

      for (const [dateKey, items] of Object.entries(byDate)) {
        byDate[dateKey] = items.sort(
          (a, b) => toMinuteOfDay(a.startTime) - toMinuteOfDay(b.startTime),
        );
      }

      setAllSchedulesByDate(byDate);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("No se pudo cargar la agenda.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAgenda();
  }, [scheduleSource, weekStart]);

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

  const weekItemsCount = useMemo(
    () => weekDays.reduce((acc, day) => acc + day.items.length, 0),
    [weekDays],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Agenda semanal</Text>
        <Text style={styles.subtitle}>
          Vista de lunes a domingo · Fuente: {scheduleSource}
        </Text>
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
          <Text style={styles.weekButtonText}>Semana anterior</Text>
        </Pressable>
        <Text style={styles.weekRange}>{formatWeekRange(weekStart)}</Text>
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
          <Text style={styles.weekButtonText}>Semana siguiente</Text>
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
      ) : weekItemsCount === 0 ? (
        <View style={styles.centerState}>
          <Text style={styles.centerText}>
            {scheduleSource === "excel" && !isWeekPublished
              ? "No hay planificacion Excel publicada para esta semana."
              : scheduleSource === "excel"
                ? "Semana publicada, pero este trabajador no tiene filas asignadas."
                : "No hay servicios asignados para esta semana."}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {weekDays.map((day) => (
            <View key={day.dateKey} style={[styles.dayCard, day.isToday && styles.todayCard]}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayTitle}>
                  {day.label} {day.dayNumber}
                </Text>
                {day.isToday ? <Text style={styles.todayBadge}>Hoy</Text> : null}
              </View>

              {day.items.length === 0 ? (
                <Text style={styles.emptyDayText}>Sin servicio asignado</Text>
              ) : (
                day.items.map((item) => (
                  <View key={`${day.dateKey}-${item.dienstId}-${item.startTime}`} style={styles.itemRow}>
                    <View style={styles.itemLeft}>
                      <Text style={styles.itemTime}>
                        {item.startTime} - {item.endTime}
                      </Text>
                      <Text style={styles.itemName}>
                        {item.dienstName} {item.dienstNumberLabel}
                      </Text>
                      <Text style={styles.itemRole}>Tu rol: {item.workerRole}</Text>
                      <Text style={styles.itemAmbulance}>{item.ambulanceLabel}</Text>
                    </View>
                    <View style={styles.itemRight}>
                      <Text style={styles.teamTitle}>Equipo</Text>
                      <Text style={styles.teamMember}>Driver: {item.driverLabel}</Text>
                      <Text style={styles.teamMember}>Medic: {item.medicLabel}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          ))}
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
    paddingBottom: 8,
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
  weekNav: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  weekButton: {
    alignSelf: "flex-start",
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
    color: "#0f172a",
    fontWeight: "600",
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
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  todayBadge: {
    color: "#0f766e",
    fontWeight: "700",
    fontSize: 12,
  },
  emptyDayText: {
    color: "#64748b",
    fontSize: 14,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 10,
    gap: 10,
  },
  itemLeft: {
    flex: 1,
    gap: 2,
  },
  itemRight: {
    width: 132,
    borderLeftWidth: 1,
    borderLeftColor: "#e2e8f0",
    paddingLeft: 10,
    gap: 2,
  },
  itemTime: {
    color: "#0f172a",
    fontWeight: "700",
  },
  itemName: {
    color: "#334155",
  },
  itemAmbulance: {
    color: "#64748b",
    fontSize: 12,
  },
  itemRole: {
    color: "#0f766e",
    fontSize: 12,
    fontWeight: "700",
  },
  teamTitle: {
    fontSize: 12,
    color: "#334155",
    fontWeight: "700",
    marginBottom: 2,
  },
  teamMember: {
    fontSize: 12,
    color: "#475569",
  },
});
