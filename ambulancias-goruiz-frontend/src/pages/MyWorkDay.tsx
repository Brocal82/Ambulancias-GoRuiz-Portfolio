// frontend/src/pages/MyWorkday.tsx

import { useState, useEffect, useCallback, useRef } from "react";
import { createTrip, getTripsByDate } from "../api/trips";
import { getAssignedDaysForUser } from "../api/diensts";
import { useAuth } from "../hooks/useAuth";
import { toastT } from "../utils/toast";
import type { Trip, TripData } from "../types/trip";
import type { AssignedDayFull } from "../types/dienst";
import TripModal from "../components/trips/TripModal";
import { useNavigate } from "react-router-dom";
import FinalReviewModal from "../components/workday/FinalReviewModal";
import PartialReviewModal from "../components/workday/PartialReviewModal";
import { sendPartialClosure, sendFinalClosure } from "../api/workdaySummary";
import type { PartialSummaryPayload, FinalSummaryPayload } from "../types/workdaySummary";
import { checkTripLogic, type TripDraft } from "../utils/tripValidators";
import { getCurrentTimeString, formatYYYYMMDDToDDMMYYYY } from "../utils/timeUtils";
import { saveAmbulanceData, loadAmbulanceData, clearAmbulanceData, confirmedAmbulanceKey } from "../utils/workdayKey";
import { getAllAmbulances } from "../api/ambulances";
import type { Ambulance } from "../types/ambulance";
import { useTranslation } from "react-i18next";
import { notifyAdminIssuesChanged } from "../hooks/useAdminIssuesOpenCount";
import { notifyAdminSummariesChanged } from "../hooks/useAdminSummariesPendingCount";


/** Devuelve true si AHORA ya se pueden registrar viajes. */
const canStartTripNow = (startTime: string, dienstDate: string): boolean => {
  const [sh, sm] = startTime.split(":").map(Number);
  const start = new Date(dienstDate + "T00:00:00");
  start.setHours(sh, sm - 30, 0, 0); // 30 min antes
  const now = new Date();
  return now >= start;
};

/** Clave de día cerrado en localStorage */
const getClosedDayKey = (date: string, uid?: string) => `workdayClosed-${date}-${uid ?? "anon"}`;

/** ¿El Dienst cruza medianoche? */
const crossesMidnight = (start: string, end: string) => {
  const [sh] = start.split(":").map(Number);
  const [eh] = end.split(":").map(Number);
  return eh < sh;
};

/** ¿AHORA mismo dentro del Dienst (soporta nocturno que empezó ayer)? */
const isNowWithinDienst = (dienst: AssignedDayFull) => {
  const now = new Date();
  const [sH, sM] = dienst.startTime.split(":").map(Number);
  const [eH, eM] = dienst.endTime.split(":").map(Number);

  const start = new Date(dienst.date + "T00:00:00");
  start.setHours(sH, sM, 0, 0);

  const end = new Date(dienst.date + "T00:00:00");
  end.setHours(eH, eM, 0, 0);
  if (crossesMidnight(dienst.startTime, dienst.endTime)) {
    end.setDate(end.getDate() + 1);
  }

  return now >= start && now <= end;
};

