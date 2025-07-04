// frontend/src/pages/MyWorkday.tsx

import { useState, useEffect, useCallback, useRef } from "react";
import { createTrip, getTripsByDate } from "../api/trips";
import { getAssignedDaysForUser } from "../api/diensts";
import { useAuth } from "../hooks/useAuth";
import { toast } from "react-toastify";
import type { Trip, TripData } from "../types/trip";
import type { AssignedDayFull } from "../types/assignedDay";
import TripModal from "../components/trips/TripModal";
import { useNavigate } from "react-router-dom";
import FinalReviewModal from "../components/workday/FinalReviewModal";
import PartialReviewModal from "../components/workday/PartialReviewModal";
import { sendPartialClosure } from "../api/workdaySummary";
import type { PartialSummaryPayload, FinalSummaryPayload } from "../types/workdaySummary";
import { checkTripLogic, type TripDraft } from "../utils/tripValidators";
import { sendFinalClosure } from "../api/workdaySummary"; // ← Asegúrate de importar esto arriba
import { getCurrentTimeString } from "../utils/timeUtils";
import { saveAmbulanceData, loadAmbulanceData, clearAmbulanceData, confirmedAmbulanceKey} from "../utils/workdayKey";



/** Devuelve true si AHORA ya se pueden registrar viajes.
 *  - Permite hacerlo 30 min antes de la hora de inicio.
 *  - Funciona también cuando el Dienst empezó AYER (turno nocturno). */
const canStartTripNow = (startTime: string, dienstDate: string): boolean => {
  const [sh, sm] = startTime.split(":").map(Number);

  // 🕒 Fecha de inicio real del Dienst
  const start = new Date(dienstDate + "T00:00:00");
  start.setHours(sh, sm - 30, 0, 0);          // 30 min antes

  const now = new Date();
  return now >= start;
};

/** Devuelve la clave de localStorage que marca un día como cerrado
 *   p.e.  workdayClosed-2025-07-02-64a1b…  */
const getClosedDayKey = (date: string, uid?: string) =>
  `workdayClosed-${date}-${uid ?? "anon"}`;

/** Devuelve true si el Dienst cruza la medianoche
 * (ej. 22:00 – 06:00)                                     */
const crossesMidnight = (start: string, end: string) => {
  const [sh] = start.split(":").map(Number);
  const [eh] = end.split(":").map(Number);
  return eh < sh;        // p.e. 06 < 22  ⇒ cruza
};

/** Devuelve true si AHORA mismo estoy dentro de un Dienst,
 *  soportando turno nocturno que comenzó ayer.             */
const isNowWithinDienst = (dienst: AssignedDayFull) => {
  const now = new Date();
  const [sH, sM] = dienst.startTime.split(":").map(Number);
  const [eH, eM] = dienst.endTime.split(":").map(Number);

  // ⏱ crea dos fechas (posible cruce de día)
  const start = new Date(dienst.date + "T00:00:00");
  start.setHours(sH, sM, 0, 0);

  const end = new Date(dienst.date + "T00:00:00");
  end.setHours(eH, eM, 0, 0);
  if (crossesMidnight(dienst.startTime, dienst.endTime)) {
    end.setDate(end.getDate() + 1);   // suma un día
  }

  return now >= start && now <= end;
};


