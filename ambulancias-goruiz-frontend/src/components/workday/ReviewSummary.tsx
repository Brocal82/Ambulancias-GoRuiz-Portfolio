// src/components/workday/ReviewSummary.tsx
import React from "react";
import type { Trip } from "../../types/trip";
import type { AssignedDayFull } from "../../types/dienst";
// ⭐ CAMBIO: importamos el helper de formato
import { formatYYYYMMDDToDDMMYYYY } from "../../utils/timeUtils";

// --- helper para mostrar nombre de usuario de forma segura ---
const formatPerson = (p: any): string => {
  if (!p) return "Usuario eliminado";
  if (typeof p === "string") return p; // por si viene un id string
  const last = p?.lastName ?? "";
  const first = p?.name ?? "";
  const full = [last, first].filter(Boolean).join(", ");
  return full || "Usuario eliminado";
};

/* ---------- helpers ---------- */
const calcTripKm = (t: Trip) => Math.max(0, t.kmEnd - t.kmStart);

const getMultiplier = (t: Trip, totalKm: number, isWeekendLate: boolean) => {
  if (t.countsTrip === 0) return 0;
  if (t.countsTrip === 1) {
    if (totalKm >= 20) return 2;
    if (totalKm >= 15 || isWeekendLate) return 1.5;
    return 1;
  }
  if (totalKm >= 20) return 2;
  if (totalKm >= 15 || isWeekendLate) return 1.5;
  return 1;
};

interface Props {
  assignedDay: AssignedDayFull;
  ambulanceNumber: string;
  initialKm: number;
  finalKm: number;
  trips: Trip[];
}

const ReviewSummary: React.FC<Props> = ({
  assignedDay,
  ambulanceNumber,
  initialKm,
  finalKm,
  trips,
}) => {
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
        <div>
          <p>
            📅 <strong>{/* ⭐ CAMBIO */}
              {formatYYYYMMDDToDDMMYYYY(assignedDay.date)}
            </strong>
          </p>
          <p>
            ⏰ {assignedDay.startTime} – {assignedDay.endTime}
          </p>
          <div>
            <p className="font-semibold">👥 Team:</p>
            <div className="ml-2 space-y-1">
              <p>{formatPerson(assignedDay.driver)}</p>
              <p>{formatPerson(assignedDay.medic)}</p>
            </div>
          </div>
        </div>

        <div className="text-right">
          <p>
            🚑 <strong>{ambulanceNumber}</strong>
          </p>
          <p>
            🔢 {initialKm} → {finalKm}
          </p>
          <p className="font-semibold">🧮 Total: {totalKmDiff} km</p>
        </div>
      </div>

      {/* -------- TABLA -------- */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-1">Auftrag</th>
              <th>Paciente</th>
              <th>📍 Recogida</th>
              <th>🎯 Destino</th>
              <th>📞 Aviso</th>
              <th>🏠 Llega domicilio</th>
              <th>Km dom.</th>
              <th>👥 Carga</th>
              <th>🏥 Llega destino</th>
              <th>Km dest.</th>
              <th>🕓 Libre</th>
              <th>Km diff</th>
              <th>Prämie</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {trips.map((t, i) => {
              const diff = calcTripKm(t);
              const mult = getMultiplier(t, diff, weekendLate);

              const isStornoThatCounts = t.wasCancelled && t.countsTrip === 1;
              const isStornoThatDoesNotCount =
                t.wasCancelled && t.countsTrip === 0;

              return (
                <React.Fragment key={i}>
                  <tr className="border-t">
                    <td
                      className={`p-1 text-center font-semibold ${
                        t.wasCancelled ? "text-red-600" : ""
                      }`}
                    >
                      {t.auftragNumber}
                    </td>
                    <td className="text-center">
                      {t.patientName || "Sin nombre"}
                    </td>
                    <td className="text-center">{t.fromAddress}</td>
                    <td className="text-center">{t.toAddress}</td>
                    <td className="text-center">{t.timeWarning}</td>
                    <td className="text-center">{t.timeAtHome}</td>
                    <td className="text-center">{t.kmStart}</td>
                    <td className="text-center">{t.timePickup}</td>
                    <td className="text-center">{t.timeArrival}</td>
                    <td className="text-center">{t.kmEnd}</td>
                    <td className="text-center">{t.timeEnd}</td>
                    <td className="text-center">{diff}</td>
                    <td className="text-center font-bold">
                      {isStornoThatDoesNotCount ? (
                        "0x"
                      ) : isStornoThatCounts ? (
                        <span className="text-green-600">{mult}x</span>
                      ) : (
                        `${mult}x`
                      )}
                    </td>
                  </tr>
                  {t.reports && t.reports.trim() !== "" && (
                    <tr className="text-[11px] text-gray-700 bg-gray-50">
                      <td colSpan={13} className="italic px-2 py-1">
                        📝 Observaciones: {t.reports}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReviewSummary;
