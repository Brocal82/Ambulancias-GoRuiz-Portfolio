import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";

import { ApiError } from "../services/http";
import {
  MechanicsIssueReport,
  ReportIssuePayload,
  getMyIssueReports,
  reportIssue,
} from "../services/mechanics";
import {
  AssignedDay,
  AssignedDayUser,
  WorkdayTrip,
  WorkdayTripSetup,
  getAssignedDaysForWorker,
  getWorkdayTripsByDate,
  getWorkdayTripSetup,
  submitWorkdayClosure,
} from "../services/workday";
import { AmbulanceListItem, getAmbulancesList } from "../services/ambulances";
import { AuthUser, CompanyModuleKey, MODULE_KEYS } from "../types/auth";
import { parseHHMM } from "../utils/tripValidators";
import { resolveTodayAssignment } from "../utils/workdayAssignment";

type Props = {
  user: AuthUser;
  enabledModules?: CompanyModuleKey[];
  onClose: () => void;
};

type ClosureMenuKey = "inicio" | "checks" | "viajes" | "averias" | "envio";

function todayDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function tripCountsTowardWorkday(trip: WorkdayTrip): boolean {
  return trip.countsTrip !== 0;
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

const MENU: {
  key: ClosureMenuKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "inicio", label: "Inicio", icon: "home-outline" },
  { key: "checks", label: "Amb. checks", icon: "medkit-outline" },
  { key: "viajes", label: "Viajes", icon: "map-outline" },
  { key: "averias", label: "Averias", icon: "warning-outline" },
  { key: "envio", label: "Envio", icon: "send-outline" },
];

function userLabel(value: string | AssignedDayUser | undefined): string {
  if (!value) return "—";
  if (typeof value === "string") return value.trim() || "—";
  const n = value.name?.trim() ?? "";
  const l = value.lastName?.trim() ?? "";
  return `${n} ${l}`.trim() || "—";
}

function userId(value: string | AssignedDayUser | undefined): string {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  return value._id?.trim() ?? "";
}

function assignmentAmbulanceNumber(day: AssignedDay | null): string {
  if (!day) return "";
  if (day.ambulanceNumber?.trim()) return day.ambulanceNumber.trim();
  const a = day.ambulanceId;
  if (a && typeof a === "object" && a.ambulanceNumber?.trim()) return a.ambulanceNumber.trim();
  return "";
}

function assignmentAmbulancePlate(day: AssignedDay | null): string {
  if (!day) return "";
  const a = day.ambulanceId;
  if (a && typeof a === "object" && a.licensePlate?.trim()) return a.licensePlate.trim();
  return "";
}

function assignmentAmbulanceId(day: AssignedDay | null): string {
  if (!day) return "";
  const a = day.ambulanceId;
  if (typeof a === "string" && a.trim()) return a.trim();
  if (a && typeof a === "object" && a._id?.trim()) return a._id.trim();
  return "";
}

type IssuePhoto = { uri: string; name: string; mimeType: string };

const VEHICLE_CHECKLIST = [
  { key: "limpieza", label: "Limpieza interior" },
  { key: "combustible", label: "Nivel de combustible OK" },
  { key: "o2_equipo", label: "Equipo O2 en orden" },
  { key: "botiquin", label: "Botiquín completo" },
  { key: "documentacion", label: "Documentación en regla" },
  { key: "luces", label: "Luces y señales operativas" },
] as const;