const MyWorkday = () => {
  const { token, user } = useAuth(); // 👈 Asegúrate de tener acceso a user._id
  const today = new Date().toISOString().split("T")[0];

  const [wasCancelled, setWasCancelled] = useState(false);
  const [countsTrip, setCountsTrip] = useState<number>(1);   // ✅ por defecto el viaje cuenta

  const [reports, setReports] = useState("");

  const [trips, setTrips] = useState<Trip[]>([]);
  const [assignedDay, setAssignedDay] = useState<AssignedDayFull | null>(null);
  const [canStartWork, setCanStartWork] = useState(false);
  const [vehicleNumber, setVehicleNumber] = useState("");

  const [vehicleConfirmed, setVehicleConfirmed] = useState(false);
  const formBlocked = !vehicleConfirmed;

  const [initialAmbulanceKm, setInitialAmbulanceKm] = useState("");
  const [finalAmbulanceKm, setFinalAmbulanceKm] = useState("");
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [isClosingDay, setIsClosingDay] = useState(false); // para controlar el estado del botón
  // --- NUEVOS estados para el flujo de cierre --------------------------
  const [showCloseQuestion, setShowCloseQuestion] = useState(false); // ¿Final del día?
  const [isFinalClosure, setIsFinalClosure] = useState<boolean | null>(null); // true = total | false = parcial
  const [showReviewModal, setShowReviewModal] = useState(false); // se abrirá en la fase 2
  // 💡 nuevo: error de validación en tiempo real
  const [draftError, setDraftError] = useState<string>("");   // "" = sin error
  const [badField, setBadField] = useState<keyof TripDraft | null>(null);
  // 🧭 Refs para enfocar inputs con error
  const timeWarningRef = useRef<HTMLInputElement>(null);
  const timeAtHomeRef = useRef<HTMLInputElement>(null);
  const timePickupRef = useRef<HTMLInputElement>(null);
  const timeArrivalRef = useRef<HTMLInputElement>(null);
  const timeEndRef = useRef<HTMLInputElement>(null);
  const kmStartRef = useRef<HTMLInputElement>(null);
  const kmEndRef = useRef<HTMLInputElement>(null);

  const [anschlussActive, setAnschlussActive] = useState(false);
  const [previousTripFormData, setPreviousTripFormData] = useState<TripData | null>(null);

  const anschlussGuardRef = useRef(false); // 🛡️ Protege contra duplicados

  const [tripFormData, setTripFormData] = useState<TripData>({
    date: "",              // <- nuevo
    assignmentId: "",      // <- nuevo
    driver: "",            // <- nuevo
    medic: "",             // <- nuevo
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

  const navigate = useNavigate();

const handleConfirmAmbulanceData = () => {
  if (!vehicleNumber || !initialAmbulanceKm) {
    toast.error("❌ Por favor, introduce el número de ambulancia y los KM iniciales.");
    return;
  }

  if (!assignedDay) return;

  setVehicleConfirmed(true);
  toast.success("✅ Datos confirmados. Ya puedes registrar viajes.");

  // ✅ Guardamos los datos correctamente compartidos por equipo
  saveAmbulanceData(assignedDay.assignmentId, vehicleNumber, initialAmbulanceKm);
  localStorage.setItem(confirmedAmbulanceKey(assignedDay.assignmentId), "true");
};



  const handleCloseTripModal = () => {
    setSelectedTrip(null);
  };

  const handleOpenTripModal = (trip: Trip) => {
    setSelectedTrip(trip);
  };


  /* ------------------------------------------------------------------ */
  /* 1) Obtiene SOLO los viajes pendientes (sentInSummary = false)      */
  /* 2) Muestra únicamente los del usuario log-in (driver / medic)      */
  /* ------------------------------------------------------------------ */
  const fetchTrips = useCallback(async () => {
    if (!token || !user?._id) return;

    /* ——— Día cerrado completamente → no intentes cargar nada ——— */
    const closedKey = getClosedDayKey(today, user._id);
    const closedFlag = localStorage.getItem(closedKey);
    if (closedFlag === "true") {
      console.log("📵 Día cerrado; no se cargan viajes.");
      setTrips([]);               // limpia memoria
      return;
    }

    /* ——— Día aún abierto → pide viajes al backend ——— */
    try {
      const data = await getTripsByDate(today, token);

      /* 1️⃣  ignora los viajes ya enviados en cualquier resumen          */
      const pending = data.filter(t => !t.sentInSummary);

      /* 2️⃣  muestra solo los viajes donde el usuario sea driver/medic   */
      const mine = pending.filter(
        t => t.driver === user._id || t.medic === user._id
      );

      setTrips(mine);
    } catch (err) {
      console.error(err);
      toast.error("❌ Error al cargar los viajes del día");
    }
  }, [token, today, user?._id]);


  const fetchAssignedDay = useCallback(async () => {
    if (!token || !user?._id) return;

    try {
      const days = await getAssignedDaysForUser(user._id, token);

      /* 1️⃣  Intentamos encontrar un Dienst con la fecha de HOY */
      let todayAssignment = days.find((d) => d.date === today);

      /* 2️⃣  Si no hay, buscamos el de AYER y verificamos que aún
              siga activo (cruza medianoche y ahora ≤ hora fin). */
      if (!todayAssignment) {
        const yesterdayStr = new Date(Date.now() - 86_400_000)
          .toISOString()
          .split("T")[0];

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
        checkStartPermission(todayAssignment);        // ya existente
        console.log("🧠 assignedDay cargado correctamente:", todayAssignment);
      } else {
        setAssignedDay(null);
        setCanStartWork(false);
      }
    } catch (err) {
      console.error(err);
      toast.error("❌ Error al cargar el día asignado");
    }
  }, [token, user?._id, today]);


  const checkStartPermission = (dienst: AssignedDayFull) => {
    const [startHour, startMinute] = dienst.startTime.split(':').map(Number);
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

    if (closedFlag === "true") {
      setIsClosingDay(true);
      setTrips([]);          // 👈 borra los viajes si estuvieran en memoria
    } else {
      setIsClosingDay(false);
    }
  }, [today, user?._id]);


  useEffect(() => {
    fetchTrips();
    fetchAssignedDay();
  }, [fetchTrips, fetchAssignedDay]);


useEffect(() => {
  if (!assignedDay) return;

  // Carga los datos compartidos (vehículo y km iniciales)
  const loaded = loadAmbulanceData(assignedDay.assignmentId);
  if (loaded) {
    setVehicleNumber(loaded.vehicleNumber);
    setInitialAmbulanceKm(loaded.initialKm);
  }

  // Verifica si ese equipo ya confirmó los datos
  const isConfirmed =
    localStorage.getItem(confirmedAmbulanceKey(assignedDay.assignmentId)) === "true";

  setVehicleConfirmed(isConfirmed);
}, [assignedDay]);


  useEffect(() => {
  if (assignedDay && vehicleNumber && initialAmbulanceKm) {
    saveAmbulanceData(
      assignedDay.assignmentId,
      vehicleNumber,
      initialAmbulanceKm
    );
  }
}, [vehicleNumber, initialAmbulanceKm, assignedDay]);

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

    console.log("📦 tripFormData:", tripFormData);
    console.log("🚐 kmStart:", kmStart, "kmEnd:", kmEnd);
    console.log("📛 wasCancelled:", wasCancelled);

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
        toast.warn("🚫 Por favor, rellena todos los campos obligatorios");

        return;
      }
    }

    if (!assignedDay) {
      toast.error("❌ No tienes asignación de dienst para hoy");
      return;
    }

    if (!canStartTripNow(assignedDay.startTime, assignedDay.date)) {
      toast.error("❌ Solo puedes crear viajes 30 minutos antes del inicio del Dienst");
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
        toast.error(logicError.error);
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
      toast.success("✅ Viaje guardado");
      setTrips((prev) => [...prev, createdTrip]);

      // Reset
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
      toast.error("❌ Error al guardar el viaje");
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
        timeEnd: "🔗 Anschluss", // ⛑️ Añadimos valor simbólico obligatorio
      };


      const createdTrip = await createTrip(newTrip);
      toast.success("✅ Paciente 1 (Anschluss) guardado");
      setTrips((prev) => [...prev, createdTrip]);
    } catch (err) {
      console.error("❌ Error al guardar paciente 1:", err);
      toast.error("❌ Error al guardar el paciente 1");
    }
  };






  /**
   * Confirma el CIERRE DEFINITIVO del día.
   * - Envía resumen al backend
   * - Limpia estados
   * - Marca el día como cerrado en localStorage
   * - Redirige al dashboard
   */
  /* ────────────────────────────────────────────────
     1.  CIERRE DEFINITIVO  (modal FinalReviewModal)
     ────────────────────────────────────────────────*/

  const handleConfirmFinalClosure = async (note: string, finalKmFromModal: number) => {
    if (!token || !assignedDay || !user?._id) return;

    /* ── Validaciones mínimas ── */
    if (!vehicleNumber || !initialAmbulanceKm) {
      toast.warn("🚐 Introduce nº de ambulancia y KM inicial.");
      return;
    }

    if (isNaN(finalKmFromModal)) {
      toast.warn("📏 Introduce los kilómetros finales en el modal.");
      return;
    }

    /* ── Validación de coherencia de KM ── */
    const initialKmNumber = Number(initialAmbulanceKm);
    if (finalKmFromModal < initialKmNumber) {
      toast.error("❌ Los KM finales no pueden ser menores que los KM iniciales");
      return;
    }

    try {
      // 👉 Guarda en state el km final (para reabrir modal si es necesario)
      setFinalAmbulanceKm(String(finalKmFromModal));

      const totalDienstKm = finalKmFromModal - initialKmNumber;


      const summaryData: FinalSummaryPayload = {
        date: today,
        assignmentId: assignedDay.assignmentId,
        driver: assignedDay.driver._id,
        medic: assignedDay.medic._id,
        vehicleNumber,
        initialKm: initialKmNumber,
        finalKm: finalKmFromModal,
        totalDienstKm,
        trips,
        extraNote: note,
        isFinalClosure: true,
        dienstNumber: assignedDay.dienstNumber,
        startTime: assignedDay.startTime,
        endTime: assignedDay.endTime,
      };









      await sendFinalClosure(summaryData, token);

      toast.success("✅ Día cerrado y datos enviados al admin.");

      // ✅ Marcar día cerrado para ambos (conductor y sanitario)
      localStorage.setItem(getClosedDayKey(today, assignedDay.driver._id), "true");
      localStorage.setItem(getClosedDayKey(today, assignedDay.medic._id), "true");


      // ✅ Limpieza y redirección
      setTrips([]);
      setIsClosingDay(true);
      setShowReviewModal(false);
      clearAmbulanceData(assignedDay.assignmentId);
      navigate("/worker");
      
    } catch (err) {
      console.error("❌ Error al cerrar el día:", err);
      toast.error("❌ No se pudo cerrar el día.");
    }
  };




  /* ────────────────────────────────────────────────
     2.  CIERRE PARCIAL  (modal PartialReviewModal)
     ────────────────────────────────────────────────*/
  const handleSendPartialClosure = async (reason: string, finalKmValue: number) => {
  if (!token || !assignedDay) return;

  if (isNaN(finalKmValue)) {
    toast.warn("📏 Introduce los kilómetros finales en el modal.");
    return;
  }

  if (Number(finalKmValue) < Number(initialAmbulanceKm)) {
    toast.warn("📏 Los KM finales no pueden ser menores que los KM iniciales.");
    return;
  }

  try {

     const totalDienstKm = Number(finalKmValue) - Number(initialAmbulanceKm);



    const payload: PartialSummaryPayload = {
      date: today,
      assignmentId: assignedDay.assignmentId,
      driver: assignedDay.driver._id,
      medic: assignedDay.medic._id,
      vehicleNumber,
      initialKm: Number(initialAmbulanceKm),
      finalKm: finalKmValue,
      trips,
      totalDienstKm,
      partialClosureReason: reason,
      isFinalClosure: false,
      dienstNumber: assignedDay.dienstNumber,
      startTime: assignedDay.startTime,
      endTime: assignedDay.endTime,
          
        };

    await sendPartialClosure(payload, token);

    toast.success("✅ Cierre parcial enviado al admin.");

    // ✅ Borrar datos locales de ambulancia para forzar nuevo inicio
    clearAmbulanceData(assignedDay.assignmentId);
    localStorage.removeItem(confirmedAmbulanceKey(assignedDay.assignmentId));

    // 🧹 Limpieza del formulario
    setTrips([]);
    setWasCancelled(false);
    setCountsTrip(1);
    setShowReviewModal(false);
    setVehicleNumber("");
    setInitialAmbulanceKm("");
    setFinalAmbulanceKm("");

    // ✅ Asegura que se vuelva a mostrar la pantalla de confirmación
    setVehicleConfirmed(false);

    // 🔁 Redirige al dashboard
    navigate("/worker");

  } catch (err) {
    console.error("❌ Error al enviar cierre parcial:", err);
    toast.error("❌ No se pudo enviar el cierre parcial.");
  }
};


  // 🟦 Función para activar Anschluss 
  const handleAddAnschluss = () => {
    if (!assignedDay) {
      console.warn("❗ No hay Dienst asignado para crear Anschluss.");
      return;
    }

    if (!tripFormData.toAddress) {
      console.warn("❗ No se puede añadir Anschluss sin dirección destino del primer viaje.");
      return;
    }

    // 🟠 Guarda el paciente 1
    setPreviousTripFormData(tripFormData);

    // 🔒 Activa protección para que se guarde solo una vez
    anschlussGuardRef.current = true;

    // 🟦 Crea nuevo paciente 2, reseteando los campos
    setTripFormData({
      date: today,
      assignmentId: assignedDay.dienstId,
      driver: assignedDay.driver._id,
      medic: assignedDay.medic._id,
      auftragNumber: "", // reseteado
      patientName: "",   // reseteado
      fromAddress: tripFormData.toAddress, // <-- esta es la recogida nueva
      toAddress: "",     // reseteado
      timeWarning: getCurrentTimeString(), // ⏰ se rellena al hacer click en Anschluss
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


  // 🟥 Función para cancelar Anschluss
  const handleCancelAnschluss = () => {
    setAnschlussActive(false);
    anschlussGuardRef.current = false; // 🔓 Desactivamos la protección

    if (previousTripFormData) {
      setTripFormData(previousTripFormData); // 🔁 Restauramos el paciente 1
      setPreviousTripFormData(null);
    }
  };



  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">📋 Mi jornada de hoy: {today}</h2>

      {isClosingDay ? (
        <div className="bg-red-100 text-red-800 p-4 rounded shadow mb-6">
          ✅ Día cerrado. No hay Dienst activo para hoy.
        </div>
      ) : !assignedDay ? (
        <div className="bg-yellow-100 text-yellow-800 p-4 rounded shadow mb-6">
          🚫 Hoy no tienes un Dienst asignado.
        </div>
      ) : !canStartWork ? (
        <div className="bg-blue-100 text-blue-800 p-4 rounded shadow mb-6">
          ⏳ Podrás registrar viajes a partir de 30 minutos antes de tu Dienst. Hora de inicio: <strong>{assignedDay.startTime}</strong>
        </div>
      ) : (
        <>
          <div className="bg-white p-4 rounded shadow mb-6 space-y-3">
            {/* 👥 Equipo asignado y ambulancia por defecto */}
            <div className="bg-gray-100 p-4 rounded shadow mb-6 flex justify-between items-start">

              {/* 👥 Equipo asignado a la izquierda */}
              {assignedDay && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">
                    ⏰ Dienst: <strong>{assignedDay.startTime}</strong> – <strong>{assignedDay.endTime}</strong>
                  </p>
                  <p className="font-semibold text-lg mb-1">Team:</p>
                  <p>🚗 {assignedDay.driver?.lastName}, {assignedDay.driver?.name}</p>
                  <p>🧑‍⚕️ {assignedDay.medic?.lastName}, {assignedDay.medic?.name}</p>
                </div>
              )}

              {/* 🚐 Ambulancia y KM a la derecha, agrupados y alineados */}
              <div className="text-right w-full max-w-xs space-y-4">

                {/* Nº de ambulancia */}
                <div>
                  <label
                    htmlFor="vehicleNumber"
                    className="block text-sm font-medium text-gray-700"
                  >
                    🚐 Nº Ambulancia
                  </label>
                  <input
                    id="vehicleNumber"
                    type="text"
                    placeholder="Ej. AMB-01"
                    title="Número identificativo de la ambulancia"
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-right bg-white"
                    disabled={vehicleConfirmed}
                  />
                </div>

                {/* KM inicial */}
                <div>
                  <label
                    htmlFor="initialAmbulanceKm"
                    className="block text-sm font-medium text-gray-700"
                  >
                    🔢 KM inicial
                  </label>
                  <input
                    id="initialAmbulanceKm"
                    type="number"
                    placeholder="Ej. 123456"
                    title="Kilometraje de la ambulancia al comenzar el día"
                    value={initialAmbulanceKm}
                    onChange={(e) => setInitialAmbulanceKm(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-right bg-white"
                    disabled={vehicleConfirmed}
                  />
                </div>

                {/* Botón confirmar (solo si aún no se confirmó) */}
                {!vehicleConfirmed && (
                  <button
                    type="button"
                    onClick={handleConfirmAmbulanceData}
                    className="mt-2 bg-green-600 text-white px-3 py-1 rounded w-full hover:bg-green-700"
                  >
                    ✅ Confirmar datos iniciales
                  </button>
                )}
              </div>

            </div>


            {vehicleConfirmed && (
              <>
                {/* 👉  FORMULARIO DE VIAJE  */}
                {/* ─────────────────────────────── */}
                {/* 1️⃣  Auftrag + Paciente (2 col) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Nº Auftrag */}
                  <div>
                    <label htmlFor="auftragNumber" className="block text-sm">
                      Número de Auftrag
                    </label>
                    <input
                      disabled={formBlocked}
                      id="auftragNumber"
                      placeholder="Ej: Krankentransport 123"
                      value={tripFormData.auftragNumber}
                      onChange={(e) =>
                        setTripFormData((prev) => ({
                          ...prev,
                          auftragNumber: e.target.value,
                        }))
                      }
                      className="w-full border rounded p-1"
                    />
                  </div>

                  {/* Nombre paciente */}
                  <div>
                    <label htmlFor="patientName" className="block text-sm">
                      Nombre del paciente
                    </label>
                    <input
                      disabled={formBlocked}
                      id="patientName"
                      placeholder="Ej: Juan Pérez"
                      value={tripFormData.patientName}
                      onChange={(e) =>
                        setTripFormData((prev) => ({
                          ...prev,
                          patientName: e.target.value,
                        }))
                      }
                      className="w-full border rounded p-1"
                    />
                  </div>
                </div>

                {/* 2️⃣  Direcciones (2 col) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {/* Origen */}
                  <div>
                    <label htmlFor="fromAddress" className="block text-sm">
                      Dirección de recogida
                    </label>
                    <input
                      disabled={formBlocked}
                      id="fromAddress"
                      placeholder="Calle Ejemplo 123"
                      value={tripFormData.fromAddress}
                      onChange={(e) =>
                        setTripFormData((prev) => ({
                          ...prev,
                          fromAddress: e.target.value,
                        }))
                      }
                      className="w-full border rounded p-1"
                    />
                  </div>

                  {/* Destino */}
                  <div>
                    <label htmlFor="toAddress" className="block text-sm">
                      Dirección de dejada
                    </label>
                    <input
                      disabled={formBlocked}
                      id="toAddress"
                      placeholder="Hospital Central, Berlín"
                      value={tripFormData.toAddress}
                      onChange={(e) =>
                        setTripFormData((prev) => ({
                          ...prev,
                          toAddress: e.target.value,
                        }))
                      }
                      className="w-full border rounded p-1"
                    />
                  </div>
                </div>


                {/* 3️⃣–5️⃣ Todos los campos de hora/KM en una sola fila */}
                <div className="grid grid-cols-1 md:grid-cols-7 gap-4 mt-4">
                  {/* Hora aviso */}
                  <div>
                    <label htmlFor="timeWarning" className="block text-sm">Aviso</label>
                    <input
                      ref={timeWarningRef}
                      disabled={formBlocked}
                      id="timeWarning"
                      type="time"
                      value={tripFormData.timeWarning}
                      onChange={(e) =>
                        setTripFormData((prev) => ({
                          ...prev,
                          timeWarning: e.target.value,
                        }))
                      }
                      onDoubleClick={() => {
                        const currentTime = getCurrentTimeString();
                        setTripFormData((prev) => ({
                          ...prev,
                          timeWarning: currentTime,
                        }));
                      }}
                      className={`w-full px-2 py-1 border rounded focus:outline-none focus:ring ${badField === "timeWarning" ? "border-red-500" : "border-gray-300"
                        }`}
                    />
                  </div>


                  {/* Hora domicilio */}
                  <div>
                    <label htmlFor="timeAtHome" className="block text-sm">Domicilio</label>
                    <input
                      ref={timeAtHomeRef}
                      disabled={formBlocked}
                      id="timeAtHome"
                      type="time"
                      value={tripFormData.timeAtHome}
                      onChange={(e) => {
                        const value = e.target.value;

                        setTripFormData((prev) => ({
                          ...prev,
                          timeAtHome: value,
                        }));

                        if (anschlussActive) {
                          setPreviousTripFormData((prev) =>
                            prev ? { ...prev, timeArrival: value } : null
                          );
                        }
                      }}

                      onDoubleClick={() => {
                        const currentTime = getCurrentTimeString();
                        setTripFormData((prev) => ({
                          ...prev,
                          timeAtHome: currentTime,
                        }));
                      }}
                      className={`w-full px-2 py-1 border rounded focus:outline-none focus:ring ${badField === "timeAtHome" ? "border-red-500" : "border-gray-300"
                        }`}
                    />
                  </div>


                  {/* KM domicilio */}
                  <div>
                    <label htmlFor="kmStart" className="block text-sm">KM dom.</label>
                    <input
                      ref={kmStartRef}
                      disabled={formBlocked}
                      id="kmStart"
                      type="number"
                      value={tripFormData.kmStart === 0 ? "" : tripFormData.kmStart}
                      onChange={(e) => {
                        const value = Number(e.target.value);

                        setTripFormData((prev) => ({
                          ...prev,
                          kmStart: value,
                        }));

                        if (anschlussActive) {
                          setPreviousTripFormData((prev) =>
                            prev ? { ...prev, kmEnd: value } : null
                          );
                        }
                      }}
                      className={`w-full px-2 py-1 border rounded focus:outline-none focus:ring ${badField === "kmStart" ? "border-red-500" : "border-gray-300"
                        }`}
                    />
                  </div>



                  {/* Hora carga */}
                  <div>
                    <label htmlFor="timePickup" className="block text-sm">Carga</label>
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

                          // ✅ 2. Si Anschluss está activo y no se ha guardado aún
                          if (anschlussActive && previousTripFormData && anschlussGuardRef.current) {
                            anschlussGuardRef.current = false; // 🛡️ Desactivamos el guardia inmediatamente

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

                      onDoubleClick={() => {
                        const currentTime = getCurrentTimeString();

                        setTripFormData((prev) => {
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
                        });
                      }}


                      className={`w-full px-2 py-1 border rounded focus:outline-none focus:ring ${badField === "timePickup" ? "border-red-500" : "border-gray-300"
                        }`}
                    />
                  </div>




                  {/* Hora destino */}
                  <div>
                    <label htmlFor="timeArrival" className="block text-sm">Destino</label>
                    <input
                      ref={timeArrivalRef}
                      disabled={formBlocked}
                      id="timeArrival"
                      type="time"
                      value={tripFormData.timeArrival}
                      onChange={(e) =>
                        setTripFormData((prev) => ({
                          ...prev,
                          timeArrival: e.target.value,
                        }))
                      }
                      onDoubleClick={() => {
                        const currentTime = getCurrentTimeString();
                        setTripFormData((prev) => ({
                          ...prev,
                          timeArrival: currentTime,
                        }));
                      }}
                      className={`w-full px-2 py-1 border rounded focus:outline-none focus:ring ${badField === "timeArrival" ? "border-red-500" : "border-gray-300"}`}
                    />
                  </div>

                  {/* KM destino */}
                  <div>
                    <label htmlFor="kmEnd" className="block text-sm">KM dest.</label>
                    <input
                      ref={kmEndRef}
                      disabled={formBlocked}
                      id="kmEnd"
                      type="number"
                      value={tripFormData.kmEnd === 0 ? "" : tripFormData.kmEnd}
                      onChange={(e) =>
                        setTripFormData((prev) => ({
                          ...prev,
                          kmEnd: Number(e.target.value),
                        }))
                      }

                      className={`w-full px-2 py-1 border rounded focus:outline-none focus:ring ${badField === "kmEnd" ? "border-red-500" : "border-gray-300"}`}
                    />
                  </div>

                  {/* Hora libre */}
                  <div>
                    <label htmlFor="timeEnd" className="block text-sm">Libre</label>
                    <input
                      ref={timeEndRef}
                      disabled={formBlocked}
                      id="timeEnd"
                      type="time"
                      value={tripFormData.timeEnd}
                      onChange={(e) =>
                        setTripFormData((prev) => ({
                          ...prev,
                          timeEnd: e.target.value,
                        }))
                      }
                      onDoubleClick={() => {
                        const currentTime = getCurrentTimeString();
                        setTripFormData((prev) => ({
                          ...prev,
                          timeEnd: currentTime,
                        }));
                      }}
                      className={`w-full px-2 py-1 border rounded focus:outline-none focus:ring ${badField === "timeEnd" ? "border-red-500" : "border-gray-300"}`}
                    />
                  </div>
                </div>


                {/* 🔄 Botón Anschluss: solo aparece si ya hay hora de carga */}
                {(tripFormData.timePickup || anschlussActive) && (
                  <div className="flex items-center mb-2 space-x-2">
                    <button
                      type="button"
                      onClick={anschlussActive ? handleCancelAnschluss : handleAddAnschluss}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold transition 
                        ${anschlussActive ? 'bg-red-500 hover:bg-red-600' : 'bg-orange-500 hover:bg-orange-600'}`}
                      title={anschlussActive ? "Cancelar Anschluss" : "Añadir Anschluss"}
                    >
                      {anschlussActive ? '✖' : '+'}
                    </button>
                    <span className="text-sm text-gray-700">
                      {anschlussActive ? "Cancelar Anschluss" : "Anschluss"}
                    </span>
                  </div>
                )}




                {/* ❌ Storno (viaje cancelado) */}
                <div className="space-y-2">
                  <div className="flex items-center mb-2 space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        setWasCancelled(!wasCancelled);
                        if (wasCancelled) setCountsTrip(1); // Resetear si se desmarca
                      }}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold transition 
                        ${wasCancelled ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-300 hover:bg-gray-400'}`}
                      title="Marcar viaje como cancelado"
                    >
                      {wasCancelled ? '✖' : '🅂'}
                    </button>
                    <span className="text-sm text-gray-700">Storno</span>
                  </div>

                  {wasCancelled && (
                    <div className="ml-6">
                      <label htmlFor="countsTrip" className="block text-sm font-medium mb-1">
                        ¿Cuenta el viaje?
                      </label>
                      <select
                        id="countsTrip"
                        value={countsTrip}
                        onChange={(e) => setCountsTrip(Number(e.target.value))}
                        className="border rounded px-2 py-1 w-full"
                      >
                        <option value={1}>✅ Sí, cuenta (1)</option>
                        <option value={0}>❌ No, no cuenta (0)</option>
                      </select>
                    </div>
                  )}
                </div>



                <div>
                  <label htmlFor="reports" className="block text-sm">Observaciones / reportes</label>
                  <textarea
                    disabled={formBlocked}
                    id="reports"
                    placeholder="Observaciones sobre el traslado"
                    title="Escribe aquí cualquier observación"
                    value={reports}
                    onChange={(e) => setReports(e.target.value)}
                    className="w-full border p-1 rounded"
                    rows={3}
                  />
                </div>

                {/* ── Mensaje de validación en caliente ─────────── */}
                {draftError && (
                  <div className="bg-red-100 text-red-700 p-2 rounded">
                    {draftError}
                  </div>
                )}


                <button
                  onClick={handleSaveTrip}
                  disabled={Boolean(draftError)}          // ⬅️  si hay error, se desactiva
                  className={`w-full py-2 px-4 rounded text-white
                ${draftError
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700"}`}
                >
                  Guardar viaje
                </button>

                <h3 className="text-xl font-semibold mb-2">🧾 Resumen de viajes</h3>
                <ul className="space-y-2">
                  {/* ---------- LISTA DE TRIPS ---------- */}
                  {trips.map((trip: Trip, idx: number) => {
                    const totalKm = trip.kmEnd - trip.kmStart;

                    /** Decide el multiplicador del viaje
                     *  1. Si countsTrip === 0  →   0 x   (viaje cancelado que NO cuenta).
                     *  2. Si countsTrip === 1  →   aplica reglas normales.
                     *     a) ≥ 20 km                      → 2 x
                     *     b) ≥ 15 km                      → 1.5 x
                     *     c) Dienst sábado/domingo que empieza entre 14 y 17 h → 1.5 x
                     *     d) resto                        → 1 x
                     *  3. Si countsTrip es undefined (viaje no cancelado) → usa sólo reglas a-d.
                     */
                    const getMultiplier = () => {
                      /* helper local: ¿turno fin-de-semana tarde? */
                      const isWeekendAfternoonShift = () => {
                        if (!assignedDay) return false;
                        const day = new Date(assignedDay.date).getDay();      // 0 = dom, 6 = sáb
                        if (day !== 0 && day !== 6) return false;
                        const [h] = assignedDay.startTime.split(":").map(Number);
                        return h >= 14 && h <= 17;
                      };

                      /* --- 0) viaje cancelado que NO cuenta --- */
                      if (trip.countsTrip === 0) return 0;

                      /* --- 1) reglas para viajes que SÍ cuentan --- */
                      // 20 km o más
                      if (totalKm >= 20) return 2;
                      // 15-19 km
                      if (totalKm >= 15) return 1.5;
                      // sábado/domingo 14-17 h
                      if (isWeekendAfternoonShift()) return 1.5;

                      // por defecto
                      return 1;
                    };

                    const multiplier = getMultiplier();


                    return (
                      <li
                        key={trip._id || idx}
                        onClick={() => handleOpenTripModal(trip)}
                        className="bg-white p-3 rounded shadow cursor-pointer hover:bg-blue-50"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-semibold">
                            {trip.auftragNumber}
                            {trip.wasCancelled && (
                              <span className="ml-2 text-red-600 font-medium">
                                (cancelado)
                              </span>
                            )}
                          </span>

                          {/* 👉 Km totales + multiplicador (0 / 1 / 1.5 / 2) */}
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
                    className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded"
                  >
                    ✅ Cerrar día y enviar resumen
                  </button>
                )}

              </>
            )}

            {!vehicleConfirmed && (
              <div className="bg-orange-100 text-orange-800 p-4 rounded">
                🚑 Introduce el <strong>nº de ambulancia</strong> y los
                <strong> KM iniciales</strong> y pulsa
                <em> “Confirmar datos iniciales” </em> para poder crear viajes.
              </div>
            )}

          </div>


          {/* --------------------------------------------------------------
    // PREGUNTA CLAVE: ¿es el final del día?
  ---------------------------------------------------------------- */}
          {showCloseQuestion && (
            <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
              <div className="bg-white p-6 rounded shadow-lg w-full max-w-sm space-y-4">
                <h4 className="text-lg font-semibold text-center">¿Es el final del día?</h4>

                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setIsFinalClosure(true);
                      setShowCloseQuestion(false);
                      setShowReviewModal(true); // Modal de REPASO total (fase 2)
                    }}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded"
                  >
                    ✅ Sí, cierre completo
                  </button>

                  <button
                    onClick={() => {
                      setIsFinalClosure(false);
                      setShowCloseQuestion(false);
                      setShowReviewModal(true); // Modal de REPASO parcial (fase 2)
                    }}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-2 rounded"
                  >
                    ⚠️ No, enviar cierre parcial
                  </button>

                  <button
                    onClick={() => setShowCloseQuestion(false)}
                    className="w-full bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 rounded"
                  >
                    Cancelar
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

      {/* ───────── Modal de CIERRE PARCIAL ───────── */}
      {showReviewModal && !isFinalClosure && assignedDay && (
        <PartialReviewModal
          trips={trips}
          assignedDay={assignedDay}
          vehicleNumber={vehicleNumber}
          initialKm={initialAmbulanceKm}
          finalKm={finalAmbulanceKm}
          onClose={() => setShowReviewModal(false)}
          onSend={handleSendPartialClosure}
        />
      )}

      {/* ───────── Modal de REVISIÓN FINAL ───────── */}
      {showReviewModal && isFinalClosure === true && assignedDay && (
        <FinalReviewModal
          isOpen={true}
          onClose={() => setShowReviewModal(false)}
          trips={trips}
          assignedDay={assignedDay}
          vehicleNumber={vehicleNumber}
          initialKm={initialAmbulanceKm}
          finalKm={finalAmbulanceKm}
          onConfirm={handleConfirmFinalClosure}
        />
      )}

    </div>
  );
};


export default MyWorkday;
