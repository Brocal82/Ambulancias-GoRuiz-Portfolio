// frontend/src/modules/workday/pages/MyWorkday.tsx
import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { createTrip } from "../domain";
import { getAllAmbulances } from "../../ambulances/domain/api";
import { sendPartialClosure, sendFinalClosure } from "../domain";

import { useAuth } from "../../../hooks/useAuth";
import { useModules } from "../../../hooks/useModules";
import { usePraemienWorkdayUiActive } from "../../../hooks/usePraemienWorkdayUiActive";
import { getPraemienRules, type PraemienRuleConfig } from "../../praemien/domain/api";
import { MODULE_KEYS } from "../../../constants/modules";
import type { AssignedDayFull } from "../../diensts";
import { normalizeAmbulanceIdToString } from "../../diensts";
import { toastT } from "../../../utils/toast";
import { notifyAdminIssuesChanged } from "../../mechanics";
import { emitWorkdaySummariesChanged } from "../utils/workdayEvents";
import { useDienstsChanged } from "../../diensts/hooks/useDienstsChanged";
import { useWorkdaySummariesChanged } from "../hooks/useWorkdaySummariesChanged";

import type { Trip, TripData } from "../domain/types/trip";
import type { Ambulance } from "../../ambulances/domain/types";
import TripModal from "../components/TripModal";

import {
  WorkdayTripEntry,
  FinalReviewModal,
  PartialReviewModal,
  WorkdayTripsSummary,
} from "../components";

import {
  useWorkdayTrips,
  useWorkdayAssignment,
  canStartTripNow,
  useTripDraftValidation,
  useCloseDayModal,
} from "../hooks";

// Dominio (payloads)
import {
  buildFinalSummaryPayload,
  buildPartialSummaryPayload,
} from "../domain";

// Utils
import {
  checkTripLogic,
  saveAmbulanceData,
  loadAmbulanceData,
  clearAmbulanceData,
  confirmedAmbulanceKey,
  validateClosureData,
  getWorkdayViewState,
} from "../utils";

import {
  getCurrentTimeString,
  formatYYYYMMDDToDDMMYYYY,
} from "../../../utils/timeUtils";

import { todayBerlinDayKey } from "../../../utils/dates/dayKey";

function ambulanceNumberFromAssignedDay(d: AssignedDayFull): string {
  if (d.ambulanceNumber?.trim()) return d.ambulanceNumber;
  if (d.ambulanceId && typeof d.ambulanceId === "object") {
    return (d.ambulanceId as Ambulance).ambulanceNumber ?? "";
  }
  return "";
}

