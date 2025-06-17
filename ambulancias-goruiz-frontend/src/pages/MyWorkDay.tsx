// frontend/src/pages/MyWorkday.tsx

import { useState, useEffect, useCallback } from "react";
import { createTrip, getTripsByDate } from "../api/trips";
import { getAssignedDaysForUser } from "../api/diensts";
import { useAuth } from "../hooks/useAuth";
import { toast } from "react-toastify";
import type { Trip, TripData } from "../types/trip";
import type { AssignedDay } from "../types/assignedDay";
import TripModal from "../components/trips/TripModal";
import { useNavigate } from "react-router-dom";
import FinalReviewModal from "../components/workday/FinalReviewModal";




const canStartTripNow = (startTime: string): boolean => {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const now = new Date();
  const start = new Date();

  start.setHours(startHour);
  start.setMinutes(startMinute - 30);
  start.setSeconds(0);

  return now >= start;
};


const MyWorkday = () => {
  const { token, user } = useAuth(); // 👈 Asegúrate de tener acceso a user._id
  const today = new Date().toISOString().split("T")[0];

  const [auftragNumber, setAuftragNumber] = useState("");
  const [patientName, setPatientName] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [timeWarning, setTimeWarning] = useState("");
  const [timeAtHome, setTimeAtHome] = useState("");
  const [timePickup, setTimePickup] = useState("");
  const [timeArrival, setTimeArrival] = useState("");
  const [timeEnd, setTimeEnd] = useState("");
  const [kmStart, setKmStart] = useState("");
  const [kmEnd, setKmEnd] = useState("");
  const [wasCancelled, setWasCancelled] = useState(false);
  const [countsTrip, setCountsTrip] = useState<number>(1);   // ✅ por defecto el viaje cuenta

  const [reports, setReports] = useState("");

  const [trips, setTrips] = useState<Trip[]>([]);
  const [assignedDay, setAssignedDay] = useState<AssignedDay | null>(null);
  const [canStartWork, setCanStartWork] = useState(false);
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [initialAmbulanceKm, setInitialAmbulanceKm] = useState("");
  const [finalAmbulanceKm, setFinalAmbulanceKm] = useState("");
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [isClosingDay, setIsClosingDay] = useState(false); // para controlar el estado del botón
  // --- NUEVOS estados para el flujo de cierre --------------------------
  const [showCloseQuestion, setShowCloseQuestion] = useState(false); // ¿Final del día?
  const [isFinalClosure, setIsFinalClosure] = useState<boolean | null>(null); // true = total | false = parcial
  const [showReviewModal, setShowReviewModal] = useState(false); // se abrirá en la fase 2


  const navigate = useNavigate();




  const handleOpenTripModal = (trip: Trip) => {
    setSelectedTrip(trip);
  };

  const handleCloseTripModal = () => {
    setSelectedTrip(null);
  };



  const fetchTrips = useCallback(async () => {
    if (!token) return;

    const closedDay = localStorage.getItem("workdayClosed");
    if (closedDay === today) {
      console.log("📵 Día ya cerrado. No se cargan viajes.");
      return;
    }

    try {
      const data = await getTripsByDate(today, token);
      setTrips(data);
    } catch (err) {
      console.error(err);
      toast.error("❌ Error al cargar los viajes del día");
    }
  }, [token, today, isClosingDay]);


  const fetchAssignedDay = useCallback(async () => {
    if (!token || !user?._id) return;
    try {
      const days = await getAssignedDaysForUser(user._id, token);
      const todayAssignment = days.find((day) => day.date === today);
      if (todayAssignment) {
        setAssignedDay(todayAssignment);
        checkStartPermission(todayAssignment);
      } else {
        setAssignedDay(null);
        setCanStartWork(false);
      }

    } catch (err) {
      console.error(err);
      toast.error("❌ Error al cargar el día asignado");
    }
  }, [token, user, today]);

  const checkStartPermission = (dienst: AssignedDay) => {
    const [startHour, startMinute] = dienst.startTime.split(':').map(Number);
    const now = new Date();
    const dienstStart = new Date();

    dienstStart.setHours(startHour);
    dienstStart.setMinutes(startMinute - 30);
    dienstStart.setSeconds(0);

    setCanStartWork(now >= dienstStart);
  };



  useEffect(() => {
    fetchTrips();
    fetchAssignedDay();
  }, [fetchTrips, fetchAssignedDay]);

  
  // Comprueba si el día ya fue cerrado (se guarda workdayClosed-YYYY-MM-DD)
  
  useEffect(() => {
    const closedDayKey = `workdayClosed-${today}`;      // 👉 clave única por fecha
    const closedFlag = localStorage.getItem(closedDayKey);

    if (closedFlag === "true") {
      setIsClosingDay(true);   // bloquea formulario
    } else {
      setIsClosingDay(false);  // permite trabajar
    }
  }, [today]);



  useEffect(() => {
    if (assignedDay && !vehicleNumber) {
      setVehicleNumber(assignedDay.vehicleNumber || "");
    }
  }, [assignedDay, vehicleNumber]);

const handleSaveTrip = async () => {
  if (!token) return;

  if (
    !auftragNumber ||
    !patientName ||
    !fromAddress ||
    !toAddress ||
    !timeWarning ||
    !timeAtHome ||
    !timePickup ||
    !timeArrival ||
    !timeEnd ||
    !kmStart ||
    !kmEnd
  ) {
    toast.warn("🚫 Por favor, rellena todos los campos obligatorios");
    return;
  }

  if (!assignedDay) {
    toast.error("❌ No tienes asignación de dienst para hoy");
    return;
  }

  if (!canStartTripNow(assignedDay.startTime)) {
    toast.error("❌ Solo puedes crear viajes 30 minutos antes del inicio del Dienst");
    return;
  }

  try {
    const newTrip: TripData = {
      date: today,
      assignmentId: assignedDay.dienstId,
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
      kmStart: Number(kmStart),
      kmEnd: Number(kmEnd),
      wasCancelled,
      countsTrip,
      reports,
    };

    const createdTrip = await createTrip(newTrip, token); // ✅ obtenemos el viaje creado
    toast.success("✅ Viaje guardado");

    // ✅ Añadir al estado para mostrarlo al instante
    setTrips((prev) => [...prev, createdTrip]);

    // ✅ Limpiar campos del formulario
    setAuftragNumber("");
    setPatientName("");
    setFromAddress("");
    setToAddress("");
    setTimeWarning("");
    setTimeAtHome("");
    setTimePickup("");
    setTimeArrival("");
    setTimeEnd("");
    setKmStart("");
    setKmEnd("");
    setWasCancelled(false);
    setCountsTrip(1);
    setReports("");

  } catch (err) {
    console.error(err);
    toast.error("❌ Error al guardar el viaje");
  }
};


  /**
   * Confirma el CIERRE DEFINITIVO del día.
   * - Envía resumen al backend
   * - Limpia estados
   * - Marca el día como cerrado en localStorage
   * - Redirige al dashboard
   */
  const handleConfirmFinalClosure = async () => {
    if (!token || !assignedDay) return;

    // validaciones mínimas
    if (!vehicleNumber || !initialAmbulanceKm || !finalAmbulanceKm) {
      toast.warn("🚐 Introduce nº de ambulancia y KM inicial/final.");
      return;
    }
    if (trips.length === 0) {
      toast.warn("🚫 No hay viajes para enviar.");
      return;
    }

    try {
      // resumen que ya usabas antes
      const totalTripKm = trips.reduce((acc, t) => acc + (t.kmEnd - t.kmStart), 0);

      const summaryData = {
        date: today,
        assignmentId: assignedDay.assignmentId,
        vehicleNumber,
        initialKm: Number(initialAmbulanceKm),
        finalKm: Number(finalAmbulanceKm),
        trips,
        totalTripKm,
      };

      await fetch("http://localhost:5000/api/workday-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(summaryData),
      });

      toast.success("✅ Día cerrado y datos enviados al admin.");

      // limpiar estados + bloqueo
      setTrips([]);
      setIsClosingDay(true);
      localStorage.setItem(`workdayClosed-${today}`, "true");

      // cerrar modal y a dashboard
      setShowReviewModal(false);
      navigate("/worker");
    } catch (err) {
      console.error("❌ Error al cerrar el día:", err);
      toast.error("❌ No se pudo cerrar el día.");
    }
  };


