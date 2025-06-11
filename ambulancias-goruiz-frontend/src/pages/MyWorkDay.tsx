// frontend/src/pages/MyWorkday.tsx

import { useState, useEffect, useCallback } from "react";
import { createTrip, getTripsByDate } from "../api/trips";
import { getAssignedDaysForUser } from "../api/diensts";
import { useAuth } from "../hooks/useAuth";
import { toast } from "react-toastify";
import type { Trip, TripData } from "../types/trip";
import type { AssignedDay } from "../types/assignedDay";




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
  const [timePickup, setTimePickup] = useState("");
  const [timeArrival, setTimeArrival] = useState("");
  const [timeEnd, setTimeEnd] = useState("");
  const [kmStart, setKmStart] = useState("");
  const [kmEnd, setKmEnd] = useState("");
  const [wasCancelled, setWasCancelled] = useState(false);
  const [cancelledAtPickup, setCancelledAtPickup] = useState(false);
  const [reports, setReports] = useState("");

  const [trips, setTrips] = useState<Trip[]>([]);
  const [assignedDay, setAssignedDay] = useState<AssignedDay | null>(null);
  const [canStartWork, setCanStartWork] = useState(false);

  const fetchTrips = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getTripsByDate(today, token);
      setTrips(data);
    } catch (err) {
      console.error(err);
      toast.error("❌ Error al cargar los viajes del día");
    }
  }, [token, today]);

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

  const handleSaveTrip = async () => {
    if (!token) return;

    if (
      !auftragNumber ||
      !patientName ||
      !fromAddress ||
      !toAddress ||
      !timeWarning ||
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
        timePickup,
        timeArrival,
        timeEnd,
        kmStart: Number(kmStart),
        kmEnd: Number(kmEnd),
        wasCancelled,
        cancelledAtPickup,
        reports,
      };

      await createTrip(newTrip, token);
      toast.success("✅ Viaje guardado");
      setAuftragNumber("");
      setPatientName("");
      setFromAddress("");
      setToAddress("");
      setTimeWarning("");
      setTimePickup("");
      setTimeArrival("");
      setTimeEnd("");
      setKmStart("");
      setKmEnd("");
      setWasCancelled(false);
      setCancelledAtPickup(false);
      setReports("");
      fetchTrips();
    } catch (err) {
      console.error(err);
      toast.error("❌ Error al guardar el viaje");
    }
  };

return (
  <div className="p-6 max-w-3xl mx-auto">
    <h2 className="text-2xl font-bold mb-4">📋 Mi jornada de hoy: {today}</h2>

    {!assignedDay ? (
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

          <div>
            <label className="inline-flex items-center space-x-2">
              <input
                id="wasCancelled"
                type="checkbox"
                checked={wasCancelled}
                onChange={(e) => setWasCancelled(e.target.checked)}
                title="Indica si el viaje fue cancelado"
              />
              <span>El viaje fue cancelado</span>
            </label>
          </div>

          <div>
            <label className="inline-flex items-center space-x-2">
              <input
                id="cancelledAtPickup"
                type="checkbox"
                checked={cancelledAtPickup}
                onChange={(e) => setCancelledAtPickup(e.target.checked)}
                disabled={!wasCancelled}
                title="Cancelado ya en punto de recogida"
              />
              <span>Cancelado ya en punto de recogida</span>
            </label>
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

        <h3 className="text-xl font-semibold mb-2">🧾 Viajes guardados hoy</h3>
        <ul className="space-y-2">
          {trips.map((trip: Trip, idx: number) => {
            const totalKm = trip.kmEnd - trip.kmStart;
            return (
              <li key={trip._id || idx} className="bg-white p-3 rounded shadow">
                <p><strong>{trip.auftragNumber}</strong> ({trip.timePickup} - {trip.timeEnd})</p>
                <p>👤 Paciente: {trip.patientName || "Sin nombre"}</p>
                <p>Dirección de recogida: {trip.fromAddress || "Sin dirección"}</p>
                <p>Destino: {trip.toAddress || "Sin destino"}</p>
                <p>KM inicio: {trip.kmStart} → KM fin: {trip.kmEnd} (Total: {totalKm} km)</p>
                <p>Reportes: {trip.reports || "Sin observaciones"}</p>
              </li>
            );
          })}
        </ul>
      </>
    )}
  </div>
)
};

export default MyWorkday;