const MyWorkday = () => {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const { hasModule } = useModules();
  const praemienWorkdayUiActive = usePraemienWorkdayUiActive();
  const ambulancesModuleOn = hasModule(MODULE_KEYS.AMBULANCES);
  const mechanicsModuleOn = hasModule(MODULE_KEYS.MECHANICS);
  const today = todayBerlinDayKey();
  const todayFormatted = formatYYYYMMDDToDDMMYYYY(today);
  const weekday = new Date(`${today}T00:00:00`).toLocaleDateString(
    undefined,
    { weekday: "long" }
  );

  const {
    trips,
    setTrips,
    isClosingDay,
    getClosedDayKeyByDate,
    refreshTrips,
  } = useWorkdayTrips({
    token,
    userId: user?._id,
    date: today,
  });

  const {
    assignedDay,
    canStartWork,
    refreshAssignedDay,
  } = useWorkdayAssignment({
    token,
    userId: user?._id,
    today,
  });

  useDienstsChanged(() => {
    void refreshAssignedDay();
  });

  useWorkdaySummariesChanged(() => {
    void refreshAssignedDay();
    void refreshTrips();
  });


  const [wasCancelled, setWasCancelled] = useState(false);
  const [countsTrip, setCountsTrip] = useState<number>(1);
  const [reports, setReports] = useState("");

  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [ambulanceId, setAmbulanceId] = useState<string>("");

  const [ambulanceNumber, setAmbulanceNumber] = useState("");

  const [vehicleConfirmed, setVehicleConfirmed] = useState(false);
  const formBlocked = !vehicleConfirmed;

  const [initialAmbulanceKm, setInitialAmbulanceKm] = useState("");
  const [finalAmbulanceKm, setFinalAmbulanceKm] = useState("");
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);

  const [showTripsList, setShowTripsList] = useState(false);
  const [praemienRules, setPraemienRules] = useState<PraemienRuleConfig | null>(null);

  useEffect(() => {
    if (!praemienWorkdayUiActive) {
      setPraemienRules(null);
      return;
    }
    let cancelled = false;
    getPraemienRules()
      .then((rules) => {
        if (!cancelled) setPraemienRules(rules);
      })
      .catch(() => {
        if (!cancelled) setPraemienRules(null);
      });
    return () => {
      cancelled = true;
    };
  }, [praemienWorkdayUiActive]);

  const {
    showCloseQuestion,
    isFinalClosure,
    showReviewModal,
    openCloseQuestion,
    selectFinalClosure,
    selectPartialClosure,
    cancelCloseQuestion,
    closeReviewModal,
  } = useCloseDayModal();

  const timeWarningRef = useRef<HTMLInputElement>(null);
  const timeAtHomeRef = useRef<HTMLInputElement>(null);
  const timePickupRef = useRef<HTMLInputElement>(null);
  const timeArrivalRef = useRef<HTMLInputElement>(null);
  const timeEndRef = useRef<HTMLInputElement>(null);
  const kmStartRef = useRef<HTMLInputElement>(null);
  const kmEndRef = useRef<HTMLInputElement>(null);

  const [anschlussActive, setAnschlussActive] = useState(false);
  const [previousTripFormData, setPreviousTripFormData] =
    useState<TripData | null>(null);
  const anschlussGuardRef = useRef(false);

  const [tripFormData, setTripFormData] = useState<TripData>({
    date: "",
    assignmentId: "",
    driver: "",
    medic: "",
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
  });

  const { draftError, badField } = useTripDraftValidation(
    tripFormData,
    wasCancelled,
    anschlussActive,
    previousTripFormData,
  );

  const navigate = useNavigate();

  const viewState = getWorkdayViewState({
    isClosingDay,
    assignedDay,
    canStartWork,
  });

  const handleConfirmAmbulanceData = () => {
    if (!assignedDay) return;

    // When the ambulances module is off the selector is hidden; the ambulance
    // comes from the dienst assignment so ambulanceId is not required.
    const needsAmbulanceId = ambulancesModuleOn;
    if ((needsAmbulanceId && !ambulanceId) || !initialAmbulanceKm) {
      toastT.error(["toasts.workday.needInitialData"]);
      return;
    }

    // Resolve the display number: from the dropdown list (module on) or from
    // the state already populated by the assignedDay effect (module off).
    let ambulanceNum = ambulanceNumber;
    if (ambulancesModuleOn) {
      const selectedAmbulance = ambulances.find((a) => a._id === ambulanceId);
      ambulanceNum = selectedAmbulance?.ambulanceNumber || "??";
      setAmbulanceNumber(ambulanceNum);
    }

    setVehicleConfirmed(true);
    toastT.success(["toasts.workday.initialDataConfirmed"]);

    saveAmbulanceData(
      assignedDay.assignmentId,
      ambulanceId,
      ambulanceNum,
      initialAmbulanceKm,
    );

    localStorage.setItem(
      confirmedAmbulanceKey(assignedDay.assignmentId),
      "true",
    );
  };

  const handleCloseTripModal = () => setSelectedTrip(null);

  useEffect(() => {
    if (!assignedDay) return;
    if (ambulancesModuleOn && ambulances.length === 0) return;

    const loaded = loadAmbulanceData(assignedDay.assignmentId);
    if (loaded) {
      setAmbulanceId(loaded.ambulanceId);
      setInitialAmbulanceKm(loaded.initialKm);
      if (loaded.ambulanceNumber) {
        setAmbulanceNumber(loaded.ambulanceNumber);
      } else if (ambulancesModuleOn) {
        const amb = ambulances.find((a) => a._id === loaded.ambulanceId);
        setAmbulanceNumber(amb?.ambulanceNumber || "??");
      } else if (
        normalizeAmbulanceIdToString(assignedDay.ambulanceId) ===
        loaded.ambulanceId
      ) {
        const n = ambulanceNumberFromAssignedDay(assignedDay);
        setAmbulanceNumber(n || "??");
      } else {
        setAmbulanceNumber("??");
      }
    } else if (!ambulancesModuleOn) {
      const id = normalizeAmbulanceIdToString(assignedDay.ambulanceId);
      const num = ambulanceNumberFromAssignedDay(assignedDay);
      if (id) setAmbulanceId(id);
      if (num) setAmbulanceNumber(num);
    }

    const isConfirmed =
      localStorage.getItem(confirmedAmbulanceKey(assignedDay.assignmentId)) ===
      "true";
    setVehicleConfirmed(isConfirmed);
  }, [assignedDay, ambulances, ambulancesModuleOn]);

  useEffect(() => {
    if (assignedDay && ambulanceId && ambulanceNumber && initialAmbulanceKm) {
      saveAmbulanceData(
        assignedDay.assignmentId,
        ambulanceId,
        ambulanceNumber,
        initialAmbulanceKm,
      );
    }
  }, [ambulanceId, ambulanceNumber, initialAmbulanceKm, assignedDay]);

  useEffect(() => {
    if (!ambulancesModuleOn) {
      setAmbulances([]);
      return;
    }
    const fetchAmbulances = async () => {
      try {
        if (!token) return;
        const data = await getAllAmbulances();
        setAmbulances(data);
      } catch (err) {
        console.error(" Error al cargar ambulancias:", err);
      }
    };
    fetchAmbulances();
  }, [token, ambulancesModuleOn]);

  const handleSaveTrip = async () => {
    if (!token) return;

    const {
      auftragNumber,
      patientName,
      fromAddress,
      toAddress,
      timeWarning,
      timeAtHome,
      timePickup,
      timeArrival,
      timeEnd,
      kmStart,
      kmEnd,
    } = tripFormData;

    if (!wasCancelled) {
      if (
        !auftragNumber?.trim() ||
        !patientName?.trim() ||
        !fromAddress?.trim() ||
        !toAddress?.trim() ||
        !timeWarning ||
        !timeAtHome ||
        !timePickup ||
        !timeArrival ||
        !timeEnd ||
        kmStart === 0 ||
        kmEnd === 0
      ) {
        toastT.warn(["toasts.workday.mandatoryFields"]);
        return;
      }
    }

    if (!assignedDay) {
      toastT.error(["toasts.workday.noAssignmentToday"]);
      return;
    }

    if (!canStartTripNow(assignedDay.startTime, assignedDay.date)) {
      toastT.error(["toasts.workday.tooEarly"]);
      return;
    }

    if (!wasCancelled) {
      const logicError = checkTripLogic({
        timeWarning,
        timeAtHome,
        timePickup,
        timeArrival,
        timeEnd,
        kmStart: Number(kmStart),
        kmEnd: Number(kmEnd),
      });
      if (logicError.error) {
        toastT.error(logicError.error);
        return;
      }
    }

    try {
      const newTrip: TripData = {
        date: assignedDay.date,
        assignmentId: assignedDay.assignmentId,
        driver: assignedDay.driver._id,
        medic: assignedDay.medic._id,
        auftragNumber,
        patientName,
        fromAddress,
        toAddress,
        timeWarning,
        timeAtHome,
        timePickup,
        timeArrival,
        timeEnd,
        kmStart,
        kmEnd,
        wasCancelled,
        cancelledAtPickup: false,
        countsTrip,
        reports,
        countsForSummary: true,
      };

      const createdTrip = await createTrip(newTrip);
      toastT.success(["toasts.workday.tripSaved"]);
      setTrips((prev) => [...prev, createdTrip]);

      setTripFormData({
        ...tripFormData,
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
      });

      setWasCancelled(false);
      setCountsTrip(1);
      setReports("");
    } catch (err) {
      console.error(" Error al crear trip:", err);
      toastT.apiError(err, ["toasts.workday.tripSaveError"]);
    }
  };

  const saveAnschlussPatient1 = async (trip: TripData) => {
    if (!token || !assignedDay) return;
    try {
      const newTrip: TripData = {
        ...trip,
        date: assignedDay.date,
        assignmentId: assignedDay.assignmentId,
        driver: assignedDay.driver._id,
        medic: assignedDay.medic._id,
        timeEnd: "🔗 Anschluss",
      };
      const createdTrip = await createTrip(newTrip);
      toastT.success(["toasts.workday.anschlussSaved"]);
      setTrips((prev) => [...prev, createdTrip]);
    } catch (err) {
      console.error(" Error al guardar paciente 1:", err);
      toastT.apiError(err, ["toasts.workday.anschlussSaveError"]);
    }
  };

  const handleConfirmFinalClosure = async (
    note: string,
    finalKmFromModal: number,
    _issueData?: any,
  ) => {

    if (!token || !assignedDay || !user?._id) return;

    const validation = validateClosureData({
      vehicleConfirmed,
      ambulanceId,
      ambulanceNumber,
      initialKm: initialAmbulanceKm,
      finalKm: finalKmFromModal,
      isPartial: false,
    });
    if (!validation.valid) {
      toastT[validation.severity]([validation.toastKey]);
      return;
    }

    try {
      setFinalAmbulanceKm(String(finalKmFromModal));

      const summaryData = buildFinalSummaryPayload({
        today,
        assignedDay,
        ambulanceId,
        ambulanceNumber,
        initialKm: Number(initialAmbulanceKm),
        finalKm: finalKmFromModal,
        trips,
        extraNote: note,
      });


      // Opcional: log para depurar si volviese a fallar
      // console.log("[final-closure] payload:", summaryData);

      await sendFinalClosure(summaryData);

      emitWorkdaySummariesChanged();

      toastT.success(["toasts.workday.dayClosedSuccess"]);

      localStorage.setItem(getClosedDayKeyByDate(today, assignedDay.driver._id), "true");
      localStorage.setItem(getClosedDayKeyByDate(today, assignedDay.medic._id), "true");


      setTrips([]);
      closeReviewModal();
      clearAmbulanceData(assignedDay.assignmentId);
      navigate("/worker");
    } catch (err: unknown) {
      console.error(" Error al cerrar el día:", err);
      toastT.apiError(err, ["toasts.workday.dayCloseError"]);
    }
  };

  const handleSendPartialClosure = async (
    reason: string,
    finalKmValue: number,
    issueFromModal: unknown | null = null,
  ) => {
    if (!token || !assignedDay) return;

    const validation = validateClosureData({
      vehicleConfirmed,
      ambulanceId,
      ambulanceNumber,
      initialKm: initialAmbulanceKm,
      finalKm: Number(finalKmValue),
      isPartial: true,
      partialReason: reason,
    });
    if (!validation.valid) {
      toastT[validation.severity]([validation.toastKey]);
      return;
    }

    const reasonTrimmed = (reason ?? "").trim();

    try {
      const payload = buildPartialSummaryPayload({
        today,
        assignedDay,
        ambulanceId,
        ambulanceNumber,
        initialKm: Number(initialAmbulanceKm),
        finalKm: Number(finalKmValue),
        trips,
        partialClosureReason: reasonTrimmed,
      });


      await sendPartialClosure(payload);

      emitWorkdaySummariesChanged();

      if (mechanicsModuleOn && issueFromModal) {
        notifyAdminIssuesChanged();
      }

      toastT.success(
        mechanicsModuleOn && issueFromModal
          ? ["toasts.workday.partialSentWithIssue"]
          : ["toasts.workday.partialSent"],
      );

      clearAmbulanceData(assignedDay.assignmentId);
      localStorage.removeItem(confirmedAmbulanceKey(assignedDay.assignmentId));

      setTrips([]);
      setWasCancelled(false);
      setCountsTrip(1);
      closeReviewModal();
      setAmbulanceNumber("");
      setInitialAmbulanceKm("");
      setFinalAmbulanceKm("");
      setVehicleConfirmed(false);

      navigate("/worker");
    } catch (err: unknown) {
      console.error(" Error al enviar cierre parcial:", err);
      toastT.apiError(err, ["toasts.workday.partialSendError"]);
    }
  };

  // Activar Anschluss
  const handleAddAnschluss = () => {
    if (!assignedDay) return;
    if (!tripFormData.toAddress) return;

    setPreviousTripFormData(tripFormData);
    anschlussGuardRef.current = true;

    setTripFormData({
      date: today,
      assignmentId: assignedDay.assignmentId, // < FIX: antes usaba dienstId
      driver: assignedDay.driver._id,
      medic: assignedDay.medic._id,
      auftragNumber: "",
      patientName: "",
      fromAddress: tripFormData.toAddress,
      toAddress: "",
      timeWarning: getCurrentTimeString(),
      timeAtHome: "",
      timePickup: "",
      timeArrival: "",
      timeEnd: "",
      kmStart: tripFormData.kmEnd ?? 0,
      kmEnd: 0,
      wasCancelled: false,
      cancelledAtPickup: false,
      countsTrip: 1,
      reports: "",
      countsForSummary: true,
    });

    setAnschlussActive(true);
  };

  // Cancelar Anschluss
  const handleCancelAnschluss = () => {
    setAnschlussActive(false);
    anschlussGuardRef.current = false;
    if (previousTripFormData) {
      setTripFormData(previousTripFormData);
      setPreviousTripFormData(null);
    }
  };

  // Terminar Anschluss (se consume cuando el paciente 2 ya fue recogido)
  const handleFinishAnschluss = () => {
    setAnschlussActive(false);
    anschlussGuardRef.current = false;
    setPreviousTripFormData(null);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        {assignedDay && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <span>
                {assignedDay.startTime} – {assignedDay.endTime}
              </span>
            </div>

            <div className="text-sm text-slate-500 capitalize">
              {weekday} · {todayFormatted}
            </div>
          </div>
        )}
      </div>

      {viewState === "closed" && (
        <div className="mb-6 rounded-xl bg-red-50 text-red-700 ring-1 ring-red-200 p-4">
          {t("pages.workday.closedDay")}
        </div>
      )}
      {viewState === "no_assignment" && (
        <div className="mb-6 rounded-xl bg-yellow-50 text-yellow-800 ring-1 ring-yellow-200 p-6 flex flex-col gap-4">
          <p className="font-medium">{t("pages.workday.noAssignment")}</p>
          <p className="text-sm text-yellow-700">
            {t("pages.workday.noAssignmentHint")}
          </p>
          <Link
            to="/worker"
            className="inline-flex items-center gap-2 self-start rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-1 transition-colors"
          >
            <span aria-hidden="true">←</span>
            {t("pages.workday.backToDashboard")}
          </Link>
        </div>
      )}
      {viewState === "cant_start" && assignedDay && (
        <div className="mb-6 rounded-xl bg-blue-50 text-blue-800 ring-1 ring-blue-200 p-4">
          {t("pages.workday.cantStart", { start: assignedDay.startTime })}
        </div>
      )}
      {viewState === "ready" && (
        <>
          {assignedDay && (
            <WorkdayTripEntry
              assignedDay={assignedDay}
              ambulances={ambulances}
              ambulanceId={ambulanceId}
              setAmbulanceId={setAmbulanceId}
              ambulanceNumber={ambulanceNumber}
              initialAmbulanceKm={initialAmbulanceKm}
              setInitialAmbulanceKm={setInitialAmbulanceKm}
              vehicleConfirmed={vehicleConfirmed}
              formBlocked={formBlocked}
              onConfirmAmbulanceData={handleConfirmAmbulanceData}
              ambulanceSelectorHidden={!ambulancesModuleOn}
              lockedAmbulanceLabel={
                !ambulancesModuleOn
                  ? ambulanceNumber ||
                    ambulanceNumberFromAssignedDay(assignedDay) ||
                    t(
                      "pages.workday.noAmbulanceOnAssignment",
                      "Sin ambulancia en la asignación",
                    )
                  : ""
              }
              tripFormData={tripFormData}
              setTripFormData={setTripFormData}
              wasCancelled={wasCancelled}
              setWasCancelled={setWasCancelled}
              countsTrip={countsTrip}
              setCountsTrip={setCountsTrip}
              reports={reports}
              setReports={setReports}
              anschlussActive={anschlussActive}
              onAddAnschluss={handleAddAnschluss}
              onCancelAnschluss={handleCancelAnschluss}
              previousTripFormData={previousTripFormData}
              setPreviousTripFormData={setPreviousTripFormData}
              anschlussGuardRef={anschlussGuardRef}
              onSaveAnschlussPatient1={saveAnschlussPatient1}
              onFinishAnschluss={handleFinishAnschluss}
              draftError={draftError}
              badField={badField}
              onSaveTrip={handleSaveTrip}
              timeWarningRef={timeWarningRef}
              timeAtHomeRef={timeAtHomeRef}
              timePickupRef={timePickupRef}
              timeArrivalRef={timeArrivalRef}
              timeEndRef={timeEndRef}
              kmStartRef={kmStartRef}
              kmEndRef={kmEndRef}
            />
          )}

          {assignedDay && vehicleConfirmed && (
            <WorkdayTripsSummary
              trips={trips}
              assignedDay={assignedDay}
              praemienRules={praemienRules}
              onOpenTrip={(trip) => setSelectedTrip(trip)}
              vehicleConfirmed={vehicleConfirmed}
              isClosingDay={isClosingDay}
              onCloseAndSend={openCloseQuestion}
              isOpen={showTripsList}
              onToggleOpen={() => setShowTripsList((prev) => !prev)}
            />
          )}


          {showCloseQuestion && (
            <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
              <div className="bg-white p-6 rounded-2xl shadow-lg ring-1 ring-slate-200 w-full max-w-sm space-y-4">
                <h4 className="text-lg font-semibold text-center">
                  {t("pages.workday.closeQuestion.title")}
                </h4>

                <div className="space-y-2">
                  <button
                    onClick={selectFinalClosure}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg"
                  >
                    {t("pages.workday.closeQuestion.yes")}
                  </button>

                  <button
                    onClick={selectPartialClosure}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-2 rounded-lg"
                  >
                    {t("pages.workday.closeQuestion.partial")}
                  </button>

                  <button
                    onClick={cancelCloseQuestion}
                    className="w-full bg-slate-200 hover:bg-slate-300 text-slate-800 py-2 rounded-lg"
                  >
                    {t("pages.workday.closeQuestion.cancel")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {selectedTrip && (
        <TripModal trip={selectedTrip} onClose={handleCloseTripModal} />
      )}

      {showReviewModal && !isFinalClosure && assignedDay && (
        <PartialReviewModal
          trips={trips}
          assignedDay={assignedDay}
          ambulanceId={ambulanceId}
          ambulanceNumber={ambulanceNumber}
          initialKm={initialAmbulanceKm}
          finalKm={finalAmbulanceKm}
          mechanicsModuleOn={mechanicsModuleOn}
          onClose={closeReviewModal}
          onSend={async (reason, finalKmValue, _totalEffectivePatients, issue) => {
            await handleSendPartialClosure(
              reason,
              finalKmValue,
              issue ?? null,
            );
          }}

        />
      )}

      {showReviewModal && isFinalClosure === true && assignedDay && (
        <FinalReviewModal
          isOpen={true}
          onClose={closeReviewModal}
          trips={trips}
          assignedDay={assignedDay}
          ambulanceId={ambulanceId}
          ambulanceNumber={ambulanceNumber}
          initialKm={initialAmbulanceKm}
          finalKm={finalAmbulanceKm}
          mechanicsModuleOn={mechanicsModuleOn}
          onConfirm={handleConfirmFinalClosure}
        />
      )}
    </div>
  );
};

export default MyWorkday;
