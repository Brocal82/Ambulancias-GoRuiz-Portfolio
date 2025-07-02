//src/components/workday/ReviewSummary.tsx
import React from "react";
import type { Trip } from "../../types/trip";
import type { AssignedDayFull } from "../../types/assignedDay";

/* ---------- helpers ---------- */
const calcTripKm = (t: Trip) => Math.max(0, t.kmEnd - t.kmStart);

const getMultiplier = (t: Trip, totalKm: number, isWeekendLate: boolean) => {
  // 0-1 fijado por cancelación
  if (t.countsTrip === 0) return 0;
  if (t.countsTrip === 1) {
    if (totalKm >= 20) return 2;
    if (totalKm >= 15 || isWeekendLate) return 1.5;
    return 1;
  }
  // viajes “normales”
  if (totalKm >= 20) return 2;
  if (totalKm >= 15 || isWeekendLate) return 1.5;
  return 1;
};

interface Props {
  assignedDay: AssignedDayFull;
  vehicleNumber: string;
  initialKm: number;
  finalKm: number;
  trips: Trip[];
}

const ReviewSummary: React.FC<Props> = ({
  assignedDay,
  vehicleNumber,
  initialKm,
  finalKm,
  trips,
}) => {
  /* horario especial fin de semana 14-17 h */
  const weekendLate =
    [0, 6].includes(new Date(assignedDay.date).getDay()) &&
    (() => {
      const h = Number(assignedDay.startTime.split(":")[0] ?? 0);
      return h >= 14 && h <= 17;
    })();

  const totalKmDiff = Math.max(0, finalKm - initialKm);

  return (
    <div className="space-y-4">
      {/* -------- CABECERA -------- */}
      <div className="flex justify-between text-sm">
        {/* izquierda */}
        <div>
          <p>📅 <strong>{assignedDay.date}</strong></p>
          <p>
            ⏰ {assignedDay.startTime} – {assignedDay.endTime}
          </p>
          <p>
            👥{" "}
            {assignedDay.driver.lastName}, {assignedDay.driver.name} &nbsp;/&nbsp;
            {assignedDay.medic.lastName}, {assignedDay.medic.name}
          </p>
        </div>

        {/* derecha */}
        <div className="text-right">
          <p>🚐 <strong>{vehicleNumber}</strong></p>
          <p>🔢 {initialKm} → {finalKm}</p>
          <p className="font-semibold">🧮 Total: {totalKmDiff} km</p>
        </div>
      </div>

      {/* -------- LISTA / TABLA -------- */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-1">Auftrag</th>
              <th>Paciente</th>
              <th>Hora aviso</th>
              <th>Km dom.</th>
              <th>Km dest.</th>
              <th>Hora libre</th>
              <th>Km diff</th>
              <th>⨉</th>
            </tr>
          </thead>
          <tbody>
            {trips.map((t, i) => {
              const diff = calcTripKm(t);
              const mult = getMultiplier(t, diff, weekendLate);
              return (
                <tr key={i} className="border-t">
                  <td className={`p-1 text-center font-semibold ${t.wasCancelled ? "text-red-600" : ""}`}> {t.auftragNumber}</td>
                  <td className="text-center">{t.patientName || "Sin nombre"}</td>
                  <td className="text-center">{t.timeWarning}</td>
                  <td className="text-center">{t.kmStart}</td>
                  <td className="text-center">{t.kmEnd}</td>
                  <td className="text-center">{t.timeEnd}</td>
                  <td className="text-center">{diff}</td>
                  <td className="text-center font-bold">{mult}x</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReviewSummary;

