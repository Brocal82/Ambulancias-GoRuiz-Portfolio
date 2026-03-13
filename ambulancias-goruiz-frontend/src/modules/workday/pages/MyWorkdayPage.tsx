// frontend/src/modules/workday/pages/MyWorkday.tsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { createTrip } from "../domain";
import { getAllAmbulances } from "../../ambulances/domain/api";
import { sendPartialClosure, sendFinalClosure } from "../domain";

import { useAuth } from "../../../hooks/useAuth";
import { toastT } from "../../../utils/toast";
import { notifyAdminIssuesChanged } from "../../mechanics";
import { notifyAdminSummariesChanged } from "../hooks";

import type { Trip, TripData } from "../domain/types/trip";
import type { Ambulance } from "../../ambulances/domain/types";
import TripModal from "../components/TripModal";

import {
  WorkdayTripEntry,
  FinalReviewModal,
  PartialReviewModal,
  WorkdayTripsSummary,
} from "../components";

import { useWorkdayTrips, useWorkdayAssignment, canStartTripNow } from "../hooks";

// Dominio (payloads)
import {
  buildFinalSummaryPayload,
  buildPartialSummaryPayload,
} from "../domain";

// Utils
import {
  checkTripLogic,
  type TripDraft,
  saveAmbulanceData,
  loadAmbulanceData,
  clearAmbulanceData,
  confirmedAmbulanceKey,
} from "../utils";

import {
  getCurrentTimeString,
  formatYYYYMMDDToDDMMYYYY,
} from "../../../utils/timeUtils";

import { todayBerlinDayKey } from "../../../utils/dates/dayKey";