const MyWorkday = () => {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const today = new Date().toISOString().split("T")[0];
  const todayFormatted = formatYYYYMMDDToDDMMYYYY(today);

  const [wasCancelled, setWasCancelled] = useState(false);
  const [countsTrip, setCountsTrip] = useState<number>(1);
  const [reports, setReports] = useState("");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [assignedDay, setAssignedDay] = useState<AssignedDayFull | null>(null);
  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [ambulanceId, setAmbulanceId] = useState<string>("");

  const [canStartWork, setCanStartWork] = useState(false);
  const [ambulanceNumber, setAmbulanceNumber] = useState("");

  const [vehicleConfirmed, setVehicleConfirmed] = useState(false);
  const formBlocked = !vehicleConfirmed;

  const [initialAmbulanceKm, setInitialAmbulanceKm] = useState("");
  const [finalAmbulanceKm, setFinalAmbulanceKm] = useState("");
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [isClosingDay, setIsClosingDay] = useState(false);

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
  const [previousTripFormData, setPreviousTripFormData] = useState<TripData | null>(null);
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
      ambulanceNum, // <— usar el valor real, no el state aún sincrónico
      initialAmbulanceKm
    );

    localStorage.setItem(confirmedAmbulanceKey(assignedDay.assignmentId), "true");
  };

  const handleCloseTripModal = () => setSelectedTrip(null);
  const handleOpenTripModal = (trip: Trip) => setSelectedTrip(trip);

  const fetchTrips = useCallback(async () => {
    if (!token || !user?._id) return;

    const closedKey = getClosedDayKey(today, user._id);
    const closedFlag = localStorage.getItem(closedKey);
    if (closedFlag === "true") {
      setTrips([]);
      return;
    }

    try {
      const data = await getTripsByDate(today, token);
      const pending = data.filter((t) => !t.sentInSummary);
      const mine = pending.filter((t) => t.driver === user._id || t.medic === user._id);
      setTrips(mine);
    } catch (err) {
      console.error(err);
      toastT.error(["toasts.workday.loadTripsError"]);
    }
  }, [token, today, user?._id]);

  const fetchAssignedDay = useCallback(async () => {
    if (!token || !user?._id) return;

    try {
      const days = await getAssignedDaysForUser(user._id, token);

      let todayAssignment = days.find((d) => d.date === today);

      if (!todayAssignment) {
        const yesterdayStr = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];
        const yestAssignment = days.find((d) => d.date === yesterdayStr);
        if (
          yestAssignment &&
          crossesMidnight(yestAssignment.startTime, yestAssignment.endTime) &&
          isNowWithinDienst(yestAssignment)
        ) {
          todayAssignment = yestAssignment;
        }
      }

      if (todayAssignment) {
        setAssignedDay(todayAssignment);
        checkStartPermission(todayAssignment);
      } else {
        setAssignedDay(null);
        setCanStartWork(false);
      }
    } catch (err) {
      console.error(err);
      toastT.error(["toasts.workday.loadAssignmentError"]);
    }
  }, [token, user?._id, today]);

  const checkStartPermission = (dienst: AssignedDayFull) => {
    const [startHour, startMinute] = dienst.startTime.split(":").map(Number);
    const now = new Date();
    const dienstStart = new Date();
    dienstStart.setHours(startHour);
    dienstStart.setMinutes(startMinute - 30);
    dienstStart.setSeconds(0);
    setCanStartWork(now >= dienstStart);
  };

  useEffect(() => {
    if (!user?._id) return;
    const closedDayKey = getClosedDayKey(today, user._id);
    const closedFlag = localStorage.getItem(closedDayKey);
    setIsClosingDay(closedFlag === "true");
    if (closedFlag === "true") setTrips([]);
  }, [today, user?._id]);

  useEffect(() => {
    fetchTrips();
    fetchAssignedDay();
  }, [fetchTrips, fetchAssignedDay]);

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
      localStorage.getItem(confirmedAmbulanceKey(assignedDay.assignmentId)) === "true";
    setVehicleConfirmed(isConfirmed);
  }, [assignedDay, ambulances]);

  useEffect(() => {
    if (assignedDay && ambulanceId && ambulanceNumber && initialAmbulanceKm) {
      saveAmbulanceData(assignedDay.assignmentId, ambulanceId, ambulanceNumber, initialAmbulanceKm);
    }
  }, [ambulanceId, ambulanceNumber, initialAmbulanceKm, assignedDay]);

  useEffect(() => {
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
      wasCancelled
    );
    setDraftError(result.error || "");
    setBadField(result.badField);
  }, [tripFormData, wasCancelled]);

  useEffect(() => {
    const fetchAmbulances = async () => {
      try {
        if (!token) return;
        const data = await getAllAmbulances(token);
        setAmbulances(data);
      } catch (err) {
        console.error("❌ Error al cargar ambulancias:", err);
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
      toastT.error(["toasts.workday.tooEarly"])
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
      console.error("❌ Error al crear trip:", err);
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
        timeEnd: "🔗 Anschluss",
      };
      const createdTrip = await createTrip(newTrip);
       toastT.success(["toasts.workday.anschlussSaved"]);
      setTrips((prev) => [...prev, createdTrip]);
    } catch (err) {
      console.error("❌ Error al guardar paciente 1:", err);
      toastT.error(["toasts.workday.anschlussSaveError"]);
    }
  };

  const handleConfirmFinalClosure = async (note: string, finalKmFromModal: number) => {
  if (!token || !assignedDay || !user?._id) return;

  // ✅ exige datos confirmados de vehículo
  if (!vehicleConfirmed || !ambulanceId || !ambulanceNumber || !initialAmbulanceKm) {
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
    const totalDienstKm = finalKmFromModal - initialKmNumber;

    // 🔧 normaliza trips (por si acaso)
    const sanitizedTrips = trips.map((t) => ({
      ...t,
      wasCancelled: !!t.wasCancelled,
      cancelledAtPickup: !!t.cancelledAtPickup,
      countsTrip: typeof t.countsTrip === "number" ? (t.countsTrip === 1 ? 1 : 0) : 1,
    }));

    const summaryData: FinalSummaryPayload = {
  date: today,
  assignmentId: assignedDay.assignmentId,

  // ✅ usa el estado confirmado (no assignedDay.ambulanceId)
  ambulanceId: ambulanceId,
  ambulanceNumber,

  // ✅ el tipo los exige
  driver: assignedDay.driver._id,
  medic: assignedDay.medic._id,

  initialKm: initialKmNumber,
  finalKm: finalKmFromModal,
  totalDienstKm,

  // si estás usando sanitizedTrips, ponlo aquí
  trips: sanitizedTrips,

  extraNote: note,
  isFinalClosure: true,
  dienstNumber: assignedDay.dienstNumber,
  startTime: assignedDay.startTime,
  endTime: assignedDay.endTime,
};


    // Opcional: log para depurar si volviese a fallar
    // console.log("[final-closure] payload:", summaryData);

    await sendFinalClosure(summaryData, token);

    notifyAdminSummariesChanged();


    toastT.success(["toasts.workday.dayClosedSuccess"]);

    localStorage.setItem(getClosedDayKey(today, assignedDay.driver._id), "true");
    localStorage.setItem(getClosedDayKey(today, assignedDay.medic._id), "true");

    setTrips([]);
    setIsClosingDay(true);
    setShowReviewModal(false);
    clearAmbulanceData(assignedDay.assignmentId);
    navigate("/worker");
  } catch (err: any) {
    console.error("❌ Error al cerrar el día:", {
      status: err?.response?.status,
      message: err?.response?.data?.message,
      data: err?.response?.data,
    });
    toastT.error([err?.response?.data?.message || "toasts.workday.dayCloseError"]);
  }
};


  const handleSendPartialClosure = async (reason: string, finalKmValue: number) => {
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

  // ✅ NUEVO: exige ambulancia confirmada e ID presente
  if (!vehicleConfirmed || !ambulanceId) {
    toastT.warn(["toasts.workday.needInitialData"]); // o crea un texto: "Confirma vehículo y km iniciales"
    return;
  }
  if (!ambulanceNumber) {
    toastT.warn(["toasts.workday.enterAmbulanceAndKm"]);
    return;
  }

  try {
    const totalDienstKm = Number(finalKmValue) - Number(initialAmbulanceKm);

    const sanitizedTrips = trips.map((t) => ({
      ...t,
      wasCancelled: !!t.wasCancelled,
      cancelledAtPickup: !!t.cancelledAtPickup,
      countsTrip: typeof t.countsTrip === "number" ? (t.countsTrip === 1 ? 1 : 0) : 1,
    }));

    const payload: PartialSummaryPayload & { issueData?: any } = {
      date: today,
      assignmentId: assignedDay.assignmentId,
      driver: assignedDay.driver._id,
      medic: assignedDay.medic._id,
      // ⬇️⬇️ USAR EL ESTADO, NO assignedDay
      ambulanceId: ambulanceId, 
      ambulanceNumber,
      initialKm: Number(initialAmbulanceKm),
      finalKm: Number(finalKmValue),
      trips: sanitizedTrips,
      totalDienstKm,
      partialClosureReason: reasonTrimmed,
      isFinalClosure: false,
      dienstNumber: assignedDay.dienstNumber,
      startTime: assignedDay.startTime,
      endTime: assignedDay.endTime,
      ...(issueData ? { issueData } : {}),
    };

    await sendPartialClosure(payload, token);

    notifyAdminSummariesChanged();


    // Si vino una avería en el parcial, notifica para refrescar el badge
    if (issueData) {
      notifyAdminIssuesChanged();
    }


    toastT.success(issueData ? ["toasts.workday.partialSentWithIssue"] : ["toasts.workday.partialSent"]);

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
    console.error("❌ Error al enviar cierre parcial:", {
      status: err?.response?.status,
      message: err?.response?.data?.message,
      data: err?.response?.data,
    });
    toastT.error([err?.response?.data?.message || "toasts.workday.partialSendError"]);
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
      assignmentId: assignedDay.assignmentId, // <— FIX: antes usaba dienstId
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

return (
  <div className="p-6 max-w-3xl mx-auto">
    <h2 className="text-2xl font-bold mb-4">
      {t("pages.workday.title", { date: todayFormatted })}
    </h2>

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
        <div className="bg-white p-5 rounded-2xl shadow-sm ring-1 ring-slate-200 mb-6 space-y-4">
          {/* Cabecera asignación + selección vehículo */}
          <div className="bg-slate-50 p-4 rounded-xl shadow-sm ring-1 ring-slate-200 mb-2 flex justify-between items-start gap-4">
            {assignedDay && (
              <div>
                <p className="text-sm text-slate-600 mb-1">
                  {t("pages.workday.dienstTimeLabel")}{" "}
                  <strong>{assignedDay.startTime}</strong> –{" "}
                  <strong>{assignedDay.endTime}</strong>
                </p>
                <p className="font-semibold text-lg mb-1">
                  {t("pages.workday.teamLabel")}
                </p>
                <p>🚗 {assignedDay.driver?.lastName}, {assignedDay.driver?.name}</p>
                <p>🧑‍⚕️ {assignedDay.medic?.lastName}, {assignedDay.medic?.name}</p>
              </div>
            )}

            <div className="w-full max-w-xs space-y-4">
              <div>
                <label htmlFor="ambulanceId" className="block text-sm font-medium text-slate-700">
                  {t("pages.workday.selectAmbulance.label")}
                </label>
                <select
                  id="ambulanceId"
                  value={ambulanceId}
                  onChange={(e) => setAmbulanceId(e.target.value)}
                  disabled={vehicleConfirmed}
                  className="w-full rounded-lg bg-white px-3 py-2 text-right
                             ring-1 ring-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-300
                             disabled:bg-slate-50"
                >
                  <option value="">{t("pages.workday.selectAmbulance.placeholder")}</option>
                  {ambulances.map((amb) => (
                    <option key={amb._id} value={amb._id}>
                      {amb.ambulanceNumber}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="initialAmbulanceKm" className="block text-sm font-medium text-slate-700">
                  {t("pages.workday.initialKm")}
                </label>
                <input
                  id="initialAmbulanceKm"
                  type="number"
                  placeholder="123456"
                  title="Kilometraje de la ambulancia al comenzar el día"
                  value={initialAmbulanceKm}
                  onChange={(e) => setInitialAmbulanceKm(e.target.value)}
                  disabled={vehicleConfirmed}
                  className="w-full rounded-lg bg-white px-3 py-2 text-right
                             ring-1 ring-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-300
                             disabled:bg-slate-50"
                />
              </div>

              {!vehicleConfirmed && (
                <button
                  type="button"
                  onClick={handleConfirmAmbulanceData}
                  className="mt-2 w-full bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg"
                >
                  {t("pages.workday.confirmInitialData")}
                </button>
              )}
            </div>
          </div>

          {vehicleConfirmed && (
            <>
              {/* Datos del viaje */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="auftragNumber" className="block text-sm font-medium text-slate-700">
                    {t("pages.workday.auftragNumber")}
                  </label>
                  <input
                    disabled={formBlocked}
                    id="auftragNumber"
                    placeholder="0000"
                    value={tripFormData.auftragNumber}
                    onChange={(e) => setTripFormData((prev) => ({ ...prev, auftragNumber: e.target.value }))}
                    className="w-full rounded-lg bg-white px-3 py-2
                               ring-1 ring-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-300
                               disabled:bg-slate-50"
                  />
                </div>

                <div>
                  <label htmlFor="patientName" className="block text-sm font-medium text-slate-700">
                    {t("pages.workday.patientName")}
                  </label>
                  <input
                    disabled={formBlocked}
                    id="patientName"
                    placeholder="Antonio Ruiz"
                    value={tripFormData.patientName}
                    onChange={(e) => setTripFormData((prev) => ({ ...prev, patientName: e.target.value }))}
                    className="w-full rounded-lg bg-white px-3 py-2
                               ring-1 ring-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-300
                               disabled:bg-slate-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div>
                  <label htmlFor="fromAddress" className="block text-sm font-medium text-slate-700">
                    {t("pages.workday.fromAddress")}
                  </label>
                  <input
                    disabled={formBlocked}
                    id="fromAddress"
                    placeholder="...Straße"
                    value={tripFormData.fromAddress}
                    onChange={(e) => setTripFormData((prev) => ({ ...prev, fromAddress: e.target.value }))}
                    className="w-full rounded-lg bg-white px-3 py-2
                               ring-1 ring-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-300
                               disabled:bg-slate-50"
                  />
                </div>

                <div>
                  <label htmlFor="toAddress" className="block text-sm font-medium text-slate-700">
                    {t("pages.workday.toAddress")}
                  </label>
                  <input
                    disabled={formBlocked}
                    id="toAddress"
                    placeholder="...Straße"
                    value={tripFormData.toAddress}
                    onChange={(e) => setTripFormData((prev) => ({ ...prev, toAddress: e.target.value }))}
                    className="w-full rounded-lg bg-white px-3 py-2
                               ring-1 ring-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-300
                               disabled:bg-slate-50"
                  />
                </div>
              </div>

              {/* Tiempos y KMs */}
              <div className="grid grid-cols-1 md:grid-cols-7 gap-3 mt-4">
                <div>
                  <label htmlFor="timeWarning" className="block text-sm font-medium text-slate-700 text-center">
                    {t("pages.workday.time.warning")}
                  </label>
                  <input
                    ref={timeWarningRef}
                    disabled={formBlocked}
                    id="timeWarning"
                    type="time"
                    value={tripFormData.timeWarning}
                    onChange={(e) => setTripFormData((prev) => ({ ...prev, timeWarning: e.target.value }))}
                    onDoubleClick={() => setTripFormData((prev) => ({ ...prev, timeWarning: getCurrentTimeString() }))}
                    className={`w-full rounded-lg px-3 py-2 focus:outline-none focus:ring-2 ${
                      badField === "timeWarning" ? "ring-rose-300" : "ring-slate-300 focus:ring-blue-300"
                    } ring-1 bg-white`}
                  />
                </div>

                <div>
                  <label htmlFor="timeAtHome" className="block text-sm font-medium text-slate-700 text-center">
                    {t("pages.workday.time.atHome")}
                  </label>
                  <input
                    ref={timeAtHomeRef}
                    disabled={formBlocked}
                    id="timeAtHome"
                    type="time"
                    value={tripFormData.timeAtHome}
                    onChange={(e) => {
                      const value = e.target.value;
                      setTripFormData((prev) => ({ ...prev, timeAtHome: value }));
                      if (anschlussActive) {
                        setPreviousTripFormData((prev) => (prev ? { ...prev, timeArrival: value } : null));
                      }
                    }}
                    onDoubleClick={() => setTripFormData((prev) => ({ ...prev, timeAtHome: getCurrentTimeString() }))}
                    className={`w-full rounded-lg px-3 py-2 focus:outline-none focus:ring-2 ${
                      badField === "timeAtHome" ? "ring-rose-300" : "ring-slate-300 focus:ring-blue-300"
                    } ring-1 bg-white`}
                  />
                </div>

                <div>
                  <label htmlFor="kmStart" className="block text-sm font-medium text-slate-700 text-center">
                    {t("pages.workday.km.start")}
                  </label>
                  <input
                    ref={kmStartRef}
                    disabled={formBlocked}
                    id="kmStart"
                    type="number"
                    value={tripFormData.kmStart === 0 ? "" : tripFormData.kmStart}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setTripFormData((prev) => ({ ...prev, kmStart: value }));
                      if (anschlussActive) {
                        setPreviousTripFormData((prev) => (prev ? { ...prev, kmEnd: value } : null));
                      }
                    }}
                    className={`w-full rounded-lg px-3 py-2 focus:outline-none focus:ring-2 ${
                      badField === "kmStart" ? "ring-rose-300" : "ring-slate-300 focus:ring-blue-300"
                    } ring-1 bg-white`}
                  />
                </div>

                <div>
                  <label htmlFor="timePickup" className="block text-sm font-medium text-slate-700 text-center">
                    {t("pages.workday.time.pickup")}
                  </label>
                  <input
                    ref={timePickupRef}
                    disabled={formBlocked}
                    id="timePickup"
                    type="time"
                    value={tripFormData.timePickup}
                    onChange={async (e) => {
                      const newTime = e.target.value;
                      setTripFormData((prev) => {
                        const updated = { ...prev, timePickup: newTime };
                        if (anschlussActive && previousTripFormData && anschlussGuardRef.current) {
                          anschlussGuardRef.current = false;
                          const updatedTrip: TripData = {
                            ...previousTripFormData,
                            timeArrival: newTime,
                            kmEnd: updated.kmStart ?? 0,
                            timeEnd: "🔗 Anschluss",
                          };
                          saveAnschlussPatient1(updatedTrip);
                          setPreviousTripFormData(null);
                          setAnschlussActive(false);
                        }
                        return updated;
                      });
                    }}
                    onDoubleClick={() =>
                      setTripFormData((prev) => {
                        const currentTime = getCurrentTimeString();
                        const updated = { ...prev, timePickup: currentTime };
                        if (anschlussActive && previousTripFormData && anschlussGuardRef.current) {
                          anschlussGuardRef.current = false;
                          const updatedTrip: TripData = {
                            ...previousTripFormData,
                            timeArrival: currentTime,
                            kmEnd: updated.kmStart ?? 0,
                            timeEnd: "🔗 Anschluss",
                          };
                          saveAnschlussPatient1(updatedTrip);
                          setPreviousTripFormData(null);
                          setAnschlussActive(false);
                        }
                        return updated;
                      })
                    }
                    className={`w-full rounded-lg px-3 py-2 focus:outline-none focus:ring-2 ${
                      badField === "timePickup" ? "ring-rose-300" : "ring-slate-300 focus:ring-blue-300"
                    } ring-1 bg-white`}
                  />
                </div>

                <div>
                  <label htmlFor="timeArrival" className="block text-sm font-medium text-slate-700 text-center">
                    {t("pages.workday.time.arrival")}
                  </label>
                  <input
                    ref={timeArrivalRef}
                    disabled={formBlocked}
                    id="timeArrival"
                    type="time"
                    value={tripFormData.timeArrival}
                    onChange={(e) => setTripFormData((prev) => ({ ...prev, timeArrival: e.target.value }))}
                    onDoubleClick={() => setTripFormData((prev) => ({ ...prev, timeArrival: getCurrentTimeString() }))}
                    className={`w-full rounded-lg px-3 py-2 focus:outline-none focus:ring-2 ${
                      badField === "timeArrival" ? "ring-rose-300" : "ring-slate-300 focus:ring-blue-300"
                    } ring-1 bg-white`}
                  />
                </div>

                <div>
                  <label htmlFor="kmEnd" className="block text-sm font-medium text-slate-700 text-center">
                    {t("pages.workday.km.end")}
                  </label>
                  <input
                    ref={kmEndRef}
                    disabled={formBlocked}
                    id="kmEnd"
                    type="number"
                    value={tripFormData.kmEnd === 0 ? "" : tripFormData.kmEnd}
                    onChange={(e) => setTripFormData((prev) => ({ ...prev, kmEnd: Number(e.target.value) }))}
                    className={`w-full rounded-lg px-3 py-2 focus:outline-none focus:ring-2 ${
                      badField === "kmEnd" ? "ring-rose-300" : "ring-slate-300 focus:ring-blue-300"
                    } ring-1 bg-white`}
                  />
                </div>

                <div>
                  <label htmlFor="timeEnd" className="block text-sm font-medium text-slate-700 text-center">
                    {t("pages.workday.time.end")}
                  </label>
                  <input
                    ref={timeEndRef}
                    disabled={formBlocked}
                    id="timeEnd"
                    type="time"
                    value={tripFormData.timeEnd}
                    onChange={(e) => setTripFormData((prev) => ({ ...prev, timeEnd: e.target.value }))}
                    onDoubleClick={() => setTripFormData((prev) => ({ ...prev, timeEnd: getCurrentTimeString() }))}
                    className={`w-full rounded-lg px-3 py-2 focus:outline-none focus:ring-2 ${
                      badField === "timeEnd" ? "ring-rose-300" : "ring-slate-300 focus:ring-blue-300"
                    } ring-1 bg-white`}
                  />
                </div>
              </div>


              {/* Botones auxiliares */}
              {(tripFormData.timePickup || anschlussActive) && (
                <div className="flex items-center mt-3 space-x-2">
                  <button
                    type="button"
                    onClick={anschlussActive ? handleCancelAnschluss : handleAddAnschluss}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold transition 
                      ${anschlussActive ? "bg-red-500 hover:bg-red-600" : "bg-orange-500 hover:bg-orange-600"}`}
                    title={anschlussActive ? t("pages.workday.anschluss.cancelTitle") : t("pages.workday.anschluss.addTitle")}
                  >
                    {anschlussActive ? "✖" : "+"}
                  </button>
                  <span className="text-sm text-slate-700">
                    {anschlussActive ? t("pages.workday.anschluss.cancelLabel") : t("pages.workday.anschluss.addLabel")}
                  </span>
                </div>
              )}

              <div className="space-y-2 mt-1">
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => { setWasCancelled(!wasCancelled); if (wasCancelled) setCountsTrip(1); }}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold transition 
                      ${wasCancelled ? "bg-red-600 hover:bg-red-700" : "bg-slate-400 hover:bg-slate-500"}`}
                    title="Marcar viaje como cancelado"
                  >
                    {wasCancelled ? "✖" : "🅂"}
                  </button>
                  <span className="text-sm text-slate-700">{t("pages.workday.storno.label")}</span>
                </div>

                {wasCancelled && (
                  <div className="ml-6">
                    <label htmlFor="countsTrip" className="block text-sm font-medium text-slate-700 mb-1">
                      {t("pages.workday.storno.countsQuestion")}
                    </label>
                    <select
                      id="countsTrip"
                      value={countsTrip}
                      onChange={(e) => setCountsTrip(Number(e.target.value))}
                      className="w-full rounded-lg bg-white px-3 py-2
                                 ring-1 ring-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    >
                      <option value={1}>{t("pages.workday.storno.counts.yes")}</option>
                      <option value={0}>{t("pages.workday.storno.counts.no")}</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="mt-2">
                <label htmlFor="reports" className="block text-sm font-medium text-slate-700">
                  {t("pages.workday.reports.label")}
                </label>
                <textarea
                  disabled={formBlocked}
                  id="reports"
                  placeholder={t("pages.workday.reports.placeholder")}
                  title={t("pages.workday.reports.title")}
                  value={reports}
                  onChange={(e) => setReports(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg bg-white px-3 py-2
                             ring-1 ring-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-300
                             disabled:bg-slate-50"
                />
              </div>

              {draftError && (
                <div className="mt-2 rounded-lg bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-3 py-2">
                  {draftError}
                </div>
              )}

              <button
                onClick={handleSaveTrip}
                disabled={Boolean(draftError)}
                className={`w-full mt-2 py-2 px-4 rounded-lg text-white ${
                  draftError ? "bg-slate-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {t("pages.workday.saveTrip")}
              </button>

              <h3 className="text-xl font-semibold mt-6">{t("pages.workday.tripSummary")}</h3>
              <ul className="mt-2 space-y-2">
                {trips.map((trip: Trip, idx: number) => {
                  const totalKm = trip.wasCancelled ? 0 : (typeof trip.totalKm === "number" ? trip.totalKm : trip.kmEnd - trip.kmStart);

                  const getMultiplier = () => {
                    const isWeekendAfternoonShift = () => {
                      if (!assignedDay) return false;
                      const day = new Date(assignedDay.date).getDay();
                      if (day !== 0 && day !== 6) return false;
                      const [h] = assignedDay.startTime.split(":").map(Number);
                      return h >= 14 && h <= 17;
                    };
                    if (trip.countsTrip === 0) return 0;
                    if (totalKm >= 20) return 2;
                    if (totalKm >= 15) return 1.5;
                    if (isWeekendAfternoonShift()) return 1.5;
                    return 1;
                  };

                  const multiplier = getMultiplier();

                  return (
                    <li
                      key={trip._id || idx}
                      onClick={() => handleOpenTripModal(trip)}
                      className="bg-white p-3 rounded-xl shadow-sm ring-1 ring-slate-200 cursor-pointer hover:bg-blue-50"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">
                          {trip.auftragNumber}
                          {trip.wasCancelled && (
                            <span className="ml-2 text-red-600 font-medium">
                              {t("pages.workday.tripCancelledTag")}
                            </span>
                          )}
                        </span>
                        <span>
                          {totalKm} km
                          <span className="ml-3 text-green-700 font-bold text-xl">
                            {multiplier}x
                          </span>
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {vehicleConfirmed && !isClosingDay && (
                <button
                  onClick={() => setShowCloseQuestion(true)}
                  className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg"
                >
                  {t("pages.workday.closeAndSend")}
                </button>
              )}
            </>
          )}

          {!vehicleConfirmed && (
            <div className="rounded-lg bg-amber-50 text-amber-800 ring-1 ring-amber-200 p-4">
              {t("pages.workday.needVehicleData")}
            </div>
          )}
        </div>

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

    {selectedTrip && <TripModal trip={selectedTrip} onClose={handleCloseTripModal} />}

    {showReviewModal && !isFinalClosure && assignedDay && (
      <PartialReviewModal
        trips={trips}
        assignedDay={assignedDay}
        ambulanceId={ambulanceId}
        ambulanceNumber={ambulanceNumber}
        initialKm={initialAmbulanceKm}
        finalKm={finalAmbulanceKm}
        onClose={() => setShowReviewModal(false)}
        onSend={(reason, finalKmValue, issue) => {
          setIssueData(issue || null);
          handleSendPartialClosure(reason, finalKmValue);
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
