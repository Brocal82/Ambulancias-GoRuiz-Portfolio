import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
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

const LONG_PRESS_MS = 3000;
const ANSCHLUSS_MARKER = "🔗 Anschluss";

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
  onTripCreated: () => void;
};

export function WorkerTripStepPanel({
  assignedDay,
  canStartWork,
  blocked,
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
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  const draftRef = useRef(draft);
  const km2Ref = useRef(kmDraft2);
  const km4Ref = useRef(kmDraft4);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  useEffect(() => {
    km2Ref.current = kmDraft2;
  }, [kmDraft2]);
  useEffect(() => {
    km4Ref.current = kmDraft4;
  }, [kmDraft4]);

  const stepHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const canUseKmStep2 = useMemo(() => parsePositiveKm(kmDraft2) !== null, [kmDraft2]);
  const canUseKmStep4 = useMemo(() => parsePositiveKm(kmDraft4) !== null, [kmDraft4]);

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
            setPendingPatient1Anschluss(null);
            setAnschlussAwaitingPatient2Step3(false);
            setAnschlussMinKmStart(undefined);
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
          setDraft(emptyDraft(assignedDay));
          setPhase("meta");
          setCurrentStep(1);
          setKmDraft2("");
          setKmDraft4("");
          setPendingPatient1Anschluss(null);
          setAnschlussAwaitingPatient2Step3(false);
          setAnschlussMinKmStart(undefined);
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
    const logicBefore = runCheckTripLogic(
      {
        timeWarning: draft.timeWarning,
        timeAtHome: draft.timeAtHome,
        timePickup: draft.timePickup,
        timeArrival: draft.timeArrival,
        timeEnd: draft.timeEnd || "00:00",
        kmStart: draft.kmStart,
        kmEnd: draft.kmEnd,
      },
      anschlussMinKmStart,
    );
    if (logicBefore.error) {
      setErrorMessage(logicBefore.error);
      return;
    }
    const snapshot: CreateTripPayload = { ...draft };
    setPendingPatient1Anschluss(snapshot);
    setAnschlussMinKmStart(Number(snapshot.kmStart));
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
    setErrorMessage(undefined);
  }, [anschlussMinKmStart, assignedDay, draft, runCheckTripLogic]);

  const handleCancelAnschluss = useCallback(() => {
    const snap = pendingPatient1Anschluss;
    if (!snap) return;
    setDraft({ ...snap });
    setPendingPatient1Anschluss(null);
    setAnschlussAwaitingPatient2Step3(false);
    setAnschlussMinKmStart(undefined);
    setCurrentStep(5);
    setKmDraft2(String(snap.kmStart || ""));
    setKmDraft4(String(snap.kmEnd || ""));
    setErrorMessage(undefined);
  }, [pendingPatient1Anschluss]);

  if (blocked) {
    return (
      <View style={styles.card}>
        <Text style={styles.blockedText}>La jornada esta cerrada: no se pueden registrar mas viajes.</Text>
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

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Nuevo viaje</Text>
      <Text style={styles.cardHint}>
        Manten pulsado cada numero unos 3 segundos para confirmar la hora. Pasos 2 y 4: escribe los km antes de
        confirmar.
      </Text>

      {phase === "meta" ? (
        <View style={styles.metaBlock}>
          <Text style={styles.label}>Auftrag</Text>
          <TextInput
            style={styles.input}
            value={draft.auftragNumber}
            onChangeText={(text) => setDraft((prev) => ({ ...prev, auftragNumber: text }))}
            placeholder="Numero Auftrag"
          />
          <Text style={styles.label}>Paciente</Text>
          <TextInput
            style={styles.input}
            value={draft.patientName}
            onChangeText={(text) => setDraft((prev) => ({ ...prev, patientName: text }))}
            placeholder="Nombre"
          />
          <Text style={styles.label}>Origen</Text>
          <TextInput
            style={styles.input}
            value={draft.fromAddress}
            onChangeText={(text) => setDraft((prev) => ({ ...prev, fromAddress: text }))}
            placeholder="Desde"
          />
          <Text style={styles.label}>Destino</Text>
          <TextInput
            style={styles.input}
            value={draft.toAddress}
            onChangeText={(text) => setDraft((prev) => ({ ...prev, toAddress: text }))}
            placeholder="Hasta"
          />
          <Pressable
            style={styles.primaryButton}
            onPress={() => {
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
              setPhase("steps");
              setCurrentStep(1);
              setKmDraft2("");
              setKmDraft4("");
            }}
          >
            <Text style={styles.primaryButtonText}>Continuar a pasos</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.stepsBlock}>
          <Text style={styles.stepMeta}>
            Paso {currentStep} de 5 {anschlussAwaitingPatient2Step3 ? "· Anschluss (paciente 2)" : ""}
          </Text>
          <Text style={styles.cardHint}>
            Mantén pulsado 3 segundos el botón del paso activo (sin soltar el dedo).
          </Text>

          <View style={styles.stepRow}>
            {[1, 2, 3, 4, 5].map((n) => {
              const step = n as 1 | 2 | 3 | 4 | 5;
              const isCurrent = currentStep === step;
              const needsKm = step === 2 || step === 4;
              const kmReady = step === 2 ? canUseKmStep2 : step === 4 ? canUseKmStep4 : true;
              const disabled =
                !canStartWork ||
                isSaving ||
                !isCurrent ||
                (needsKm && !kmReady);

              return (
                <Pressable
                  key={n}
                  disabled={disabled}
                  onPressIn={() => armStepHold(step, disabled)}
                  onPressOut={clearStepHoldTimer}
                  style={[styles.stepButton, isCurrent && styles.stepButtonCurrent, disabled && styles.stepButtonDisabled]}
                >
                  <Text style={[styles.stepButtonText, disabled && styles.stepButtonTextDisabled]}>{n}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.stepCaption}>
            {currentStep === 1 ? "1 · Hora del Auftrag" : null}
            {currentStep === 2 ? "2 · Llegada domicilio + km domicilio" : null}
            {currentStep === 3 ? "3 · Paciente sube (hora de recogida)" : null}
            {currentStep === 4 ? "4 · Llegada con paciente a destino + km destino" : null}
            {currentStep === 5 ? "5 · Libre (fin del viaje)" : null}
          </Text>

          {currentStep === 2 ? (
            <View style={styles.kmBlock}>
              <Text style={styles.label}>Km en domicilio</Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                value={kmDraft2}
                onChangeText={setKmDraft2}
                placeholder="Ej. 12345"
              />
            </View>
          ) : null}

          {currentStep === 4 ? (
            <View style={styles.kmBlock}>
              <Text style={styles.label}>Km en destino con paciente</Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                value={kmDraft4}
                onChangeText={setKmDraft4}
                placeholder="Ej. 12360"
              />
            </View>
          ) : null}

          {currentStep === 5 && !anschlussAwaitingPatient2Step3 ? (
            <View style={styles.anschlussRow}>
              <Pressable style={styles.secondaryButton} onPress={handleStartAnschluss}>
                <Text style={styles.secondaryButtonText}>Anschluss (paciente 2)</Text>
              </Pressable>
            </View>
          ) : null}

          {pendingPatient1Anschluss && anschlussAwaitingPatient2Step3 ? (
            <Pressable style={styles.linkButton} onPress={handleCancelAnschluss}>
              <Text style={styles.linkButtonText}>Cancelar Anschluss</Text>
            </Pressable>
          ) : null}

          {isSaving ? <ActivityIndicator color="#0f766e" /> : null}
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <Pressable
            style={styles.ghostButton}
            onPress={() => {
              setPhase("meta");
              setCurrentStep(1);
              setDraft(emptyDraft(assignedDay));
              setKmDraft2("");
              setKmDraft4("");
              setPendingPatient1Anschluss(null);
              setAnschlussAwaitingPatient2Step3(false);
              setAnschlussMinKmStart(undefined);
              setErrorMessage(undefined);
            }}
          >
            <Text style={styles.ghostButtonText}>Reiniciar borrador</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  cardHint: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 18,
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
  metaBlock: {
    gap: 8,
  },
  stepsBlock: {
    gap: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#ffffff",
    color: "#0f172a",
  },
  primaryButton: {
    marginTop: 6,
    backgroundColor: "#0f766e",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  stepMeta: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  stepRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  stepButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  stepButtonCurrent: {
    borderColor: "#0f766e",
    backgroundColor: "#ecfdf5",
  },
  stepButtonDisabled: {
    opacity: 0.45,
  },
  stepButtonText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  stepButtonTextDisabled: {
    color: "#94a3b8",
  },
  stepCaption: {
    fontSize: 13,
    color: "#475569",
    minHeight: 36,
  },
  kmBlock: {
    gap: 6,
  },
  anschlussRow: {
    marginTop: 4,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#0f766e",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  secondaryButtonText: {
    color: "#0f766e",
    fontWeight: "700",
  },
  ghostButton: {
    alignSelf: "flex-start",
    paddingVertical: 6,
  },
  ghostButtonText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
  },
  linkButton: {
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  linkButtonText: {
    color: "#0369a1",
    fontSize: 13,
    fontWeight: "700",
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 13,
  },
});
