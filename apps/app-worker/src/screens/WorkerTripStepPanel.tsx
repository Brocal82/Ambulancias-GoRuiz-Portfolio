import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import {
  AssignedDay,
  CreateTripPayload,
  createWorkdayTrip,
} from "../services/workday";
import { ApiError } from "../services/http";
import { checkTripLogic, type TripDraft } from "../utils/tripValidators";
import { getCurrentTimeString } from "../utils/tripTime";

const LONG_PRESS_MS = 1200;
const ANSCHLUSS_MARKER = "🔗 Anschluss";

const STEP_TITLES: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "Hora del Auftrag",
  2: "Llegada a domicilio",
  3: "Paciente sube (recogida)",
  4: "Llegada con paciente a destino",
  5: "Libre (fin del viaje)",
};

type Phase = "meta" | "steps";

type AssignedDayFull = AssignedDay & {
  driver: { _id: string };
  medic: { _id: string };
};

function emptyDraft(assigned: AssignedDayFull): CreateTripPayload {
  return {
    date: assigned.date,
    assignmentId: assigned.assignmentId,
    driver: assigned.driver._id,
    medic: assigned.medic._id,
    auftragNumber: "",
    patientName: "",
    fromAddress: "",
    toAddress: "",
    timeWarning: "",
    timeAtHome: "",
    timePickup: "",
    timeArrival: "",
    timeEnd: "",
    kmStart: 0,
    kmEnd: 0,
    wasCancelled: false,
    cancelledAtPickup: false,
    countsTrip: 1,
    reports: "",
    countsForSummary: true,
  };
}

function metaCompleteForStorno(d: CreateTripPayload): boolean {
  return (
    d.auftragNumber.trim() !== "" &&
    d.patientName.trim() !== "" &&
    d.fromAddress.trim() !== "" &&
    d.toAddress.trim() !== ""
  );
}

/** Misma idea que la web: Storno con wasCancelled y countsTrip 0 | 1; horas/km pueden ir vacíos/0. */
function buildStornoTripPayload(
  d: CreateTripPayload,
  assigned: AssignedDayFull,
  countsTrip: 0 | 1,
): CreateTripPayload {
  const nz = (n: number) => (typeof n === "number" && !Number.isNaN(n) ? n : 0);
  return {
    date: assigned.date,
    assignmentId: assigned.assignmentId,
    driver: assigned.driver._id,
    medic: assigned.medic._id,
    auftragNumber: d.auftragNumber.trim(),
    patientName: d.patientName.trim(),
    fromAddress: d.fromAddress.trim(),
    toAddress: d.toAddress.trim(),
    timeWarning: d.timeWarning.trim() || getCurrentTimeString(),
    timeAtHome: d.timeAtHome.trim() || "",
    timePickup: d.timePickup.trim() || "",
    timeArrival: d.timeArrival.trim() || "",
    timeEnd: d.timeEnd.trim() || "",
    kmStart: nz(d.kmStart),
    kmEnd: nz(d.kmEnd),
    wasCancelled: true,
    cancelledAtPickup: false,
    countsTrip,
    reports: (d.reports ?? "").trim(),
    countsForSummary: true,
  };
}

function parsePositiveKm(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (Number.isNaN(n) || n <= 0) return null;
  return n;
}

type Props = {
  assignedDay: AssignedDayFull;
  canStartWork: boolean;
  blocked: boolean;
  /** Igual que la web: hasta confirmar km (y ambulancia) en cabecera no se registran viajes. */
  vehicleSetupComplete?: boolean;
  onTripCreated: () => void;
};