export function WorkerWorkdayClosureScreen({ user, enabledModules, onClose }: Props) {
  const [activeKey, setActiveKey] = useState<ClosureMenuKey>("inicio");
  const [trips, setTrips] = useState<WorkdayTrip[]>([]);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [todayAssignment, setTodayAssignment] = useState<AssignedDay | null>(null);
  const [loadingAssignment, setLoadingAssignment] = useState(true);
  const [ambulances, setAmbulances] = useState<AmbulanceListItem[]>([]);
  const [selectedAmbulanceId, setSelectedAmbulanceId] = useState("");
  const [selectedAmbulanceNumber, setSelectedAmbulanceNumber] = useState("");
  const [finalKm, setFinalKm] = useState("");
  const [issueText, setIssueText] = useState("");
  const [issuePhotos, setIssuePhotos] = useState<IssuePhoto[]>([]);
  const [sendingIssue, setSendingIssue] = useState(false);
  const [issueFeedback, setIssueFeedback] = useState<string | undefined>(undefined);
  const [sentIssuesToday, setSentIssuesToday] = useState<MechanicsIssueReport[]>([]);
  const [tripSetup, setTripSetup] = useState<WorkdayTripSetup | null>(null);
  const [checklistItems, setChecklistItems] = useState<Record<string, boolean>>(
    Object.fromEntries(VEHICLE_CHECKLIST.map((item) => [item.key, false])),
  );
  const [o2Level, setO2Level] = useState("");
  const [closureSubmitting, setClosureSubmitting] = useState(false);
  const [closureFeedback, setClosureFeedback] = useState<string | undefined>(undefined);
  const [closureDone, setClosureDone] = useState(false);

  const hasAmbulancesModule = useMemo(
    () => Boolean(enabledModules?.includes(MODULE_KEYS.AMBULANCES)),
    [enabledModules],
  );

  const loadTrips = useCallback(async () => {
    setLoadingTrips(true);
    setLoadError(undefined);
    try {
      const list = await getWorkdayTripsByDate(todayDateKey());
      setTrips(list);
    } catch (e) {
      if (e instanceof ApiError) {
        setLoadError(e.message);
      } else {
        setLoadError("No se pudieron cargar los viajes.");
      }
    } finally {
      setLoadingTrips(false);
    }
  }, []);

  useEffect(() => {
    void loadTrips();
  }, [loadTrips]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoadingAssignment(true);
      try {
        const [days, list] = await Promise.all([
          getAssignedDaysForWorker(user._id),
          hasAmbulancesModule ? getAmbulancesList() : Promise.resolve([]),
        ]);
        if (cancelled) return;
        const assignment = resolveTodayAssignment(days);
        setTodayAssignment(assignment);
        setAmbulances(list);
        const ambId = assignmentAmbulanceId(assignment);
        const ambNumber = assignmentAmbulanceNumber(assignment);
        setSelectedAmbulanceId(ambId);
        setSelectedAmbulanceNumber(ambNumber);
        if (assignment?.assignmentId) {
          try {
            const setup = await getWorkdayTripSetup(assignment.assignmentId);
            if (!cancelled) setTripSetup(setup);
          } catch {
            // tripSetup stays null; closure will show warning
          }
        }
      } catch {
        if (cancelled) return;
        setTodayAssignment(null);
        setAmbulances([]);
      } finally {
        if (!cancelled) {
          setLoadingAssignment(false);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [hasAmbulancesModule, user._id]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const mine = await getMyIssueReports(todayDateKey());
        if (!cancelled) {
          setSentIssuesToday(mine);
        }
      } catch {
        if (!cancelled) {
          setSentIssuesToday([]);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const pickIssuePhoto = useCallback(async (source: "camera" | "library") => {
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permiso requerido", "Necesitas permisos para adjuntar fotos.");
      return;
    }
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({
            allowsEditing: false,
            quality: 0.7,
            mediaTypes: ["images"],
          })
        : await ImagePicker.launchImageLibraryAsync({
            allowsMultipleSelection: true,
            quality: 0.7,
            selectionLimit: 5,
            mediaTypes: ["images"],
          });
    if (result.canceled) return;
    const mapped: IssuePhoto[] = result.assets.slice(0, 5).map((a, idx) => ({
      uri: a.uri,
      name: a.fileName ?? `issue-photo-${Date.now()}-${idx}.jpg`,
      mimeType: a.mimeType ?? "image/jpeg",
    }));
    setIssuePhotos((prev) => [...prev, ...mapped].slice(0, 5));
  }, []);

  const sendIssue = useCallback(async () => {
    if (!todayAssignment) return;
    const km = Number(finalKm.trim().replace(",", "."));
    if (!Number.isFinite(km) || km <= 0) {
      setIssueFeedback("Indica un kilometraje final válido.");
      return;
    }
    if (!issueText.trim()) {
      setIssueFeedback("Describe la avería antes de enviar.");
      return;
    }
    const driver = userId(todayAssignment.driver);
    const medic = userId(todayAssignment.medic);
    if (!driver || !medic) {
      setIssueFeedback("La asignación no incluye equipo completo (driver/medic).");
      return;
    }
    const ambulanceNumber = selectedAmbulanceNumber.trim() || assignmentAmbulanceNumber(todayAssignment) || "N/A";
    const payload: ReportIssuePayload = {
      assignmentId: todayAssignment.assignmentId,
      dienstNumber: Number(todayAssignment.dienstNumber ?? 0),
      date: todayAssignment.date,
      startTime: todayAssignment.startTime ?? "",
      endTime: todayAssignment.endTime ?? "",
      team: `${userLabel(todayAssignment.driver)} + ${userLabel(todayAssignment.medic)}`,
      ambulanceNumber,
      ...(selectedAmbulanceId.trim() ? { ambulanceId: selectedAmbulanceId.trim() } : {}),
      finalKm: Math.round(km),
      timestamp: new Date().toISOString(),
      issueText: issueText.trim(),
      driver,
      medic,
    };
    setSendingIssue(true);
    setIssueFeedback(undefined);
    try {
      await reportIssue(payload, issuePhotos);
      const mine = await getMyIssueReports(todayDateKey());
      setSentIssuesToday(mine);
      setIssueText("");
      setFinalKm("");
      setIssuePhotos([]);
      setIssueFeedback("Avería enviada correctamente.");
      setActiveKey("inicio");
    } catch (e) {
      if (e instanceof ApiError) {
        setIssueFeedback(e.message);
      } else {
        setIssueFeedback("No se pudo enviar la avería.");
      }
    } finally {
      setSendingIssue(false);
    }
  }, [finalKm, issuePhotos, issueText, selectedAmbulanceId, selectedAmbulanceNumber, todayAssignment]);

  const submitClosure = useCallback(async () => {
    if (!todayAssignment) return;
    const km = Number(finalKm.trim().replace(",", "."));
    if (!Number.isFinite(km) || km <= 0) {
      setClosureFeedback("Indica los kilómetros finales en la pestaña Checks.");
      return;
    }
    const ambulanceId = tripSetup?.ambulanceId ?? assignmentAmbulanceId(todayAssignment);
    const ambulanceNumber = tripSetup?.ambulanceNumber ?? assignmentAmbulanceNumber(todayAssignment);
    if (!ambulanceId) {
      setClosureFeedback("No se pudo determinar la ambulancia. Completa la configuración de jornada.");
      return;
    }
    const initialKm = tripSetup?.initialKm ?? 0;
    const assignmentTrips = trips.filter(
      (t) => !t.assignmentId || t.assignmentId === todayAssignment.assignmentId,
    );
    const o2LevelNum = o2Level.trim() ? Number(o2Level.trim().replace(",", ".")) : undefined;
    setClosureSubmitting(true);
    setClosureFeedback(undefined);
    try {
      await submitWorkdayClosure({
        date: todayAssignment.date,
        assignmentId: todayAssignment.assignmentId,
        ambulanceId,
        ambulanceNumber,
        initialKm,
        finalKm: km,
        trips: assignmentTrips,
        checklistItems,
        ...(o2LevelNum != null && !Number.isNaN(o2LevelNum) ? { o2Level: o2LevelNum } : {}),
      });
      setClosureDone(true);
      setClosureFeedback("Jornada cerrada correctamente.");
    } catch (e) {
      if (e instanceof ApiError) {
        setClosureFeedback(e.message);
      } else {
        setClosureFeedback("No se pudo enviar el cierre de jornada.");
      }
    } finally {
      setClosureSubmitting(false);
    }
  }, [
    checklistItems,
    finalKm,
    o2Level,
    todayAssignment,
    tripSetup,
    trips,
  ]);

  const assignedAmbulanceData = useMemo(() => {
    if (!todayAssignment) {
      return { id: "", number: "", plate: "", brand: "", model: "" };
    }
    const id = assignmentAmbulanceId(todayAssignment);
    const number = assignmentAmbulanceNumber(todayAssignment);
    const plateFromAssignment = assignmentAmbulancePlate(todayAssignment);
    const fromList = id ? ambulances.find((a) => a._id === id) : undefined;
    const plate = plateFromAssignment || fromList?.licensePlate?.trim() || "";
    const brand = fromList?.brand?.trim() || "";
    const model = fromList?.modelName?.trim() || "";
    return { id, number, plate, brand, model };
  }, [ambulances, todayAssignment]);

  const tripsCounted = useMemo(
    () => trips.filter(tripCountsTowardWorkday).length,
    [trips],
  );

  const bodyEl = useMemo(() => {
    switch (activeKey) {
      case "inicio":
        return (
          <View style={styles.placeholderBlock}>
            <Text style={styles.placeholderTitle}>Resumen del dia</Text>
            <Text style={styles.placeholderText}>
              Aqui podras revisar el cierre del dia: valores de O2, kilometros finales de ambulancia,
              averias y envio del reporte al administrador.
            </Text>
            <View style={styles.statPill}>
              <Text style={styles.statPillLabel}>Viajes registrados (hoy)</Text>
              <Text style={styles.statPillValue}>{tripsCounted}</Text>
            </View>
            {sentIssuesToday.length > 0 ? (
              <View style={styles.sentIssuesCard}>
                <Text style={styles.sentIssuesTitle}>
                  Averías enviadas hoy ({sentIssuesToday.length})
                </Text>
                {sentIssuesToday.map((item, idx) => (
                  <View key={`${item._id}-${idx}`} style={styles.sentIssueRow}>
                    <Text style={styles.sentIssueLine}>
                      {new Date(item.timestamp).toLocaleTimeString("es-ES", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })} · Amb. {item.ambulanceNumber || "N/A"} · Km {item.finalKm ?? "N/A"}
                    </Text>
                    <Text style={styles.sentIssueLine} numberOfLines={2}>
                      {item.issueText}
                    </Text>
                    <Text style={styles.sentIssueMeta}>
                      Fotos adjuntas: {item.attachments?.length ?? 0}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        );
      case "checks":
        return (
          <View style={styles.placeholderBlock}>
            <Text style={styles.placeholderTitle}>Checks de ambulancia</Text>
            <View style={styles.issueCard}>
              {VEHICLE_CHECKLIST.map((item) => (
                <Pressable
                  key={item.key}
                  style={styles.checklistRow}
                  onPress={() =>
                    setChecklistItems((prev) => ({ ...prev, [item.key]: !prev[item.key] }))
                  }
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: checklistItems[item.key] }}
                >
                  <View style={[styles.checkBox, checklistItems[item.key] ? styles.checkBoxChecked : null]}>
                    {checklistItems[item.key] ? (
                      <Text style={styles.checkMark}>✓</Text>
                    ) : null}
                  </View>
                  <Text style={styles.checklistLabel}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.issueCard}>
              <Text style={styles.inputLabel}>Km finales de jornada</Text>
              <TextInput
                style={styles.issueInput}
                value={finalKm}
                onChangeText={setFinalKm}
                keyboardType="decimal-pad"
                placeholder="Ej. 128450"
                placeholderTextColor="#94a3b8"
              />
              <Text style={styles.inputLabel}>Nivel O2 (litros)</Text>
              <TextInput
                style={styles.issueInput}
                value={o2Level}
                onChangeText={setO2Level}
                keyboardType="decimal-pad"
                placeholder="Ej. 40"
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>
        );
      case "viajes":
        if (loadingTrips) {
          return (
            <View style={styles.centerInline}>
              <ActivityIndicator color="#0f766e" />
              <Text style={styles.mutedSmall}>Cargando viajes…</Text>
            </View>
          );
        }
        if (loadError) {
          return (
            <View style={styles.placeholderBlock}>
              <Text style={styles.errorInline}>{loadError}</Text>
              <Pressable style={styles.retryMini} onPress={() => void loadTrips()}>
                <Text style={styles.retryMiniText}>Reintentar</Text>
              </Pressable>
            </View>
          );
        }
        if (trips.length === 0) {
          return (
            <Text style={styles.placeholderText}>No hay viajes registrados hoy.</Text>
          );
        }
        return (
          <View style={styles.tripListWrap}>
            {trips.map((trip) => {
              const auf = (trip.auftragNumber ?? "").trim() || "—";
              const pat = (trip.patientName ?? "").trim() || "—";
              const dur = tripDurationMinutes(trip);
              const km = tripKmForDisplay(trip);
              const minText = dur != null ? `${dur} min` : "—";
              const kmText = km === "—" ? "—" : `${km} km`;
              const isStorno = Boolean(trip.wasCancelled);
              const stornoCounts = trip.countsTrip === 0 ? "0" : "+1";
              return (
                <View key={trip._id} style={styles.tripGridRow}>
                  <View style={styles.tripColAuf}>
                    <Text
                      style={[styles.tripCellText, isStorno ? styles.tripCellStorno : null]}
                      numberOfLines={2}
                      ellipsizeMode="tail"
                    >
                      {auf}
                    </Text>
                    {isStorno ? (
                      <Text style={styles.tripStornoBadge} numberOfLines={1}>
                        Storno · {stornoCounts}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.tripColPat}>
                    <Text style={styles.tripCellText} numberOfLines={2} ellipsizeMode="tail">
                      {pat}
                    </Text>
                  </View>
                  <View style={styles.tripColMin}>
                    <Text style={styles.tripMetricText} numberOfLines={1}>
                      {minText}
                    </Text>
                  </View>
                  <View style={styles.tripColKm}>
                    <Text style={styles.tripMetricText} numberOfLines={1}>
                      {kmText}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        );
      case "averias":
        if (loadingAssignment) {
          return (
            <View style={styles.centerInline}>
              <ActivityIndicator color="#0f766e" />
              <Text style={styles.mutedSmall}>Cargando asignación…</Text>
            </View>
          );
        }
        if (!todayAssignment) {
          return (
            <View style={styles.placeholderBlock}>
              <Text style={styles.placeholderTitle}>Averias</Text>
              <Text style={styles.placeholderText}>
                No tienes asignación activa hoy; no se puede reportar avería.
              </Text>
            </View>
          );
        }
        const assignmentAmbLine = selectedAmbulanceNumber.trim() || assignmentAmbulanceNumber(todayAssignment) || "N/A";
        return (
          <View style={styles.placeholderBlock}>
            <Text style={styles.placeholderTitle}>Averias</Text>
            <View style={styles.issueCard}>
              <View style={styles.assignmentTopGrid}>
                <Text style={styles.assignmentDienst} numberOfLines={1}>
                  Dienst #{todayAssignment.dienstNumber ?? "—"}
                </Text>
                <Text style={styles.assignmentSchedule} numberOfLines={1}>
                  {todayAssignment.startTime ?? "--:--"} - {todayAssignment.endTime ?? "--:--"}
                </Text>
                <Text style={styles.assignmentAmbulance} numberOfLines={1}>
                  {assignmentAmbLine}
                </Text>
              </View>
              <View style={styles.assignmentBottomRow}>
                <View style={styles.assignmentTeamRow}>
                  <Text style={styles.assignmentTeamTitle}>Equipo</Text>
                  <View style={styles.assignmentTeamMembersStack}>
                    <Text style={styles.assignmentTeamMember} numberOfLines={1}>
                      Driver: {userLabel(todayAssignment.driver)}
                    </Text>
                    <Text style={styles.assignmentTeamMember} numberOfLines={1}>
                      Medic: {userLabel(todayAssignment.medic)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.issueCard}>
              <View style={styles.ambulanceInfoGrid}>
                <View style={styles.ambulanceInfoCol}>
                  <Text style={styles.ambulanceInfoLabel}>Marca</Text>
                  <Text style={styles.ambulanceInfoValue} numberOfLines={1}>
                    {assignedAmbulanceData.brand || "N/A"}
                  </Text>
                </View>
                <View style={styles.ambulanceInfoCol}>
                  <Text style={styles.ambulanceInfoLabel}>Modelo</Text>
                  <Text style={styles.ambulanceInfoValue} numberOfLines={1}>
                    {assignedAmbulanceData.model || "N/A"}
                  </Text>
                </View>
                <View style={styles.ambulanceInfoCol}>
                  <Text style={styles.ambulanceInfoLabel}>Matrícula</Text>
                  <Text style={styles.ambulanceInfoValue} numberOfLines={1}>
                    {assignedAmbulanceData.plate || "N/A"}
                  </Text>
                </View>
                <View style={styles.ambulanceInfoCol}>
                  <Text style={styles.ambulanceInfoLabel}>Número</Text>
                  <Text style={styles.ambulanceInfoValue} numberOfLines={1}>
                    {assignedAmbulanceData.number || "N/A"}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.issueCard}>
              <Text style={styles.inputLabel}>Km final</Text>
              <TextInput
                style={styles.issueInput}
                value={finalKm}
                onChangeText={setFinalKm}
                keyboardType="decimal-pad"
                placeholder="Ej. 128450"
                placeholderTextColor="#94a3b8"
              />
              <Text style={styles.inputLabel}>Descripción de avería</Text>
              <TextInput
                style={[styles.issueInput, styles.issueTextarea]}
                value={issueText}
                onChangeText={setIssueText}
                multiline
                placeholder="Describe la avería..."
                placeholderTextColor="#94a3b8"
              />
            </View>

            <View style={styles.issueCard}>
              <Text style={styles.inputLabel}>Fotos (máx. 5)</Text>
              <View style={styles.photoActionsRow}>
                <Pressable style={styles.photoActionBtn} onPress={() => void pickIssuePhoto("camera")}>
                  <Text style={styles.photoActionBtnText}>Cámara</Text>
                </Pressable>
                <Pressable style={styles.photoActionBtn} onPress={() => void pickIssuePhoto("library")}>
                  <Text style={styles.photoActionBtnText}>Galería</Text>
                </Pressable>
              </View>
              {issuePhotos.length > 0 ? (
                <View style={styles.photoGrid}>
                  {issuePhotos.map((p, idx) => (
                    <Pressable
                      key={`${p.uri}-${idx}`}
                      onPress={() => setIssuePhotos((prev) => prev.filter((_, i) => i !== idx))}
                      style={styles.photoThumbWrap}
                    >
                      <Image source={{ uri: p.uri }} style={styles.photoThumb} />
                      <Text style={styles.photoRemove}>Quitar</Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text style={styles.mutedSmall}>Sin fotos adjuntas.</Text>
              )}
            </View>

            {issueFeedback ? (
              <Text style={styles.issueFeedback}>{issueFeedback}</Text>
            ) : null}

            <Pressable
              style={[styles.issueSubmitBtn, sendingIssue ? styles.issueSubmitBtnDisabled : null]}
              onPress={() => void sendIssue()}
              disabled={sendingIssue}
            >
              <Text style={styles.issueSubmitBtnText}>{sendingIssue ? "Enviando..." : "Enviar avería"}</Text>
            </Pressable>
          </View>
        );
      case "envio": {
        const checksDone = Object.values(checklistItems).filter(Boolean).length;
        const checksTotal = VEHICLE_CHECKLIST.length;
        const kmNum = Number(finalKm.trim().replace(",", "."));
        const kmValid = Number.isFinite(kmNum) && kmNum > 0;
        return (
          <View style={styles.placeholderBlock}>
            <Text style={styles.placeholderTitle}>Cierre de jornada</Text>
            <View style={styles.issueCard}>
              <View style={styles.closureSummaryRow}>
                <Text style={styles.closureSummaryLabel}>Viajes registrados</Text>
                <Text style={styles.closureSummaryValue}>{tripsCounted}</Text>
              </View>
              <View style={styles.closureSummaryRow}>
                <Text style={styles.closureSummaryLabel}>Checks completados</Text>
                <Text style={[styles.closureSummaryValue, checksDone < checksTotal ? styles.closureSummaryWarn : null]}>
                  {checksDone}/{checksTotal}
                </Text>
              </View>
              <View style={styles.closureSummaryRow}>
                <Text style={styles.closureSummaryLabel}>Km finales</Text>
                <Text style={[styles.closureSummaryValue, !kmValid ? styles.closureSummaryWarn : null]}>
                  {kmValid ? `${Math.round(kmNum)} km` : "—"}
                </Text>
              </View>
              {o2Level.trim() ? (
                <View style={styles.closureSummaryRow}>
                  <Text style={styles.closureSummaryLabel}>Nivel O2</Text>
                  <Text style={styles.closureSummaryValue}>{o2Level.trim()} L</Text>
                </View>
              ) : null}
            </View>
            {!kmValid ? (
              <Text style={styles.closureHint}>
                Introduce los km finales en la pestaña Checks antes de cerrar.
              </Text>
            ) : null}
            {closureFeedback ? (
              <Text style={[styles.issueFeedback, closureDone ? styles.closureSuccess : null]}>
                {closureFeedback}
              </Text>
            ) : null}
            <Pressable
              style={[
                styles.closureSubmitBtn,
                (closureSubmitting || closureDone || !kmValid) ? styles.issueSubmitBtnDisabled : null,
              ]}
              onPress={() => void submitClosure()}
              disabled={closureSubmitting || closureDone || !kmValid}
            >
              <Text style={styles.issueSubmitBtnText}>
                {closureDone ? "Jornada cerrada" : closureSubmitting ? "Enviando..." : "Cerrar jornada"}
              </Text>
            </Pressable>
          </View>
        );
      }
      default:
        return null;
    }
  }, [
    activeKey,
    assignedAmbulanceData.id,
    assignedAmbulanceData.brand,
    assignedAmbulanceData.model,
    assignedAmbulanceData.number,
    assignedAmbulanceData.plate,
    checklistItems,
    closureDone,
    closureFeedback,
    closureSubmitting,
    finalKm,
    issueFeedback,
    issuePhotos,
    issueText,
    loadError,
    loadingAssignment,
    loadingTrips,
    loadTrips,
    o2Level,
    sendIssue,
    sendingIssue,
    submitClosure,
    trips,
    tripsCounted,
    sentIssuesToday,
    todayAssignment,
    pickIssuePhoto,
  ]);

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.backBtn, pressed ? styles.backBtnPressed : null]}
          accessibilityRole="button"
          accessibilityLabel="Volver a Mi jornada"
          hitSlop={10}
        >
          <Ionicons name="chevron-back" size={26} color="#0f766e" />
        </Pressable>
        <View style={styles.topBarTitleWrap}>
          <Text style={styles.topBarTitle} numberOfLines={1}>
            Jornada en curso
          </Text>
          <Text style={styles.topBarSubtitle} numberOfLines={1}>
            Cierre del dia
          </Text>
        </View>
        <View style={styles.topBarRightSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {bodyEl}
      </ScrollView>

      <View style={styles.closureBottomNav}>
        {MENU.map((item) => {
          const active = activeKey === item.key;
          return (
            <Pressable
              key={item.key}
              style={styles.closureTabButton}
              onPress={() => setActiveKey(item.key)}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
            >
              <Ionicons
                name={item.icon}
                size={21}
                color={active ? "#0f766e" : "#64748b"}
                style={styles.closureTabIcon}
              />
              <Text
                style={[styles.closureTabText, active ? styles.closureTabTextActive : null]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  backBtnPressed: {
    opacity: 0.75,
    backgroundColor: "#e2e8f0",
  },
  topBarTitleWrap: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  topBarSubtitle: {
    marginTop: 1,
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
  },
  topBarRightSpacer: {
    width: 44,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    flexGrow: 1,
  },
  placeholderBlock: {
    gap: 10,
  },
  placeholderTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  placeholderText: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 20,
  },
  placeholderHint: {
    marginTop: 4,
    fontSize: 12,
    color: "#94a3b8",
    fontStyle: "italic",
  },
  statPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  statPillLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#047857",
  },
  statPillValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#047857",
    fontVariant: ["tabular-nums"],
  },
  sentIssuesCard: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#fbcfe8",
    backgroundColor: "#fff1f2",
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  sentIssuesTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#9f1239",
  },
  sentIssueRow: {
    gap: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#fda4af",
    paddingTop: 8,
  },
  sentIssueLine: {
    fontSize: 12,
    color: "#881337",
    fontWeight: "600",
    lineHeight: 16,
  },
  sentIssueMeta: {
    fontSize: 11,
    color: "#9f1239",
  },
  centerInline: {
    paddingVertical: 24,
    alignItems: "center",
    gap: 8,
  },
  mutedSmall: {
    fontSize: 13,
    color: "#64748b",
  },
  errorInline: {
    color: "#b91c1c",
    fontSize: 14,
    textAlign: "center",
  },
  retryMini: {
    alignSelf: "center",
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#0f766e",
    backgroundColor: "#ffffff",
  },
  retryMiniText: {
    color: "#0f766e",
    fontWeight: "700",
    fontSize: 13,
  },
  tripListWrap: {
    gap: 0,
  },
  tripGridRow: {
    flexDirection: "row",
    alignItems: "stretch",
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
  issueCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  issueMeta: {
    fontSize: 12,
    color: "#334155",
    fontWeight: "600",
  },
  ambulanceInfoGrid: {
    flexDirection: "row",
    alignItems: "flex-start",
    width: "100%",
    gap: 12,
  },
  ambulanceInfoCol: {
    flex: 1,
    flexBasis: 0,
    gap: 2,
    alignItems: "center",
  },
  ambulanceInfoLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "700",
    textAlign: "center",
  },
  ambulanceInfoValue: {
    fontSize: 12,
    color: "#0f172a",
    fontWeight: "600",
    textAlign: "center",
  },
  assignmentTopGrid: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  assignmentDienst: {
    flex: 1,
    color: "#334155",
    fontWeight: "700",
    fontSize: 13,
  },
  assignmentSchedule: {
    minWidth: 88,
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 13,
    textAlign: "center",
  },
  assignmentAmbulance: {
    flex: 0.9,
    color: "#475569",
    fontSize: 13,
    textAlign: "right",
  },
  assignmentBottomRow: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 8,
  },
  assignmentTeamRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  assignmentTeamTitle: {
    flex: 0.5,
    fontSize: 12,
    color: "#334155",
    fontWeight: "700",
    textAlign: "left",
  },
  assignmentTeamMembersStack: {
    flex: 1,
    alignItems: "flex-start",
    justifyContent: "center",
    alignSelf: "flex-end",
    gap: 2,
  },
  assignmentTeamMember: {
    fontSize: 12,
    color: "#475569",
    textAlign: "left",
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  issueInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    color: "#0f172a",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  issueTextarea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  photoActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  photoActionBtn: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  photoActionBtnText: {
    fontSize: 12,
    color: "#334155",
    fontWeight: "700",
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  photoThumbWrap: {
    width: 86,
    gap: 4,
    alignItems: "center",
  },
  photoThumb: {
    width: 86,
    height: 64,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  photoRemove: {
    fontSize: 11,
    color: "#b91c1c",
    fontWeight: "600",
  },
  issueFeedback: {
    fontSize: 12,
    color: "#334155",
    textAlign: "center",
  },
  issueSubmitBtn: {
    alignSelf: "stretch",
    borderWidth: 1,
    borderColor: "#be123c",
    backgroundColor: "#e11d48",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  issueSubmitBtnDisabled: {
    opacity: 0.6,
  },
  issueSubmitBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  checklistRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  checkBoxChecked: {
    borderColor: "#0f766e",
    backgroundColor: "#0f766e",
  },
  checkMark: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 16,
  },
  checklistLabel: {
    flex: 1,
    fontSize: 13,
    color: "#334155",
    fontWeight: "500",
  },
  closureSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  closureSummaryLabel: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "600",
  },
  closureSummaryValue: {
    fontSize: 13,
    color: "#0f172a",
    fontWeight: "700",
  },
  closureSummaryWarn: {
    color: "#b45309",
  },
  closureHint: {
    fontSize: 12,
    color: "#92400e",
    backgroundColor: "#fef3c7",
    borderRadius: 8,
    padding: 8,
    lineHeight: 16,
  },
  closureSuccess: {
    color: "#047857",
    fontWeight: "700",
  },
  closureSubmitBtn: {
    alignSelf: "stretch",
    borderWidth: 1,
    borderColor: "#0e7490",
    backgroundColor: "#0891b2",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  closureBottomNav: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    paddingTop: 6,
    paddingBottom: 6,
  },
  closureTabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 2,
    minWidth: 0,
    paddingHorizontal: 1,
  },
  closureTabIcon: {
    marginBottom: 0,
  },
  closureTabText: {
    fontSize: 9,
    color: "#64748b",
    textAlign: "center",
    maxWidth: "100%",
  },
  closureTabTextActive: {
    color: "#0f766e",
    fontWeight: "700",
  },
});
