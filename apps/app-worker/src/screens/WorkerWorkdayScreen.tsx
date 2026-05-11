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
  getWorkdayTripSetup,
  getMyWorkdaySummaries,
  saveWorkdayTripSetup,
  getWorkdayTripsByDate,
} from "../services/workday";
import { getAmbulancesList, type AmbulanceListItem } from "../services/ambulances";
import { AuthUser, CompanyModuleKey, MODULE_KEYS } from "../types/auth";
import {
  getVehicleConfirmedAsync,
  loadAmbulanceDataAsync,
  saveAmbulanceDataAsync,
  setVehicleConfirmedAsync,
} from "../utils/workdayAmbulanceStorage";
import { canStartTripNow } from "../utils/workdayAssignment";
import { WorkerTripStepPanel } from "./WorkerTripStepPanel";
import { WorkerWorkdayPreamble } from "./WorkerWorkdayPreamble";

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

/** Solo número de ambulancia (sin matrícula), para cabecera Mi Jornada. */
function ambulanceNumberOnlyFromAssignment(day: AssignedDay): string {
  if (day.ambulanceNumber?.trim()) return day.ambulanceNumber.trim();
  const amb = day.ambulanceId;
  if (amb && typeof amb === "object") {
    const num = amb.ambulanceNumber?.trim();
    if (num) return num;
  }
  return "";
}

/** Cabecera: prioriza número guardado en preámbulo / flota; nunca concatena matrícula. */
function resolveAmbulanceLineForWorkerHeader(
  assignment: AssignedDay,
  ambulancesList: AmbulanceListItem[],
  ambulanceHydrated: boolean,
  preambleAmbulanceId: string,
  preambleAmbulanceNumber: string,
): string {
  const id = preambleAmbulanceId.trim();
  const storedNum = preambleAmbulanceNumber.trim();
  const fromList = id ? ambulancesList.find((a) => a._id === id) : undefined;

  if (ambulanceHydrated) {
    if (storedNum && storedNum !== "—") return storedNum;
    const listNum = fromList?.ambulanceNumber?.trim();
    if (listNum) return listNum;
  }

  const fromAssignment = ambulanceNumberOnlyFromAssignment(assignment);
  if (fromAssignment) return fromAssignment;
  return "—";
}

/** Id de ambulancia para persistencia (misma idea que `normalizeAmbulanceIdToString` en web). */
function ambulanceIdForStorage(day: AssignedDay): string {
  const a = day.ambulanceId;
  if (typeof a === "string" && a.trim()) return a.trim();
  if (a && typeof a === "object" && typeof a._id === "string" && a._id.trim()) return a._id.trim();
  return "";
}

function ambulanceNumberForStorage(day: AssignedDay): string {
  if (day.ambulanceNumber?.trim()) return day.ambulanceNumber.trim();
  const a = day.ambulanceId;
  if (a && typeof a === "object" && a.ambulanceNumber?.trim()) return a.ambulanceNumber.trim();
  return "";
}

function parseInitialKmInput(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  if (Number.isNaN(n) || n <= 0) return null;
  return n;
}

function firstSharedKmStartForAssignment(
  trips: WorkdayTrip[],
  assignmentId: string,
): string {
  const sameAssignment = trips
    .filter((trip) => trip.assignmentId === assignmentId)
    .filter((trip) => typeof trip.kmStart === "number" && Number.isFinite(trip.kmStart))
    .sort((a, b) => {
      const ta = Date.parse(a.timeWarning ?? "") || 0;
      const tb = Date.parse(b.timeWarning ?? "") || 0;
      return ta - tb;
    });
  if (sameAssignment.length === 0) return "";
  const km = sameAssignment[0]?.kmStart;
  if (typeof km !== "number" || !Number.isFinite(km) || km <= 0) return "";
  return String(Math.round(km));
}

function buildPreambleStartWindowMessage(assignment: AssignedDay | null): string | undefined {
  if (!assignment?.startTime || !assignment?.date) return undefined;
  const [hourRaw, minuteRaw] = assignment.startTime.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return undefined;

  const dienstStart = new Date(`${assignment.date}T00:00:00`);
  dienstStart.setHours(hour, minute, 0, 0);
  const allowedFrom = new Date(dienstStart.getTime() - 30 * 60 * 1000);
  const now = new Date();

  if (now.getTime() >= allowedFrom.getTime()) {
    return "Ya puedes confirmar ambulancia y odómetro para iniciar jornada.";
  }

  return `Podrás iniciar la jornada desde las ${allowedFrom.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  })} (30 min antes del dienst).`;
}