const MyWorkday = () => {
  const { t } = useTranslation();
  const { token, user } = useAuth();
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
  } = useWorkdayTrips({
    token,
    userId: user?._id,
    date: today,
  });

  const {
    assignedDay,
    canStartWork,
  } = useWorkdayAssignment({
    token,
    userId: user?._id,
    today,
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

  const [showCloseQuestion, setShowCloseQuestion] = useState(false);
  const [isFinalClosure, setIsFinalClosure] = useState<boolean | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);

  const [draftError, setDraftError] = useState<string>("");
  const [badField, setBadField] = useState<keyof TripDraft | null>(null);

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

  const [issueData, setIssueData] = useState<any | null>(null);
  const navigate = useNavigate();

  const handleConfirmAmbulanceData = () => {
    if (!ambulanceId || !initialAmbulanceKm) {
      toastT.error(["toasts.workday.needInitialData"]);
      return;
    }
    if (!assignedDay) return;

    // obtener número real y usarlo al guardar (evita estado desfasado)
    const selectedAmbulance = ambulances.find((a) => a._id === ambulanceId);
    const ambulanceNum = selectedAmbulance?.ambulanceNumber || "??";
    setAmbulanceNumber(ambulanceNum);

    setVehicleConfirmed(true);
    toastT.success(["toasts.workday.initialDataConfirmed"]);

    saveAmbulanceData(
      assignedDay.assignmentId,
      ambulanceId,
      ambulanceNum, // < usar el valor real, no el state aún sincrónico
      initialAmbulanceKm,
    );

    localStorage.setItem(
      confirmedAmbulanceKey(assignedDay.assignmentId),
      "true",
    );
  };

  const handleCloseTripModal = () => setSelectedTrip(null);

  useEffect(() => {
    if (!assignedDay || !ambulances.length) return;

    const loaded = loadAmbulanceData(assignedDay.assignmentId);
    if (loaded) {
      setAmbulanceId(loaded.ambulanceId);
      setInitialAmbulanceKm(loaded.initialKm);
      if (loaded.ambulanceNumber) {
        setAmbulanceNumber(loaded.ambulanceNumber);
      } else {
        const amb = ambulances.find((a) => a._id === loaded.ambulanceId);
        setAmbulanceNumber(amb?.ambulanceNumber || "??");
      }
    }

    const isConfirmed =
      localStorage.getItem(confirmedAmbulanceKey(assignedDay.assignmentId)) ===
      "true";
    setVehicleConfirmed(isConfirmed);
  }, [assignedDay, ambulances]);

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
    // ? En Anschluss: el kmStart del paciente 2 NO puede ser menor
    // que el kmStart del paciente 1 (guardado en previousTripFormData)
    const minKmStart =
      anschlussActive && previousTripFormData
        ? Number(previousTripFormData.kmStart) //  este es el mínimo real según tu flujo
        : undefined;

    const result = checkTripLogic(
      {
        timeWarning: tripFormData.timeWarning,
        timeAtHome: tripFormData.timeAtHome,
        timePickup: tripFormData.timePickup,
        timeArrival: tripFormData.timeArrival,
        timeEnd: tripFormData.timeEnd,
        kmStart: Number(tripFormData.kmStart),
        kmEnd: Number(tripFormData.kmEnd),
      },
      wasCancelled,
      minKmStart,
    );

    setDraftError(result.error || "");
    setBadField(result.badField);
  }, [tripFormData, wasCancelled, anschlussActive, previousTripFormData]);;

  useEffect(() => {
    const fetchAmbulances = async () => {
      try {
        if (!token) return;
        const data = await getAllAmbulances(token);
        setAmbulances(data);
      } catch (err) {
        console.error(" Error al cargar ambulancias:", err);
      }
    };
    fetchAmbulances();
  }, [token]);

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
      toastT.error(["toasts.workday.tripSaveError"]);
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
        timeEnd: "?? Anschluss",
      };
      const createdTrip = await createTrip(newTrip);
      toastT.success(["toasts.workday.anschlussSaved"]);
      setTrips((prev) => [...prev, createdTrip]);
    } catch (err) {
      console.error(" Error al guardar paciente 1:", err);
      toastT.error(["toasts.workday.anschlussSaveError"]);
    }
  };

  const handleConfirmFinalClosure = async (
    note: string,
    finalKmFromModal: number,
    _issueData?: any,
  ) => {

    if (!token || !assignedDay || !user?._id) return;

    //  exige datos confirmados de vehículo
    if (
      !vehicleConfirmed ||
      !ambulanceId ||
      !ambulanceNumber ||
      !initialAmbulanceKm
    ) {
      toastT.warn(["toasts.workday.enterAmbulanceAndKm"]);
      return;
    }
    if (isNaN(finalKmFromModal)) {
      toastT.warn(["toasts.workday.enterFinalKmInModal"]);
      return;
    }

    const initialKmNumber = Number(initialAmbulanceKm);
    if (finalKmFromModal < initialKmNumber) {
      toastT.error(["toasts.workday.finalKmLessThanInitial"]);
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

      await sendFinalClosure(summaryData, token);

      notifyAdminSummariesChanged();

      toastT.success(["toasts.workday.dayClosedSuccess"]);

      localStorage.setItem(getClosedDayKeyByDate(today, assignedDay.driver._id), "true");
      localStorage.setItem(getClosedDayKeyByDate(today, assignedDay.medic._id), "true");


      setTrips([]);
      setShowReviewModal(false);
      clearAmbulanceData(assignedDay.assignmentId);
      navigate("/worker");
    } catch (err: any) {
      console.error(" Error al cerrar el día:", {
        status: err?.response?.status,
        message: err?.response?.data?.message,
        data: err?.response?.data,
      });
      toastT.error([
        err?.response?.data?.message || "toasts.workday.dayCloseError",
      ]);
    }
  };

  const handleSendPartialClosure = async (
    reason: string,
    finalKmValue: number,
  ) => {
    if (!token || !assignedDay) return;

    const reasonTrimmed = (reason ?? "").trim();
    if (!reasonTrimmed) {
      toastT.warn(["toasts.workday.partialReasonRequired"]);
      return;
    }

    if (isNaN(finalKmValue)) {
      toastT.warn(["toasts.workday.enterFinalKmInModal"]);
      return;
    }
    if (Number(finalKmValue) < Number(initialAmbulanceKm)) {
      toastT.warn(["toasts.workday.finalKmLessThanInitial"]);
      return;
    }

    // ? NUEVO: exige ambulancia confirmada e ID presente
    if (!vehicleConfirmed || !ambulanceId) {
      toastT.warn(["toasts.workday.needInitialData"]); // o crea un texto: "Confirma vehículo y km iniciales"
      return;
    }
    if (!ambulanceNumber) {
      toastT.warn(["toasts.workday.enterAmbulanceAndKm"]);
      return;
    }

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
        issueData,
      });


      await sendPartialClosure(payload, token);

      notifyAdminSummariesChanged();

      // Si vino una avería en el parcial, notifica para refrescar el badge
      if (issueData) {
        notifyAdminIssuesChanged();
      }

      toastT.success(
        issueData
          ? ["toasts.workday.partialSentWithIssue"]
          : ["toasts.workday.partialSent"],
      );

      clearAmbulanceData(assignedDay.assignmentId);
      localStorage.removeItem(confirmedAmbulanceKey(assignedDay.assignmentId));

      setTrips([]);
      setWasCancelled(false);
      setCountsTrip(1);
      setShowReviewModal(false);
      setAmbulanceNumber("");
      setInitialAmbulanceKm("");
      setFinalAmbulanceKm("");
      setVehicleConfirmed(false);

      navigate("/worker");
    } catch (err: any) {
      console.error(" Error al enviar cierre parcial:", {
        status: err?.response?.status,
        message: err?.response?.data?.message,
        data: err?.response?.data,
      });
      toastT.error([
        err?.response?.data?.message || "toasts.workday.partialSendError",
      ]);
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
              <span aria-hidden="true">??</span>
              <span>
                {assignedDay.startTime}{assignedDay.endTime}
              </span>
            </div>

            <div className="text-sm text-slate-500 capitalize">
              {weekday} · {todayFormatted}
            </div>
          </div>
        )}
      </div>

      {isClosingDay ? (
        <div className="mb-6 rounded-xl bg-red-50 text-red-700 ring-1 ring-red-200 p-4">
          {t("pages.workday.closedDay")}
        </div>
      ) : !assignedDay ? (
        <div className="mb-6 rounded-xl bg-yellow-50 text-yellow-800 ring-1 ring-yellow-200 p-4">
          {t("pages.workday.noAssignment")}
        </div>
      ) : !canStartWork ? (
        <div className="mb-6 rounded-xl bg-blue-50 text-blue-800 ring-1 ring-blue-200 p-4">
          {t("pages.workday.cantStart", { start: assignedDay.startTime })}
        </div>
      ) : (
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
              onOpenTrip={(trip) => setSelectedTrip(trip)}
              vehicleConfirmed={vehicleConfirmed}
              isClosingDay={isClosingDay}
              onCloseAndSend={() => setShowCloseQuestion(true)}
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
                    onClick={() => {
                      setIsFinalClosure(true);
                      setShowCloseQuestion(false);
                      setShowReviewModal(true);
                    }}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg"
                  >
                    {t("pages.workday.closeQuestion.yes")}
                  </button>

                  <button
                    onClick={() => {
                      setIsFinalClosure(false);
                      setShowCloseQuestion(false);
                      setShowReviewModal(true);
                    }}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-2 rounded-lg"
                  >
                    {t("pages.workday.closeQuestion.partial")}
                  </button>

                  <button
                    onClick={() => setShowCloseQuestion(false)}
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
          onClose={() => setShowReviewModal(false)}
          onSend={async (reason, finalKmValue, _totalEffectivePatients, issue) => {
            setIssueData(issue || null);
            await handleSendPartialClosure(reason, finalKmValue);
          }}

        />
      )}

      {showReviewModal && isFinalClosure === true && assignedDay && (
        <FinalReviewModal
          isOpen={true}
          onClose={() => setShowReviewModal(false)}
          trips={trips}
          assignedDay={assignedDay}
          ambulanceId={ambulanceId}
          ambulanceNumber={ambulanceNumber}
          initialKm={initialAmbulanceKm}
          finalKm={finalAmbulanceKm}
          onConfirm={handleConfirmFinalClosure}
        />
      )}
    </div>
  );
};

export default MyWorkday;
