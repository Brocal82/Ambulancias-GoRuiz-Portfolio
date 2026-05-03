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
  const [kmFieldFocus, setKmFieldFocus] = useState<null | "2" | "4">(null);

  const { width: windowWidth } = useWindowDimensions();
  const roundStepSize = Math.min(176, Math.round(windowWidth * 0.42));

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
              <View style={styles.patientDataCard}>
                <Text style={styles.patientCardTitle}>Datos del paciente</Text>
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
                  <Text style={styles.fieldLabel}>Recogida (origen)</Text>
                  <TextInput
                    style={styles.inputInCard}
                    value={draft.fromAddress}
                    onChangeText={(text) => setDraft((prev) => ({ ...prev, fromAddress: text }))}
                    placeholder="Direccion de recogida"
                  />
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
              {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
            </ScrollView>
            <Pressable style={styles.primaryButton} onPress={goToSteps}>
              <Text style={styles.primaryButtonText}>Continuar</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={[styles.card, styles.panelCard]}>
          <ScrollView
            style={styles.stepsScroll}
            contentContainerStyle={styles.stepsScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
          <View style={styles.patientDataCard}>
            <Text style={styles.patientCardTitle}>Datos del servicio</Text>
            <View style={styles.patientDataRow}>
              <Text style={styles.patientDataLabel}>Auftrag</Text>
              <Text style={styles.patientDataValue} numberOfLines={3}>
                {draft.auftragNumber.trim() || "—"}
              </Text>
            </View>
            <View style={styles.patientDataRow}>
              <Text style={styles.patientDataLabel}>Paciente</Text>
              <Text style={styles.patientDataValue} numberOfLines={3}>
                {draft.patientName.trim() || "—"}
              </Text>
            </View>
            <View style={styles.patientDataRow}>
              <Text style={styles.patientDataLabel}>Recogida</Text>
              <Text style={styles.patientDataValue} numberOfLines={4}>
                {draft.fromAddress.trim() || "—"}
              </Text>
            </View>
            <View style={styles.patientDataRow}>
              <Text style={styles.patientDataLabel}>Destino</Text>
              <Text style={styles.patientDataValue} numberOfLines={4}>
                {draft.toAddress.trim() || "—"}
              </Text>
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
                  canUseKmStep2 ? styles.kmInputHeroValid : null,
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
                  canUseKmStep4 ? styles.kmInputHeroValid : null,
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
          </ScrollView>

          <View style={styles.stepsFooter}>
            {showAnschlussSlot ? (
              <View style={styles.anschlussFooterBlock}>
                <Pressable
                  disabled={!anschlussEnabled}
                  onPress={handleStartAnschluss}
                  android_ripple={
                    anschlussEnabled ? { color: "rgba(255,255,255,0.35)", foreground: true } : undefined
                  }
                  style={({ pressed }) => [
                    styles.orangePillButton,
                    !anschlussEnabled ? styles.orangePillButtonDisabled : null,
                    anschlussEnabled && pressed ? styles.orangePillButtonPressed : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.orangePillButtonText,
                      !anschlussEnabled ? styles.orangePillButtonTextDisabled : null,
                    ]}
                  >
                    Anschluss (paciente 2)
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {pendingPatient1Anschluss && anschlussAwaitingPatient2Step3 ? (
              <Pressable
                onPress={handleCancelAnschluss}
                android_ripple={{ color: "rgba(220, 38, 38, 0.15)", foreground: true }}
                style={({ pressed }) => [styles.redOutlineButton, pressed ? styles.redOutlineButtonPressed : null]}
              >
                <Text style={styles.redOutlineButtonText}>Cancelar Anschluss</Text>
              </Pressable>
            ) : null}

            {isSaving ? <ActivityIndicator color="#0f766e" /> : null}
            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

            <Pressable
              onPress={resetDraft}
              android_ripple={{ color: "rgba(255,255,255,0.35)", foreground: true }}
              style={({ pressed }) => [styles.redStornoButton, pressed ? styles.redStornoButtonPressed : null]}
            >
              <Text style={styles.redStornoButtonText}>Storno</Text>
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
  metaScroll: {
    flex: 1,
    minHeight: 80,
  },
  metaScrollContent: {
    flexGrow: 1,
    gap: 8,
    paddingBottom: 4,
  },
  patientDataCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 10,
    gap: 8,
    backgroundColor: "#fafafa",
  },
  patientCardTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#334155",
    letterSpacing: 0.4,
  },
  patientDataRow: {
    gap: 3,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  patientDataLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  patientDataValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
    lineHeight: 18,
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
  anschlussBanner: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0f766e",
    marginTop: 2,
  },
  kmHeroWrap: {
    gap: 6,
    marginTop: 4,
  },
  kmHeroLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0f172a",
  },
  stepsScroll: {
    flex: 1,
    minHeight: 0,
  },
  stepsScrollContent: {
    gap: 10,
    paddingBottom: 8,
  },
  kmInputHero: {
    borderWidth: 2,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    backgroundColor: "#ffffff",
    color: "#0f172a",
    letterSpacing: 1,
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
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
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
    gap: 8,
    flexShrink: 0,
    flexGrow: 0,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  anschlussFooterBlock: {
    gap: 4,
    alignSelf: "stretch",
  },
  orangePillButton: {
    alignSelf: "stretch",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
    backgroundColor: "#ea580c",
    borderWidth: 1,
    borderColor: "#c2410c",
  },
  orangePillButtonDisabled: {
    backgroundColor: "#ffedd5",
    borderColor: "#fdba74",
  },
  orangePillButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  orangePillButtonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 15,
  },
  orangePillButtonTextDisabled: {
    color: "#9a3412",
  },
  redOutlineButton: {
    alignSelf: "stretch",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#dc2626",
    backgroundColor: "#ffffff",
  },
  redOutlineButtonPressed: {
    backgroundColor: "#fef2f2",
    opacity: 0.95,
  },
  redOutlineButtonText: {
    color: "#b91c1c",
    fontWeight: "800",
    fontSize: 14,
  },
  redStornoButton: {
    alignSelf: "stretch",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#dc2626",
    borderWidth: 1,
    borderColor: "#b91c1c",
  },
  redStornoButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  redStornoButtonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 14,
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 13,
    textAlign: "center",
  },
});