type Props = {
  user: AuthUser;
  enabledModules?: CompanyModuleKey[];
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

export function WorkerWorkdayScreen({ user, enabledModules, onOpenWorkdayClosure }: Props) {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [todayAssignment, setTodayAssignment] = useState<AssignedDay | null>(null);
  const [todayTrips, setTodayTrips] = useState<WorkdayTrip[]>([]);
  /** Solo cierres de hoy para la asignacion actual: alimenta el chip de estado (no se listan en pantalla). */
  const [recentSummaries, setRecentSummaries] = useState<WorkdaySummary[]>([]);
  /** Km iniciales ambulancia (misma regla que web: obligatorio antes de viajes). */
  const [ambulanceHydrated, setAmbulanceHydrated] = useState(false);
  const [initialKmDraft, setInitialKmDraft] = useState("");
  const [vehicleConfirmed, setVehicleConfirmed] = useState(false);
  const [ambulanceLocalError, setAmbulanceLocalError] = useState<string | undefined>(undefined);
  const [preambleAmbulanceId, setPreambleAmbulanceId] = useState("");
  const [preambleAmbulanceNumber, setPreambleAmbulanceNumber] = useState("");
  const [ambulancesList, setAmbulancesList] = useState<AmbulanceListItem[]>([]);
  const [ambulancesLoading, setAmbulancesLoading] = useState(false);
  const [confirmingAmbulance, setConfirmingAmbulance] = useState(false);

  const hasAmbulancesModule = useMemo(
    () => Boolean(enabledModules?.includes(MODULE_KEYS.AMBULANCES)),
    [enabledModules],
  );

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

  useEffect(() => {
    if (!todayAssignment?.assignmentId) {
      setAmbulanceHydrated(true);
      setVehicleConfirmed(false);
      setInitialKmDraft("");
      setAmbulanceLocalError(undefined);
      setPreambleAmbulanceId("");
      setPreambleAmbulanceNumber("");
      return;
    }
    const assignmentId = todayAssignment.assignmentId;
    const defId = ambulanceIdForStorage(todayAssignment);
    const defNum = ambulanceNumberForStorage(todayAssignment);
    const sharedTripsForAssignment = todayTrips.filter(
      (trip) => trip.assignmentId === assignmentId,
    );
    const sharedSetupExists = sharedTripsForAssignment.length > 0;
    const sharedKmStart = firstSharedKmStartForAssignment(todayTrips, assignmentId);
    let cancelled = false;
    setAmbulanceHydrated(false);
    (async () => {
      try {
        const [loaded, confirmed] = await Promise.all([
          loadAmbulanceDataAsync(assignmentId),
          getVehicleConfirmedAsync(assignmentId),
        ]);
        const sharedSetup = await getWorkdayTripSetup(assignmentId).catch(() => null);
        if (cancelled) return;
        if (sharedSetup?.initialKm && sharedSetup.initialKm > 0) {
          const sharedKm = String(Math.round(sharedSetup.initialKm));
          const sharedAmbulanceId = sharedSetup.ambulanceId?.trim() || defId;
          const sharedAmbulanceNumber = sharedSetup.ambulanceNumber?.trim() || defNum;
          setInitialKmDraft(sharedKm);
          setPreambleAmbulanceId(sharedAmbulanceId);
          setPreambleAmbulanceNumber(sharedAmbulanceNumber);
          setVehicleConfirmed(true);
          return;
        }
        if (sharedSetupExists) {
          // Professional sync behavior: if any teammate already started this assignment,
          // treat setup as globally confirmed even on a fresh device.
          setInitialKmDraft(
            sharedKmStart || loaded?.initialKm?.trim() || "",
          );
          setPreambleAmbulanceId(loaded?.ambulanceId?.trim() ? loaded.ambulanceId : defId);
          setPreambleAmbulanceNumber(
            loaded?.ambulanceNumber?.trim() ? loaded.ambulanceNumber : defNum,
          );
          setVehicleConfirmed(true);
          return;
        }
        if (loaded) {
          setInitialKmDraft(loaded.initialKm?.trim() ? loaded.initialKm : "");
          setPreambleAmbulanceId(loaded.ambulanceId?.trim() ? loaded.ambulanceId : defId);
          setPreambleAmbulanceNumber(
            loaded.ambulanceNumber?.trim() ? loaded.ambulanceNumber : defNum,
          );
        } else {
          setInitialKmDraft("");
          setPreambleAmbulanceId(defId);
          setPreambleAmbulanceNumber(defNum);
        }
        const hasKm = Boolean(loaded?.initialKm?.trim());
        setVehicleConfirmed(confirmed && hasKm);
      } finally {
        if (!cancelled) {
          setAmbulanceHydrated(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [todayAssignment?.assignmentId, todayTrips]);

  useEffect(() => {
    if (!hasAmbulancesModule || !todayAssignment?.assignmentId) {
      setAmbulancesList([]);
      setAmbulancesLoading(false);
      return;
    }
    let cancelled = false;
    setAmbulancesLoading(true);
    void (async () => {
      try {
        const list = await getAmbulancesList();
        if (!cancelled) {
          setAmbulancesList(Array.isArray(list) ? list : []);
        }
      } catch {
        if (!cancelled) {
          setAmbulancesList([]);
        }
      } finally {
        if (!cancelled) {
          setAmbulancesLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasAmbulancesModule, todayAssignment?.assignmentId]);

  useEffect(() => {
    if (!todayAssignment || vehicleConfirmed) return;
    if (!hasAmbulancesModule || ambulancesList.length === 0) return;
    const defId = ambulanceIdForStorage(todayAssignment);
    if (!defId || !ambulancesList.some((a) => a._id === defId)) return;
    if (!ambulancesList.some((a) => a._id === preambleAmbulanceId)) {
      setPreambleAmbulanceId(defId);
      setPreambleAmbulanceNumber(ambulanceNumberForStorage(todayAssignment));
    }
  }, [
    ambulancesList,
    hasAmbulancesModule,
    preambleAmbulanceId,
    todayAssignment,
    vehicleConfirmed,
  ]);

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

  const vehicleSetupComplete = useMemo(
    () => !todayAssignment || vehicleConfirmed,
    [todayAssignment, vehicleConfirmed],
  );

  const handlePreambleSelectAmbulance = useCallback((id: string, numberForStorage: string) => {
    setPreambleAmbulanceId(id);
    setPreambleAmbulanceNumber(numberForStorage);
    setAmbulanceLocalError(undefined);
  }, []);

  const handleConfirmAmbulance = useCallback(async () => {
    if (!todayAssignment) return;
    setAmbulanceLocalError(undefined);
    const useFleetPicker = hasAmbulancesModule && ambulancesList.length > 0;
    const ambId = useFleetPicker ? preambleAmbulanceId.trim() : ambulanceIdForStorage(todayAssignment);
    if (!ambId) {
      setAmbulanceLocalError(
        useFleetPicker
          ? "Selecciona la ambulancia del servicio."
          : "La asignacion no incluye ambulancia. Contacta con administracion.",
      );
      return;
    }
    if (useFleetPicker && !ambulancesList.some((a) => a._id === ambId)) {
      setAmbulanceLocalError("Selecciona una ambulancia de la lista.");
      return;
    }
    const km = parseInitialKmInput(initialKmDraft);
    if (km === null) {
      setAmbulanceLocalError("Indica un kilometraje inicial valido (mayor que 0).");
      return;
    }
    const kmStr = String(Math.round(km));
    const ambNum = useFleetPicker
      ? preambleAmbulanceNumber.trim() || "—"
      : ambulanceNumberForStorage(todayAssignment).trim() || "—";
    setConfirmingAmbulance(true);
    try {
      await saveWorkdayTripSetup(todayAssignment.assignmentId, {
        ambulanceId: ambId,
        ambulanceNumber: ambNum,
        initialKm: Math.round(km),
      });
      await saveAmbulanceDataAsync(todayAssignment.assignmentId, ambId, ambNum, kmStr);
      await setVehicleConfirmedAsync(todayAssignment.assignmentId, true);
      setInitialKmDraft(kmStr);
      setVehicleConfirmed(true);
    } catch {
      setAmbulanceLocalError("No se pudieron guardar los datos. Reintenta.");
    } finally {
      setConfirmingAmbulance(false);
    }
  }, [ambulancesList, hasAmbulancesModule, initialKmDraft, preambleAmbulanceId, preambleAmbulanceNumber, todayAssignment]);

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

  const resolvedAmbulanceLine = useMemo(() => {
    if (!todayAssignment) return "—";
    return resolveAmbulanceLineForWorkerHeader(
      todayAssignment,
      ambulancesList,
      ambulanceHydrated,
      preambleAmbulanceId,
      preambleAmbulanceNumber,
    );
  }, [
    ambulancesList,
    ambulanceHydrated,
    preambleAmbulanceId,
    preambleAmbulanceNumber,
    todayAssignment,
  ]);

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
            <View style={styles.headerAmbTextKmRow}>
              <Text style={styles.headerAmbValueInline} numberOfLines={2}>
                {resolvedAmbulanceLine}
              </Text>
              {ambulanceHydrated && initialKmDraft.trim() !== "" ? (
                <Text style={styles.headerKmNumberOnly} numberOfLines={1}>
                  {initialKmDraft.trim()}
                </Text>
              ) : tripsBlocked ? (
                <Text style={styles.headerKmNumberMuted} numberOfLines={1}>
                  —
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      </View>
    );
  }, [
    ambulanceHydrated,
    errorMessage,
    initialKmDraft,
    isLoading,
    resolvedAmbulanceLine,
    todayAssignment,
    tripsBlocked,
  ]);

  const showHeaderTripCountChip =
    !isLoading && !errorMessage && todayAssignment != null;

  const showPreamble = Boolean(
    !isLoading &&
      !errorMessage &&
      todayAssignment &&
      ambulanceHydrated &&
      !vehicleConfirmed &&
      !tripsBlocked,
  );

  const preambleDienstNumberText = useMemo(() => {
    if (!todayAssignment) return "—";
    const n =
      todayAssignment.dienstNumber != null && String(todayAssignment.dienstNumber).trim() !== ""
        ? String(todayAssignment.dienstNumber).trim()
        : "—";
    return n === "—" ? "—" : `#${n}`;
  }, [todayAssignment]);

  const preambleScheduleLine = useMemo(() => {
    if (!todayAssignment) return "--:-- – --:--";
    return `${todayAssignment.startTime ?? "--:--"} – ${todayAssignment.endTime ?? "--:--"}`;
  }, [todayAssignment]);

  const preambleAssignmentAmbulanceLine = useMemo(() => {
    if (!todayAssignment) return "—";
    const fallback = ambulanceNumberOnlyFromAssignment(todayAssignment) || "—";
    const useFleetPicker = hasAmbulancesModule && ambulancesList.length > 0;
    if (!useFleetPicker) return fallback;
    const selectedId = preambleAmbulanceId.trim();
    if (!selectedId) return fallback;
    const selected = ambulancesList.find((a) => a._id === selectedId);
    if (!selected) return fallback;
    const n = selected.ambulanceNumber?.trim();
    if (n) return n;
    return fallback;
  }, [
    ambulancesList,
    hasAmbulancesModule,
    preambleAmbulanceId,
    todayAssignment,
  ]);

  const preambleConfirmDisabled = useMemo(() => {
    if (!canStartWork) return true;
    if (confirmingAmbulance) return true;
    if (parseInitialKmInput(initialKmDraft) === null) return true;
    const useFleetPicker = hasAmbulancesModule && ambulancesList.length > 0;
    if (useFleetPicker && !preambleAmbulanceId.trim()) return true;
    if (!useFleetPicker) {
      if (!todayAssignment || !ambulanceIdForStorage(todayAssignment)) return true;
    }
    return false;
  }, [
    ambulancesList.length,
    canStartWork,
    confirmingAmbulance,
    hasAmbulancesModule,
    initialKmDraft,
    preambleAmbulanceId,
    todayAssignment,
  ]);

  if (showPreamble && todayAssignment != null) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <Text style={styles.title} numberOfLines={1}>
              Preparar jornada
            </Text>
            <Pressable
              style={({ pressed }) => [styles.iconButtonRound, pressed && styles.iconButtonRoundPressed]}
              onPress={() => void loadWorkday()}
              accessibilityRole="button"
              accessibilityLabel="Refrescar"
              hitSlop={6}
            >
              {({ pressed }: { pressed: boolean }) => (
                <Ionicons name="refresh" size={20} color={pressed ? "#f97316" : "#ffffff"} />
              )}
            </Pressable>
          </View>
        </View>
        <WorkerWorkdayPreamble
          dienstNumberText={preambleDienstNumberText}
          scheduleLine={preambleScheduleLine}
          driverName={displayWorkerName(todayAssignment.driver)}
          medicName={displayWorkerName(todayAssignment.medic)}
          assignmentAmbulanceLine={preambleAssignmentAmbulanceLine}
          hasAmbulancesModule={hasAmbulancesModule}
          ambulancesLoading={ambulancesLoading}
          ambulances={ambulancesList}
          selectedAmbulanceId={preambleAmbulanceId}
          onSelectAmbulance={handlePreambleSelectAmbulance}
          initialKm={initialKmDraft}
          onChangeInitialKm={(t) => {
            setInitialKmDraft(t);
            setAmbulanceLocalError(undefined);
          }}
          startWindowMessage={buildPreambleStartWindowMessage(todayAssignment)}
          startWindowState={canStartWork ? "ready" : "blocked"}
          canConfirmSetup={canStartWork}
          errorMessage={ambulanceLocalError}
          onConfirm={() => void handleConfirmAmbulance()}
          confirmDisabled={preambleConfirmDisabled}
          confirming={confirmingAmbulance}
        />
      </SafeAreaView>
    );
  }

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
                    styles.headerSummaryIconBtn,
                    pressed ? styles.headerSummaryIconBtnPressed : null,
                  ]}
                  onPress={() => onOpenWorkdayClosure?.()}
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir resumen de jornada (${tripsCountForBanner} viajes)`}
                  hitSlop={6}
                >
                  <Ionicons name="document-text-outline" size={18} color="#047857" />
                  <Text style={styles.headerSummaryIconCount}>{tripsCountForBanner}</Text>
                </Pressable>
              ) : null}
            </View>
            <Pressable
              style={({ pressed }) => [styles.iconButtonRound, pressed && styles.iconButtonRoundPressed]}
              onPress={() => void loadWorkday()}
              accessibilityRole="button"
              accessibilityLabel="Refrescar"
              hitSlop={6}
            >
              {({ pressed }: { pressed: boolean }) => (
                <Ionicons name="refresh" size={20} color={pressed ? "#f97316" : "#ffffff"} />
              )}
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
                  vehicleSetupComplete={vehicleSetupComplete}
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
    borderBottomColor: "#1e293b",
    backgroundColor: "#0f172a",
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
    color: "#ffffff",
  },
  headerSummaryIconBtn: {
    height: 32,
    minWidth: 48,
    paddingHorizontal: 8,
    borderRadius: 10,
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    flexShrink: 0,
  },
  headerSummaryIconBtnPressed: {
    opacity: 0.9,
    backgroundColor: "#f8fafc",
  },
  headerSummaryIconCount: {
    fontSize: 13,
    fontWeight: "800",
    color: "#047857",
    fontVariant: ["tabular-nums"],
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
    flexShrink: 0,
  },
  iconButtonRoundPressed: {
    borderColor: "#f97316",
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
    color: "#94a3b8",
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
    color: "#ffffff",
    alignSelf: "stretch",
  },
  headerSchedule: {
    fontSize: 11,
    fontWeight: "600",
    color: "#cbd5e1",
    lineHeight: 15,
    fontVariant: ["tabular-nums"],
    alignSelf: "stretch",
  },
  headerTeamName: {
    fontSize: 11,
    fontWeight: "600",
    color: "#e2e8f0",
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
  headerAmbTextKmRow: {
    marginTop: 2,
    flexDirection: "column",
    alignItems: "flex-end",
    justifyContent: "flex-start",
    gap: 2,
    alignSelf: "stretch",
  },
  headerAmbValueInline: {
    maxWidth: "100%",
    fontSize: 11,
    fontWeight: "600",
    color: "#e2e8f0",
    lineHeight: 15,
    textAlign: "right",
    alignSelf: "flex-end",
  },
  headerKmNumberOnly: {
    fontSize: 11,
    fontWeight: "600",
    color: "#cbd5e1",
    lineHeight: 15,
    fontVariant: ["tabular-nums"],
    textAlign: "right",
    flexShrink: 0,
  },
  headerKmNumberMuted: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94a3b8",
    lineHeight: 15,
    fontVariant: ["tabular-nums"],
    flexShrink: 0,
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
    paddingTop: 18,
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