export function WorkerTripStepPanel({
  assignedDay,
  canStartWork,
  blocked,
  vehicleSetupComplete = true,
  onTripCreated,
}: Props) {
  const [phase, setPhase] = useState<Phase>("meta");
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [draft, setDraft] = useState<CreateTripPayload>(() => emptyDraft(assignedDay));
  const [kmDraft2, setKmDraft2] = useState("");
  const [kmDraft4, setKmDraft4] = useState("");
  const [pendingPatient1Anschluss, setPendingPatient1Anschluss] =
    useState<CreateTripPayload | null>(null);
  const [anschlussAwaitingPatient2Step3, setAnschlussAwaitingPatient2Step3] = useState(false);
  const [anschlussMinKmStart, setAnschlussMinKmStart] = useState<number | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFlash, setSaveFlash] = useState<string | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [kmFieldFocus, setKmFieldFocus] = useState<null | "2" | "4">(null);
  const [stornoBarOpen, setStornoBarOpen] = useState(false);
  const [stornoCountsTrip, setStornoCountsTrip] = useState<0 | 1>(1);

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const roundStepSize = Math.max(
    118,
    Math.min(176, Math.round(windowWidth * 0.42), Math.round(windowHeight * 0.26)),
  );

  const draftRef = useRef(draft);
  const km2Ref = useRef(kmDraft2);
  const km4Ref = useRef(kmDraft4);
  /** Paso del P1 al activar Anschluss; al cancelar se restaura (comportamiento tipo web). */
  const anschlussResumeStepRef = useRef<1 | 2 | 3 | 4 | 5 | null>(null);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  useEffect(() => {
    km2Ref.current = kmDraft2;
  }, [kmDraft2]);
  useEffect(() => {
    km4Ref.current = kmDraft4;
  }, [kmDraft4]);

  const saveFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashSave = useCallback((msg: string) => {
    if (saveFlashTimerRef.current !== null) clearTimeout(saveFlashTimerRef.current);
    setSaveFlash(msg);
    saveFlashTimerRef.current = setTimeout(() => {
      setSaveFlash(undefined);
      saveFlashTimerRef.current = null;
    }, 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (saveFlashTimerRef.current !== null) clearTimeout(saveFlashTimerRef.current);
    };
  }, []);

  const clearStepHoldTimer = useCallback(() => {
    if (stepHoldTimerRef.current !== null) {
      clearTimeout(stepHoldTimerRef.current);
      stepHoldTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearStepHoldTimer();
  }, [clearStepHoldTimer]);

  useEffect(() => {
    clearStepHoldTimer();
  }, [phase, currentStep, clearStepHoldTimer]);

  useEffect(() => {
    if (phase === "meta" || currentStep <= 1) {
      setStornoBarOpen(false);
    }
  }, [phase, currentStep]);

  const canUseKmStep2 = useMemo(() => parsePositiveKm(kmDraft2) !== null, [kmDraft2]);
  const canUseKmStep4 = useMemo(() => parsePositiveKm(kmDraft4) !== null, [kmDraft4]);
  /** Odómetro destino (paso 4) estrictamente por debajo del de inicio: aviso visual, sin sustituir al error de hora LIBRE. */
  const km4InvalidVsStart = useMemo(() => {
    const k = parsePositiveKm(kmDraft4);
    const start = Number(draft.kmStart);
    if (k === null || !Number.isFinite(start) || start <= 0) {
      return false;
    }
    return k < start;
  }, [kmDraft4, draft.kmStart]);

  /**
   * Anschluss · P2 paso 2: el odómetro debe ser ≥ referencia del P1 (prioriza km destino P1 / paso 4 vía anschlussMinKmStart).
   * Misma UX que paso 4 normal: rojo + botón deshabilitado si es menor.
   */
  const km2InvalidVsAnschlussFloor = useMemo(() => {
    if (!anschlussAwaitingPatient2Step3) {
      return false;
    }
    if (
      typeof anschlussMinKmStart !== "number" ||
      Number.isNaN(anschlussMinKmStart) ||
      anschlussMinKmStart <= 0
    ) {
      return false;
    }
    const k = parsePositiveKm(kmDraft2);
    if (k === null) {
      return false;
    }
    return k < anschlussMinKmStart;
  }, [anschlussAwaitingPatient2Step3, anschlussMinKmStart, kmDraft2]);

  const runCheckTripLogic = useCallback((row: TripDraft, minKm?: number) => {
    return checkTripLogic(row, false, minKm);
  }, []);

  const commitTimeForStep = useCallback(
    async (step: 1 | 2 | 3 | 4 | 5) => {
      const nowStr = getCurrentTimeString();

      if (step === 1) {
        setDraft((prev) => ({ ...prev, timeWarning: nowStr }));
        setCurrentStep(2);
        setKmDraft2("");
        return;
      }

      if (step === 2) {
        const km = parsePositiveKm(km2Ref.current);
        if (km === null) return;
        const base = draftRef.current;
        const logic2 = runCheckTripLogic(
          {
            timeWarning: base.timeWarning,
            timeAtHome: nowStr,
            timePickup: base.timePickup,
            timeArrival: base.timeArrival,
            timeEnd: base.timeEnd,
            kmStart: km,
            kmEnd: base.kmEnd,
          },
          anschlussMinKmStart,
        );
        if (logic2.error) {
          setErrorMessage(logic2.error);
          return;
        }
        setErrorMessage(undefined);
        setDraft((prev) => ({ ...prev, timeAtHome: nowStr, kmStart: km }));
        setCurrentStep(3);
        return;
      }

      if (step === 3) {
        if (anschlussAwaitingPatient2Step3 && pendingPatient1Anschluss) {
          const kmForPatient1End = Number(draftRef.current.kmStart);
          const trip1: CreateTripPayload = {
            ...pendingPatient1Anschluss,
            timeArrival: nowStr,
            kmEnd: kmForPatient1End,
            timeEnd: ANSCHLUSS_MARKER,
          };
          const logic1 = runCheckTripLogic(trip1);
          if (logic1.error) {
            setErrorMessage(logic1.error);
            return;
          }
          setErrorMessage(undefined);
          setIsSaving(true);
          try {
            await createWorkdayTrip(trip1);
            onTripCreated();
            flashSave("✓ Paciente 1 guardado");
            setPendingPatient1Anschluss(null);
            setAnschlussAwaitingPatient2Step3(false);
            setAnschlussMinKmStart(undefined);
            anschlussResumeStepRef.current = null;
            setDraft((prev) => ({ ...prev, timePickup: nowStr }));
            setCurrentStep(4);
            setKmDraft4("");
          } catch (error) {
            if (error instanceof ApiError) {
              setErrorMessage(error.message);
            } else {
              setErrorMessage("No se pudo guardar el viaje Anschluss (paciente 1).");
            }
          } finally {
            setIsSaving(false);
          }
          return;
        }

        setDraft((prev) => ({ ...prev, timePickup: nowStr }));
        setCurrentStep(4);
        setKmDraft4("");
        return;
      }

      if (step === 4) {
        const km = parsePositiveKm(km4Ref.current);
        if (km === null) return;
        const base = draftRef.current;
        const logic4 = runCheckTripLogic(
          {
            timeWarning: base.timeWarning,
            timeAtHome: base.timeAtHome,
            timePickup: base.timePickup,
            timeArrival: nowStr,
            timeEnd: base.timeEnd,
            kmStart: base.kmStart,
            kmEnd: km,
          },
          anschlussMinKmStart,
        );
        if (logic4.error) {
          setErrorMessage(logic4.error);
          return;
        }
        setErrorMessage(undefined);
        setDraft((prev) => ({ ...prev, timeArrival: nowStr, kmEnd: km }));
        setCurrentStep(5);
        return;
      }

      if (step === 5) {
        const finalDraft: CreateTripPayload = { ...draftRef.current, timeEnd: nowStr };
        if (
          !finalDraft.auftragNumber.trim() ||
          !finalDraft.patientName.trim() ||
          !finalDraft.fromAddress.trim() ||
          !finalDraft.toAddress.trim() ||
          !finalDraft.timeWarning ||
          !finalDraft.timeAtHome ||
          !finalDraft.timePickup ||
          !finalDraft.timeArrival ||
          !finalDraft.timeEnd ||
          finalDraft.kmStart === 0 ||
          finalDraft.kmEnd === 0
        ) {
          setErrorMessage("Faltan datos obligatorios del viaje.");
          return;
        }
        const logic = runCheckTripLogic(finalDraft, anschlussMinKmStart);
        if (logic.error) {
          setErrorMessage(logic.error);
          return;
        }
        setErrorMessage(undefined);
        setIsSaving(true);
        try {
          await createWorkdayTrip(finalDraft);
          onTripCreated();
          flashSave("✓ Viaje registrado");
          setDraft(emptyDraft(assignedDay));
          setPhase("meta");
          setCurrentStep(1);
          setKmDraft2("");
          setKmDraft4("");
          setPendingPatient1Anschluss(null);
          setAnschlussAwaitingPatient2Step3(false);
          setAnschlussMinKmStart(undefined);
          anschlussResumeStepRef.current = null;
        } catch (error) {
          if (error instanceof ApiError) {
            setErrorMessage(error.message);
          } else {
            setErrorMessage("No se pudo guardar el viaje.");
          }
        } finally {
          setIsSaving(false);
        }
      }
    },
    [
      anschlussAwaitingPatient2Step3,
      anschlussMinKmStart,
      assignedDay,
      flashSave,
      onTripCreated,
      pendingPatient1Anschluss,
      runCheckTripLogic,
    ],
  );

  const armStepHold = useCallback(
    (step: 1 | 2 | 3 | 4 | 5, disabled: boolean) => {
      if (disabled) return;
      clearStepHoldTimer();
      stepHoldTimerRef.current = setTimeout(() => {
        stepHoldTimerRef.current = null;
        void commitTimeForStep(step);
      }, LONG_PRESS_MS);
    },
    [clearStepHoldTimer, commitTimeForStep],
  );

  const handleStartAnschluss = useCallback(() => {
    if (!draft.toAddress.trim()) {
      setErrorMessage("Indica destino antes de usar Anschluss.");
      return;
    }
    if (!draft.timePickup.trim()) {
      setErrorMessage("Registra primero la hora de carga del paciente (paso 3) antes de Anschluss.");
      return;
    }
    const logicBefore = runCheckTripLogic(
      {
        timeWarning: draft.timeWarning,
        timeAtHome: draft.timeAtHome,
        timePickup: draft.timePickup,
        timeArrival: draft.timeArrival,
        timeEnd: draft.timeEnd,
        kmStart: draft.kmStart,
        kmEnd: draft.kmEnd,
      },
      undefined,
    );
    if (logicBefore.error) {
      setErrorMessage(logicBefore.error);
      return;
    }
    anschlussResumeStepRef.current = currentStep;
    const snapshot: CreateTripPayload = { ...draft };
    setPendingPatient1Anschluss(snapshot);
    /** Odómetro mínimo coherente: destino P1 si ya hay km de llegada; si no, último km conocido del P1 (domicilio/carga). */
    const p1KmEnd = Number(snapshot.kmEnd);
    const p1KmStart = Number(snapshot.kmStart);
    const anschlussKmFloor =
      !Number.isNaN(p1KmEnd) && p1KmEnd > 0
        ? p1KmEnd
        : !Number.isNaN(p1KmStart) && p1KmStart > 0
          ? p1KmStart
          : undefined;
    setAnschlussMinKmStart(anschlussKmFloor);
    setAnschlussAwaitingPatient2Step3(true);
    setDraft({
      date: assignedDay.date,
      assignmentId: assignedDay.assignmentId,
      driver: assignedDay.driver._id,
      medic: assignedDay.medic._id,
      auftragNumber: "",
      patientName: "",
      fromAddress: snapshot.toAddress,
      toAddress: "",
      timeWarning: getCurrentTimeString(),
      timeAtHome: "",
      timePickup: "",
      timeArrival: "",
      timeEnd: "",
      kmStart: snapshot.kmEnd,
      kmEnd: 0,
      wasCancelled: false,
      cancelledAtPickup: false,
      countsTrip: 1,
      reports: "",
      countsForSummary: true,
    });
    setCurrentStep(1);
    setKmDraft2("");
    setKmDraft4("");
    setPhase("meta");
    setErrorMessage(undefined);
  }, [assignedDay, currentStep, draft, runCheckTripLogic]);

  const handleCancelAnschluss = useCallback(() => {
    const snap = pendingPatient1Anschluss;
    if (!snap) return;
    const resumeStep = anschlussResumeStepRef.current;
    anschlussResumeStepRef.current = null;
    setDraft({ ...snap });
    setPendingPatient1Anschluss(null);
    setAnschlussAwaitingPatient2Step3(false);
    setAnschlussMinKmStart(undefined);
    setPhase("steps");
    if (resumeStep != null) {
      setCurrentStep(resumeStep);
    }
    setKmDraft2(String(snap.kmStart || ""));
    setKmDraft4(String(snap.kmEnd || ""));
    setErrorMessage(undefined);
  }, [pendingPatient1Anschluss]);

  const toggleStornoBar = useCallback(() => {
    if (!canStartWork) {
      setErrorMessage("Aun no puedes registrar viajes en esta ventana horaria.");
      return;
    }
    if (!metaCompleteForStorno(draftRef.current)) {
      setErrorMessage("Completa Auftrag, paciente, origen y destino para Storno.");
      return;
    }
    if (anschlussAwaitingPatient2Step3 && pendingPatient1Anschluss) {
      setErrorMessage("Cancela el Anschluss antes de registrar un Storno.");
      return;
    }
    setStornoBarOpen((open) => {
      const next = !open;
      if (next) setStornoCountsTrip(1);
      return next;
    });
    setErrorMessage(undefined);
  }, [anschlussAwaitingPatient2Step3, canStartWork, pendingPatient1Anschluss]);

  const handleConfirmStorno = useCallback(async () => {
    if (!canStartWork) {
      setErrorMessage("Aun no puedes registrar viajes en esta ventana horaria.");
      return;
    }
    if (anschlussAwaitingPatient2Step3 && pendingPatient1Anschluss) {
      setErrorMessage("Cancela el Anschluss antes de registrar un Storno.");
      return;
    }
    const d = draftRef.current;
    if (!metaCompleteForStorno(d)) {
      setErrorMessage("Completa Auftrag, paciente, origen y destino.");
      return;
    }
    const payload = buildStornoTripPayload(d, assignedDay, stornoCountsTrip);
    setErrorMessage(undefined);
    setIsSaving(true);
    try {
      await createWorkdayTrip(payload);
      onTripCreated();
      flashSave("✓ Storno registrado");
      setStornoBarOpen(false);
      setStornoCountsTrip(1);
      setDraft(emptyDraft(assignedDay));
      setPhase("meta");
      setCurrentStep(1);
      setKmDraft2("");
      setKmDraft4("");
      setPendingPatient1Anschluss(null);
      setAnschlussAwaitingPatient2Step3(false);
      setAnschlussMinKmStart(undefined);
      anschlussResumeStepRef.current = null;
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("No se pudo guardar el Storno.");
      }
    } finally {
      setIsSaving(false);
    }
  }, [
    anschlussAwaitingPatient2Step3,
    assignedDay,
    canStartWork,
    flashSave,
    onTripCreated,
    pendingPatient1Anschluss,
    stornoCountsTrip,
  ]);

  const p1TripDraftForAnschluss: TripDraft = useMemo(
    () => ({
      timeWarning: draft.timeWarning,
      timeAtHome: draft.timeAtHome,
      timePickup: draft.timePickup,
      timeArrival: draft.timeArrival,
      timeEnd: draft.timeEnd,
      kmStart: draft.kmStart,
      kmEnd: draft.kmEnd,
    }),
    [
      draft.timeWarning,
      draft.timeAtHome,
      draft.timePickup,
      draft.timeArrival,
      draft.timeEnd,
      draft.kmStart,
      draft.kmEnd,
    ],
  );

  const anschlussCanStart = useMemo(() => {
    if (phase !== "steps" || anschlussAwaitingPatient2Step3) return false;
    if (!draft.toAddress.trim() || !draft.timePickup.trim()) return false;
    return !runCheckTripLogic(p1TripDraftForAnschluss, undefined).error;
  }, [
    phase,
    anschlussAwaitingPatient2Step3,
    draft.toAddress,
    draft.timePickup,
    p1TripDraftForAnschluss,
    runCheckTripLogic,
  ]);

  if (blocked) {
    return (
      <View style={styles.card}>
        <Text style={styles.blockedText}>La jornada esta cerrada: no se pueden registrar mas viajes.</Text>
      </View>
    );
  }

  if (!vehicleSetupComplete) {
    return (
      <View style={styles.card}>
        <Text style={styles.hintText}>
          Antes de registrar viajes, indica en la cabecera los kilometros iniciales del odometro de la ambulancia
          (columna Ambulancia) y pulsa Confirmar. Misma regla que en la web.
        </Text>
      </View>
    );
  }

  if (!canStartWork) {
    return (
      <View style={styles.card}>
        <Text style={styles.hintText}>
          Aun no puedes registrar viajes. Podras empezar 30 minutos antes de {assignedDay.startTime ?? "--:--"}.
        </Text>
      </View>
    );
  }

  const needsKmNow = currentStep === 2 || currentStep === 4;
  const kmReadyNow = currentStep === 2 ? canUseKmStep2 : currentStep === 4 ? canUseKmStep4 : true;
  const bigStepDisabled =
    !canStartWork ||
    isSaving ||
    (needsKmNow && !kmReadyNow) ||
    (currentStep === 2 && km2InvalidVsAnschlussFloor) ||
    (currentStep === 4 && km4InvalidVsStart);

  const showAnschlussSlot =
    phase === "steps" && draft.timePickup.trim() !== "" && !anschlussAwaitingPatient2Step3;
  const anschlussEnabled = anschlussCanStart && !isSaving;

  const goToSteps = () => {
    if (
      !draft.auftragNumber.trim() ||
      !draft.patientName.trim() ||
      !draft.fromAddress.trim() ||
      !draft.toAddress.trim()
    ) {
      setErrorMessage("Completa Auftrag, paciente, origen y destino.");
      return;
    }
    setErrorMessage(undefined);
    setStornoBarOpen(false);
    setStornoCountsTrip(1);
    setPhase("steps");
    setCurrentStep(1);
    setKmDraft2("");
    setKmDraft4("");
  };

  const resetDraft = () => {
    setStornoBarOpen(false);
    setStornoCountsTrip(1);
    setPhase("meta");
    setCurrentStep(1);
    setDraft(emptyDraft(assignedDay));
    setKmDraft2("");
    setKmDraft4("");
    setPendingPatient1Anschluss(null);
    setAnschlussAwaitingPatient2Step3(false);
    setAnschlussMinKmStart(undefined);
    anschlussResumeStepRef.current = null;
    setErrorMessage(undefined);
  };

  const showStornoUi = phase === "steps" && currentStep > 1;

  const stornoPanelEl = showStornoUi && stornoBarOpen ? (
    <View style={styles.stornoPanel}>
      <Text style={styles.stornoPanelTitle}>Cuenta en viajes de la jornada</Text>
      <View style={styles.stornoPillsRow}>
        <Pressable
          onPress={() => setStornoCountsTrip(1)}
          style={[styles.stornoPill, stornoCountsTrip === 1 ? styles.stornoPillActiveYes : null]}
        >
          <Text
            style={[
              styles.stornoPillText,
              stornoCountsTrip === 1 ? styles.stornoPillTextActiveYes : null,
            ]}
          >
            +1
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setStornoCountsTrip(0)}
          style={[styles.stornoPill, stornoCountsTrip === 0 ? styles.stornoPillActiveNo : null]}
        >
          <Text
            style={[
              styles.stornoPillText,
              stornoCountsTrip === 0 ? styles.stornoPillTextActiveNo : null,
            ]}
          >
            0
          </Text>
        </Pressable>
      </View>
      <View style={styles.stornoActionsRow}>
        <Pressable
          style={styles.stornoSecondaryButton}
          onPress={() => {
            setStornoBarOpen(false);
            setErrorMessage(undefined);
          }}
        >
          <Text style={styles.stornoSecondaryButtonText}>Cancelar</Text>
        </Pressable>
        <Pressable
          style={[styles.stornoPrimaryButton, isSaving ? styles.stornoPrimaryButtonDisabled : null]}
          disabled={isSaving}
          onPress={() => void handleConfirmStorno()}
        >
          <Text style={styles.stornoPrimaryButtonText}>Guardar Storno</Text>
        </Pressable>
      </View>
    </View>
  ) : null;

  return (
    <KeyboardAvoidingView
      style={styles.panelRoot}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 72 : 0}
    >
      {saveFlash ? (
        <View style={styles.saveFlashBanner}>
          <Text style={styles.saveFlashText}>{saveFlash}</Text>
        </View>
      ) : null}
      {phase === "meta" ? (
        <View style={[styles.card, styles.panelCard]}>
          <Text style={styles.cardTitle}>
            {anschlussAwaitingPatient2Step3 ? "Paciente 2 (Anschluss)" : "Nuevo viaje"}
          </Text>
          <View style={styles.metaColumn}>
            <View style={styles.metaBody}>
              <View style={styles.patientDataCard}>
                <Text style={styles.patientCardTitle}>
                  {anschlussAwaitingPatient2Step3 ? "Datos del paciente 2" : "Datos del paciente"}
                </Text>
                <View style={styles.formFieldBlock}>
                  <Text style={styles.fieldLabel}>Auftrag</Text>
                  <TextInput
                    style={styles.inputInCard}
                    value={draft.auftragNumber}
                    onChangeText={(text) => setDraft((prev) => ({ ...prev, auftragNumber: text }))}
                    placeholder="Numero"
                  />
                </View>
                <View style={styles.formFieldBlock}>
                  <Text style={styles.fieldLabel}>Paciente</Text>
                  <TextInput
                    style={styles.inputInCard}
                    value={draft.patientName}
                    onChangeText={(text) => setDraft((prev) => ({ ...prev, patientName: text }))}
                    placeholder="Nombre"
                  />
                </View>
                <View style={styles.formFieldBlock}>
                  <Text style={styles.fieldLabel}>Recogida (origen del P2)</Text>
                  <TextInput
                    style={[
                      styles.inputInCard,
                      anschlussAwaitingPatient2Step3 ? styles.inputInCardReadonly : null,
                    ]}
                    value={draft.fromAddress}
                    editable={!anschlussAwaitingPatient2Step3}
                    onChangeText={(text) => setDraft((prev) => ({ ...prev, fromAddress: text }))}
                    placeholder="Direccion de recogida"
                  />
                  {anschlussAwaitingPatient2Step3 ? (
                    <Text style={styles.anschlussFieldHint}>Enlazada al destino del paciente 1.</Text>
                  ) : null}
                </View>
                <View style={styles.formFieldBlock}>
                  <Text style={styles.fieldLabel}>Destino</Text>
                  <TextInput
                    style={styles.inputInCard}
                    value={draft.toAddress}
                    onChangeText={(text) => setDraft((prev) => ({ ...prev, toAddress: text }))}
                    placeholder="Direccion de destino"
                  />
                </View>
              </View>
            </View>
            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
            <Pressable style={styles.primaryButton} onPress={goToSteps}>
              <Text style={styles.primaryButtonText}>Continuar</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={[styles.card, styles.panelCard]}>
          <View style={styles.stepsMain}>
          <View style={styles.patientDataCard}>
            <View style={styles.serviceRowsBlock}>
              <View style={styles.serviceTwoColRow}>
                <View style={styles.serviceHalfCol}>
                  <Text style={styles.patientDataLabel}>Auftrag</Text>
                  <Text style={styles.patientDataValue} numberOfLines={3}>
                    {draft.auftragNumber.trim() || "—"}
                  </Text>
                </View>
                <View style={styles.serviceHalfCol}>
                  <Text style={styles.patientDataLabel}>Paciente</Text>
                  <Text style={styles.patientDataValue} numberOfLines={3}>
                    {draft.patientName.trim() || "—"}
                  </Text>
                </View>
              </View>
              <View style={styles.serviceTwoColRow}>
                <View style={styles.serviceHalfCol}>
                  <Text style={styles.patientDataLabel}>Recogida</Text>
                  <Text style={styles.patientDataValue} numberOfLines={3}>
                    {draft.fromAddress.trim() || "—"}
                  </Text>
                </View>
                <View style={styles.serviceHalfCol}>
                  <Text style={styles.patientDataLabel}>Destino</Text>
                  <Text style={styles.patientDataValue} numberOfLines={3}>
                    {draft.toAddress.trim() || "—"}
                  </Text>
                </View>
              </View>
            </View>
            {anschlussAwaitingPatient2Step3 ? (
              <Text style={styles.anschlussBanner}>Anschluss · paciente 2</Text>
            ) : null}
            <View style={styles.dotsRow}>
              {([1, 2, 3, 4, 5] as const).map((n) => (
                <View
                  key={n}
                  style={[styles.stepDot, n === currentStep ? styles.stepDotActive : null]}
                />
              ))}
            </View>
          </View>

          {currentStep === 2 ? (
            <View style={styles.kmHeroWrap}>
              <Text style={styles.kmHeroLabel}>Odómetro en domicilio</Text>
              <TextInput
                style={[
                  styles.kmInputHero,
                  kmFieldFocus === "2" ? styles.kmInputHeroFocused : null,
                  canUseKmStep2 && !km2InvalidVsAnschlussFloor ? styles.kmInputHeroValid : null,
                  km2InvalidVsAnschlussFloor ? styles.kmInputHeroInvalid : null,
                ]}
                keyboardType="decimal-pad"
                value={kmDraft2}
                onChangeText={setKmDraft2}
                onFocus={() => setKmFieldFocus("2")}
                onBlur={() => setKmFieldFocus((f) => (f === "2" ? null : f))}
                placeholder="0"
                placeholderTextColor="#94a3b8"
              />
            </View>
          ) : null}
          {currentStep === 4 ? (
            <View style={styles.kmHeroWrap}>
              <Text style={styles.kmHeroLabel}>Odómetro en destino (con paciente)</Text>
              <TextInput
                style={[
                  styles.kmInputHero,
                  kmFieldFocus === "4" ? styles.kmInputHeroFocused : null,
                  canUseKmStep4 && !km4InvalidVsStart ? styles.kmInputHeroValid : null,
                  km4InvalidVsStart ? styles.kmInputHeroInvalid : null,
                ]}
                keyboardType="decimal-pad"
                value={kmDraft4}
                onChangeText={setKmDraft4}
                onFocus={() => setKmFieldFocus("4")}
                onBlur={() => setKmFieldFocus((f) => (f === "4" ? null : f))}
                placeholder="0"
                placeholderTextColor="#94a3b8"
              />
            </View>
          ) : null}

          <View style={styles.bigStepCenter}>
            <Pressable
              disabled={bigStepDisabled}
              onPressIn={() => armStepHold(currentStep, bigStepDisabled)}
              onPressOut={clearStepHoldTimer}
              android_ripple={
                bigStepDisabled
                  ? undefined
                  : { color: "rgba(15, 118, 110, 0.22)", foreground: true, borderless: false }
              }
              style={({ pressed }) => [
                styles.roundStepButton,
                {
                  width: roundStepSize,
                  height: roundStepSize,
                  borderRadius: roundStepSize / 2,
                },
                bigStepDisabled ? styles.roundStepButtonDisabled : null,
                !bigStepDisabled && pressed ? styles.roundStepButtonPressed : null,
              ]}
            >
              <Text
                style={[
                  styles.roundStepNumber,
                  bigStepDisabled ? styles.roundStepNumberDisabled : null,
                ]}
              >
                {currentStep}
              </Text>
            </Pressable>
            <Text style={styles.bigStepTitle}>{STEP_TITLES[currentStep]}</Text>
          </View>
          </View>

          <View style={styles.stepsFooter}>
            {isSaving ? (
              <View style={styles.footerStatusBlock}>
                <ActivityIndicator color="#0f766e" />
              </View>
            ) : null}
            {errorMessage ? (
              <View style={styles.footerStatusBlock}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}
            {showStornoUi ? stornoPanelEl : null}

            <View style={styles.footerIconRow}>
              <View style={styles.footerLeftActions}>
                {showAnschlussSlot ? (
                  <Pressable
                    hitSlop={10}
                    disabled={!anschlussEnabled}
                    onPress={handleStartAnschluss}
                    accessibilityRole="button"
                    accessibilityLabel="Anschluss, segundo paciente"
                    accessibilityState={{ disabled: !anschlussEnabled }}
                    android_ripple={
                      anschlussEnabled
                        ? { color: "rgba(255,255,255,0.35)", foreground: true, borderless: true }
                        : undefined
                    }
                    style={({ pressed }) => [
                      styles.footerFabOrange,
                      !anschlussEnabled ? styles.footerFabOrangeDisabled : null,
                      anschlussEnabled && pressed ? styles.footerFabPressed : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.footerFabSymbol,
                        !anschlussEnabled ? styles.footerFabSymbolDisabledOrange : null,
                      ]}
                    >
                      ∞
                    </Text>
                  </Pressable>
                ) : null}
                {pendingPatient1Anschluss && anschlussAwaitingPatient2Step3 ? (
                  <Pressable
                    hitSlop={10}
                    onPress={handleCancelAnschluss}
                    accessibilityRole="button"
                    accessibilityLabel="Cancelar Anschluss"
                    android_ripple={{ color: "rgba(220, 38, 38, 0.2)", foreground: true, borderless: true }}
                    style={({ pressed }) => [
                      styles.footerFabOutlineRed,
                      pressed ? styles.footerFabOutlineRedPressed : null,
                    ]}
                  >
                    <Text style={styles.footerFabSymbolOutline}>↩</Text>
                  </Pressable>
                ) : null}
              </View>

              {showStornoUi ? (
                <Pressable
                  hitSlop={10}
                  onPress={toggleStornoBar}
                  accessibilityRole="button"
                  accessibilityLabel="Storno: registrar cancelacion"
                  android_ripple={{ color: "rgba(255,255,255,0.35)", foreground: true, borderless: true }}
                  style={({ pressed }) => [
                    styles.footerFabRed,
                    stornoBarOpen ? styles.footerFabRedActive : null,
                    pressed ? styles.footerFabPressed : null,
                  ]}
                >
                  <Text style={styles.footerFabSymbolWhite}>✖</Text>
                </Pressable>
              ) : (
                <View style={styles.footerFabPlaceholder} />
              )}
            </View>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  panelRoot: {
    flex: 1,
    minHeight: 0,
    width: "100%",
  },
  panelCard: {
    flex: 1,
    minHeight: 0,
  },
  card: {
    flexDirection: "column",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  blockedText: {
    color: "#b91c1c",
    fontSize: 13,
  },
  hintText: {
    color: "#1d4ed8",
    fontSize: 13,
    lineHeight: 18,
  },
  metaColumn: {
    flex: 1,
    minHeight: 0,
    gap: 10,
  },
  metaBody: {
    flex: 1,
    minHeight: 0,
    gap: 8,
    paddingBottom: 4,
  },
  stepsMain: {
    flex: 1,
    minHeight: 0,
    gap: 8,
    paddingBottom: 4,
  },
  patientDataCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 5,
    backgroundColor: "#fafafa",
    flexShrink: 0,
  },
  patientCardTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
    letterSpacing: 0.15,
  },
  serviceRowsBlock: {
    gap: 5,
  },
  serviceTwoColRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  serviceHalfCol: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  patientDataLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748b",
    letterSpacing: 0.1,
  },
  patientDataValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0f172a",
    lineHeight: 15,
  },
  formFieldBlock: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  inputInCard: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 14,
    backgroundColor: "#ffffff",
    color: "#0f172a",
  },
  inputInCardReadonly: {
    backgroundColor: "#f1f5f9",
    color: "#475569",
  },
  anschlussFieldHint: {
    fontSize: 10,
    fontWeight: "600",
    color: "#0f766e",
    marginTop: 2,
  },
  primaryButton: {
    backgroundColor: "#0f766e",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    flexShrink: 0,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 16,
  },
  stornoPanel: {
    borderWidth: 1,
    borderColor: "#fecdd3",
    borderRadius: 10,
    padding: 10,
    gap: 8,
    backgroundColor: "#fff1f2",
    flexShrink: 0,
  },
  stornoPanelTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9f1239",
    textAlign: "center",
  },
  stornoPillsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  stornoPill: {
    minWidth: 52,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    alignItems: "center",
  },
  stornoPillActiveYes: {
    borderColor: "#22c55e",
    backgroundColor: "#ecfdf5",
  },
  stornoPillActiveNo: {
    borderColor: "#f43f5e",
    backgroundColor: "#fff1f2",
  },
  stornoPillText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#64748b",
  },
  stornoPillTextActiveYes: {
    color: "#15803d",
  },
  stornoPillTextActiveNo: {
    color: "#be123c",
  },
  stornoActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginTop: 2,
  },
  stornoSecondaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  stornoSecondaryButtonText: {
    color: "#64748b",
    fontWeight: "700",
    fontSize: 14,
  },
  stornoPrimaryButton: {
    flex: 1,
    backgroundColor: "#dc2626",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#b91c1c",
  },
  stornoPrimaryButtonDisabled: {
    opacity: 0.55,
  },
  stornoPrimaryButtonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 14,
  },
  anschlussBanner: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0f766e",
    marginTop: 2,
  },
  kmHeroWrap: {
    gap: 4,
    marginTop: 2,
    flexShrink: 0,
  },
  kmHeroLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
  },
  kmInputHero: {
    borderWidth: 2,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    backgroundColor: "#ffffff",
    color: "#0f172a",
    letterSpacing: 0.5,
  },
  kmInputHeroFocused: {
    borderColor: "#0f766e",
    backgroundColor: "#f0fdf4",
    shadowColor: "#0f766e",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  kmInputHeroValid: {
    borderColor: "#22c55e",
  },
  kmInputHeroInvalid: {
    borderColor: "#dc2626",
    backgroundColor: "#fef2f2",
    color: "#991b1b",
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 3,
    paddingHorizontal: 2,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#e2e8f0",
  },
  stepDotActive: {
    backgroundColor: "#0f766e",
    transform: [{ scale: 1.35 }],
  },
  bigStepCenter: {
    flex: 1,
    minHeight: 0,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
  },
  roundStepButton: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "#0f766e",
    backgroundColor: "#ecfdf5",
    shadowColor: "#0f766e",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
  },
  roundStepButtonDisabled: {
    opacity: 0.45,
    borderColor: "#94a3b8",
    backgroundColor: "#f1f5f9",
    shadowOpacity: 0,
    elevation: 0,
  },
  roundStepButtonPressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.9,
  },
  roundStepNumber: {
    fontSize: 56,
    fontWeight: "900",
    color: "#0f766e",
    lineHeight: 60,
  },
  roundStepNumberDisabled: {
    color: "#94a3b8",
  },
  bigStepTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
    paddingHorizontal: 12,
    marginTop: 4,
  },
  stepsFooter: {
    gap: 6,
    flexShrink: 0,
    flexGrow: 0,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  footerStatusBlock: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  footerIconRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 52,
    paddingHorizontal: 2,
  },
  footerLeftActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 0,
  },
  footerFabOrange: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ea580c",
    borderWidth: 1,
    borderColor: "#c2410c",
    overflow: "hidden",
  },
  footerFabOrangeDisabled: {
    backgroundColor: "#ffedd5",
    borderColor: "#fdba74",
  },
  footerFabRed: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dc2626",
    borderWidth: 1,
    borderColor: "#b91c1c",
    overflow: "hidden",
  },
  footerFabRedActive: {
    borderWidth: 3,
    borderColor: "#fecaca",
  },
  footerFabPlaceholder: {
    width: 48,
    height: 48,
    flexShrink: 0,
  },
  footerFabOutlineRed: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "#dc2626",
    overflow: "hidden",
  },
  footerFabOutlineRedPressed: {
    backgroundColor: "#fef2f2",
    opacity: 0.96,
  },
  footerFabPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.96 }],
  },
  footerFabSymbol: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "600",
    lineHeight: 34,
    marginTop: -2,
  },
  footerFabSymbolDisabledOrange: {
    color: "#9a3412",
  },
  footerFabSymbolWhite: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 24,
  },
  footerFabSymbolOutline: {
    color: "#b91c1c",
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 26,
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 13,
    textAlign: "center",
  },
  saveFlashBanner: {
    backgroundColor: "#ecfdf5",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#a7f3d0",
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 4,
    flexShrink: 0,
  },
  saveFlashText: {
    color: "#047857",
    fontSize: 14,
    fontWeight: "700",
  },
});
