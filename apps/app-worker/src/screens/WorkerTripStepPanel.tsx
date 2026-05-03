import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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

  const needsKmNow = currentStep === 2 || currentStep === 4;
  const kmReadyNow = currentStep === 2 ? canUseKmStep2 : currentStep === 4 ? canUseKmStep4 : true;
  const bigStepDisabled = !canStartWork || isSaving || (needsKmNow && !kmReadyNow);

  const showAnschlussSlot =
    phase === "steps" && currentStep >= 4 && !anschlussAwaitingPatient2Step3;
  const anschlussEnabled = currentStep === 5 && !isSaving;

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
    setPhase("steps");
    setCurrentStep(1);
    setKmDraft2("");
    setKmDraft4("");
  };

  const resetDraft = () => {
    setPhase("meta");
    setCurrentStep(1);
    setDraft(emptyDraft(assignedDay));
    setKmDraft2("");
    setKmDraft4("");
    setPendingPatient1Anschluss(null);
    setAnschlussAwaitingPatient2Step3(false);
    setAnschlussMinKmStart(undefined);
    setErrorMessage(undefined);
  };

  return (
    <KeyboardAvoidingView
      style={styles.panelRoot}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 72 : 0}
    >
      {phase === "meta" ? (
        <View style={[styles.card, styles.panelCard]}>
          <Text style={styles.cardTitle}>Nuevo viaje</Text>
          <View style={styles.metaColumn}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={styles.metaScroll}
              contentContainerStyle={styles.metaScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <TextInput
                style={styles.inputDense}
                value={draft.auftragNumber}
                onChangeText={(text) => setDraft((prev) => ({ ...prev, auftragNumber: text }))}
                placeholder="Auftrag"
              />
              <TextInput
                style={styles.inputDense}
                value={draft.patientName}
                onChangeText={(text) => setDraft((prev) => ({ ...prev, patientName: text }))}
                placeholder="Paciente"
              />
              <TextInput
                style={styles.inputDense}
                value={draft.fromAddress}
                onChangeText={(text) => setDraft((prev) => ({ ...prev, fromAddress: text }))}
                placeholder="Origen"
              />
              <TextInput
                style={styles.inputDense}
                value={draft.toAddress}
                onChangeText={(text) => setDraft((prev) => ({ ...prev, toAddress: text }))}
                placeholder="Destino"
              />
              {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
            </ScrollView>
            <Pressable style={styles.primaryButton} onPress={goToSteps}>
              <Text style={styles.primaryButtonText}>Continuar</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={[styles.card, styles.panelCard]}>
          <View style={styles.compactTripBar}>
            <Text style={styles.compactTripLine} numberOfLines={1} ellipsizeMode="tail">
              {draft.auftragNumber.trim()} · {draft.patientName.trim()}
            </Text>
            <Text style={styles.compactRoute} numberOfLines={2} ellipsizeMode="tail">
              {draft.fromAddress.trim()} → {draft.toAddress.trim()}
            </Text>
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
            <TextInput
              style={styles.inputDense}
              keyboardType="decimal-pad"
              value={kmDraft2}
              onChangeText={setKmDraft2}
              placeholder="Km en domicilio"
            />
          ) : null}
          {currentStep === 4 ? (
            <TextInput
              style={styles.inputDense}
              keyboardType="decimal-pad"
              value={kmDraft4}
              onChangeText={setKmDraft4}
              placeholder="Km en destino (con paciente)"
            />
          ) : null}

          <View style={styles.bigStepCenter}>
            <Text style={styles.holdCue}>Mantén 3 s sin soltar</Text>
            <Pressable
              disabled={bigStepDisabled}
              onPressIn={() => armStepHold(currentStep, bigStepDisabled)}
              onPressOut={clearStepHoldTimer}
              style={[
                styles.bigStepButton,
                bigStepDisabled ? styles.bigStepButtonDisabled : null,
              ]}
            >
              <Text style={styles.bigStepNumber}>{currentStep}</Text>
              <Text style={styles.bigStepTitle}>{STEP_TITLES[currentStep]}</Text>
            </Pressable>
            {needsKmNow && !kmReadyNow ? (
              <Text style={styles.kmHint}>Escribe un km válido antes de confirmar.</Text>
            ) : null}
          </View>

          <View style={styles.stepsFooter}>
            {showAnschlussSlot ? (
              <View style={styles.anschlussFooterBlock}>
                <Pressable
                  disabled={!anschlussEnabled}
                  onPress={handleStartAnschluss}
                  style={[
                    styles.anschlussFooterButton,
                    !anschlussEnabled ? styles.anschlussFooterButtonDisabled : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.anschlussFooterButtonText,
                      !anschlussEnabled ? styles.anschlussFooterButtonTextDisabled : null,
                    ]}
                  >
                    Anschluss (paciente 2)
                  </Text>
                </Pressable>
                {!anschlussEnabled && currentStep < 5 ? (
                  <Text style={styles.anschlussFooterHint}>Activo al completar el paso 5</Text>
                ) : null}
              </View>
            ) : null}

            {pendingPatient1Anschluss && anschlussAwaitingPatient2Step3 ? (
              <Pressable style={styles.linkButton} onPress={handleCancelAnschluss}>
                <Text style={styles.linkButtonText}>Cancelar Anschluss</Text>
              </Pressable>
            ) : null}

            {isSaving ? <ActivityIndicator color="#0f766e" /> : null}
            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

            <Pressable style={styles.ghostButton} onPress={resetDraft}>
              <Text style={styles.ghostButtonText}>Reiniciar borrador</Text>
            </Pressable>
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
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
    gap: 10,
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
  metaScroll: {
    flex: 1,
    minHeight: 80,
  },
  metaScrollContent: {
    flexGrow: 1,
    gap: 8,
    paddingBottom: 4,
  },
  inputDense: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: "#ffffff",
    color: "#0f172a",
  },
  primaryButton: {
    backgroundColor: "#0f766e",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 16,
  },
  compactTripBar: {
    gap: 4,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  compactTripLine: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  compactRoute: {
    fontSize: 12,
    color: "#475569",
    lineHeight: 16,
  },
  anschlussBanner: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0f766e",
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingHorizontal: 4,
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
    minHeight: 120,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  holdCue: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },
  bigStepButton: {
    width: "100%",
    maxWidth: 320,
    minHeight: 168,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#0f766e",
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 20,
  },
  bigStepButtonDisabled: {
    opacity: 0.42,
    borderColor: "#94a3b8",
    backgroundColor: "#f1f5f9",
  },
  bigStepNumber: {
    fontSize: 56,
    fontWeight: "900",
    color: "#0f766e",
    lineHeight: 62,
  },
  bigStepTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
    paddingHorizontal: 12,
  },
  kmHint: {
    fontSize: 12,
    color: "#b45309",
    fontWeight: "600",
  },
  stepsFooter: {
    gap: 8,
    flexShrink: 0,
    paddingTop: 4,
  },
  anschlussFooterBlock: {
    gap: 4,
  },
  anschlussFooterButton: {
    borderWidth: 2,
    borderColor: "#0f766e",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  anschlussFooterButtonDisabled: {
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
  },
  anschlussFooterButtonText: {
    color: "#0f766e",
    fontWeight: "800",
    fontSize: 15,
  },
  anschlussFooterButtonTextDisabled: {
    color: "#94a3b8",
  },
  anschlussFooterHint: {
    fontSize: 11,
    color: "#64748b",
    textAlign: "center",
  },
  ghostButton: {
    alignSelf: "center",
    paddingVertical: 6,
  },
  ghostButtonText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
  },
  linkButton: {
    alignSelf: "center",
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
    textAlign: "center",
  },
});