//   // ✅ Calcular total de KM de todos los viajes
//   const totalTripKm = trips.reduce((acc, trip) => {
//     const diff = trip.kmEnd - trip.kmStart;
//     return acc + (diff > 0 ? diff : 0);
//   }, 0);

//   try {
//     const summaryData = {
//       date: today,
//       assignmentId: assignedDay!.assignmentId,
//       vehicleNumber,
//       initialKm: Number(initialAmbulanceKm),
//       finalKm: Number(finalAmbulanceKm),
//       trips,
//       totalTripKm,
//     };

//     const response = await fetch("http://localhost:5000/api/workday-summary", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${token}`,
//       },
//       body: JSON.stringify(summaryData),
//     });

//     if (!response.ok) {
//       const errorData = await response.json();
//       throw new Error(errorData.message || "Error desconocido");
//     }

//     toast.success("✅ Día cerrado y datos enviados al admin.");
//     setTrips([]); // ✅ Borrar viajes
//     setIsClosingDay(true); // ✅ Esto elimina el warning
//     localStorage.setItem("workdayClosed", today); // 🟢 Guardar que este día fue cerra
//     navigate("/worker"); // ✅ Volver al dashboard
//   } catch (error) {
//     console.error("❌ Error al cerrar el día:", error);
//     toast.error("❌ No se pudo cerrar el día.");
//   }
// };



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
                  ⏰ Horario: <strong>{assignedDay.startTime}</strong> – <strong>{assignedDay.endTime}</strong>
                </p>
                <p className="font-semibold text-lg mb-1">👥 Equipo asignado para hoy:</p>
                <p>🚗 Conductor: {assignedDay.driver?.lastName}, {assignedDay.driver?.name}</p>
                <p>🧑‍⚕️ Sanitario: {assignedDay.medic?.lastName}, {assignedDay.medic?.name}</p>
              </div>
            )}

            {/* 🚐 Ambulancia y KM a la derecha, agrupados y alineados */}
            <div className="text-right w-full max-w-xs space-y-4">
              <div>
                <label htmlFor="vehicleNumber" className="block text-sm font-medium text-gray-700">🚐 Nº Ambulancia</label>
                <input
                  id="vehicleNumber"
                  type="text"
                  placeholder="Ej. AMB-01"
                  title="Número identificativo de la ambulancia"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-right bg-white"
                />
              </div>

              <div>
                <label htmlFor="initialAmbulanceKm" className="block text-sm font-medium text-gray-700">🔢 KM inicial</label>
                <input
                  id="initialAmbulanceKm"
                  type="number"
                  placeholder="Ej. 123456"
                  title="Kilometraje de la ambulancia al comenzar el día"
                  value={initialAmbulanceKm}
                  onChange={(e) => setInitialAmbulanceKm(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-right bg-white"
                />
              </div>

              <div>
                <label htmlFor="finalAmbulanceKm" className="block text-sm font-medium text-gray-700">🏁 KM final al regresar</label>
                <input
                  id="finalAmbulanceKm"
                  type="number"
                  value={finalAmbulanceKm}
                  onChange={(e) => setFinalAmbulanceKm(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-right bg-white"
                  placeholder="Ej. 125678"
                />
              </div>
            </div>
          </div>




          {/* 👉 Empieza aquí tu formulario normal de viajes */}
          <div>
            <label htmlFor="auftragNumber" className="block text-sm">Número de Auftrag</label>
            <input
              id="auftragNumber"
              placeholder="Ej: Krankentransport 123"
              title="Número o nombre del traslado"
              value={auftragNumber}
              onChange={(e) => setAuftragNumber(e.target.value)}
              className="w-full border p-1 rounded"
            />
          </div>


          <div>
            <label htmlFor="patientName" className="block text-sm">Nombre del paciente</label>
            <input
              id="patientName"
              placeholder="Ej: Juan Pérez"
              title="Nombre completo del paciente"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              className="w-full border p-1 rounded"
            />
          </div>

          <div>
            <label htmlFor="fromAddress" className="block text-sm">Dirección de recogida</label>
            <input
              id="fromAddress"
              placeholder="Calle Ejemplo 123"
              title="Dirección de donde se recoge al paciente"
              value={fromAddress}
              onChange={(e) => setFromAddress(e.target.value)}
              className="w-full border p-1 rounded"
            />
          </div>

          <div>
            <label htmlFor="toAddress" className="block text-sm">Dirección de dejada</label>
            <input
              id="toAddress"
              placeholder="Hospital Central, Berlín"
              title="Dirección de destino del paciente"
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              className="w-full border p-1 rounded"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="timeWarning" className="block text-sm">Hora aviso (entrada Auftrag)</label>
              <input
                id="timeWarning"
                type="time"
                title="Hora de entrada del Auftrag"
                value={timeWarning}
                onChange={(e) => setTimeWarning(e.target.value)}
                className="w-full border p-1 rounded"
              />
            </div>

            <div className="flex-1">
              <label htmlFor="timeAtHome" className="block text-sm">
                Hora llegada domicilio
              </label>
              <input
                id="timeAtHome"
                type="time"
                value={timeAtHome}
                onChange={(e) => setTimeAtHome(e.target.value)}
                className="w-full border p-1 rounded"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="kmStart" className="block text-sm">KM llegada al domicilio</label>
              <input
                id="kmStart"
                type="number"
                placeholder="Ej. 123456"
                title="Kilometraje al llegar al domicilio"
                value={kmStart}
                onChange={(e) => setKmStart(e.target.value)}
                className="w-full border p-1 rounded"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="timePickup" className="block text-sm">Hora carga paciente</label>
              <input
                id="timePickup"
                type="time"
                title="Hora en que se recoge al paciente"
                value={timePickup}
                onChange={(e) => setTimePickup(e.target.value)}
                className="w-full border p-1 rounded"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="timeArrival" className="block text-sm">Hora llegada destino</label>
              <input
                id="timeArrival"
                type="time"
                title="Hora de llegada al destino"
                value={timeArrival}
                onChange={(e) => setTimeArrival(e.target.value)}
                className="w-full border p-1 rounded"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="kmEnd" className="block text-sm">KM llegada a destino</label>
              <input
                id="kmEnd"
                type="number"
                placeholder="Ej. 123490"
                title="Kilometraje al llegar al destino"
                value={kmEnd}
                onChange={(e) => setKmEnd(e.target.value)}
                className="w-full border p-1 rounded"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="timeEnd" className="block text-sm">Hora libre (fin)</label>
              <input
                id="timeEnd"
                type="time"
                title="Hora final del traslado"
                value={timeEnd}
                onChange={(e) => setTimeEnd(e.target.value)}
                className="w-full border p-1 rounded"
              />
            </div>
          </div>

          {/* ✅ Viaje cancelado */}
          <div className="space-y-2">
            <label className="inline-flex items-center space-x-2">
              <input
                id="wasCancelled"
                type="checkbox"
                checked={wasCancelled}
                onChange={(e) => {
                  setWasCancelled(e.target.checked);
                  // Cuando se desmarca, volvemos a los valores por defecto
                  if (!e.target.checked) setCountsTrip(1);
                }}
              />
              <span>El viaje fue cancelado</span>
            </label>

            {/* Solo aparece si se marcó cancelado */}
            {wasCancelled && (
              <div className="ml-6">
                <label htmlFor="countsTrip" className="block text-sm font-medium mb-1">
                  ¿Cuenta el viaje?
                </label>
                <select
                  id="countsTrip"
                  value={countsTrip}                    // ← ya es número
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
              id="reports"
              placeholder="Observaciones sobre el traslado"
              title="Escribe aquí cualquier observación"
              value={reports}
              onChange={(e) => setReports(e.target.value)}
              className="w-full border p-1 rounded"
              rows={3}
            />
          </div>

          <button
            onClick={handleSaveTrip}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded"
          >
            Guardar viaje
          </button>
        </div>

        <h3 className="text-xl font-semibold mb-2">🧾 Resumen de viajes</h3>
        <ul className="space-y-2">
          {/* ---------- LISTA DE TRIPS ---------- */}
          {trips.map((trip: Trip, idx: number) => {
            const totalKm = trip.kmEnd - trip.kmStart;

            /** Decide el multiplicador:
             *  1) Si el viaje tiene countsTrip (0 ó 1) porque se canceló y marcaste “Cuenta / No cuenta”,
             *     usamos ese valor directamente.
             *  2) Si no, aplicamos la regla automática por kilómetros.
             */
            const getMultiplier = () => {
              if (typeof trip.countsTrip === "number") return trip.countsTrip;
              if (totalKm >= 20) return 2;
              if (totalKm >= 15) return 1.5;
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

        {!isClosingDay && (
          <button
            onClick={() => setShowCloseQuestion(true)}
            className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded"
          >
            ✅ Cerrar día y enviar resumen
          </button>
        )}


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
    {/* ───────── Modal de REVISIÓN FINAL ───────── */}
    {showReviewModal && isFinalClosure && assignedDay && (
      <FinalReviewModal
        isOpen={true}
        onClose={() => setShowReviewModal(false)}
        trips={trips}
        vehicleNumber={vehicleNumber}
        initialKm={initialAmbulanceKm}
        finalKm={finalAmbulanceKm}
        assignedDay={assignedDay}
        onConfirm={handleConfirmFinalClosure}
      />
    )}

  </div>
);
};


export default MyWorkday;



