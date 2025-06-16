// frontend/src/components/workday/FinalReviewModal.tsx
import React from "react";
import type { Trip } from "../../types/trip";
import type { AssignedDay } from "../../types/assignedDay";   // 👈 (usa la ruta a tu tipo AssignedDay)

interface FinalReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  trips: Trip[];
  vehicleNumber: string;
  initialKm: string;
  finalKm: string;
  assignedDay: AssignedDay;
  onConfirm: () => void;
}

const FinalReviewModal: React.FC<FinalReviewModalProps> = ({
  isOpen,
  onClose,
  trips,
  vehicleNumber,
  initialKm,
  finalKm,
  assignedDay,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-3xl overflow-y-auto max-h-[90vh] space-y-6">
        <h2 className="text-xl font-bold text-center">✅ Revisión final del día</h2>

        {/* ───── Datos generales ───── */}
        <div className="space-y-1 text-sm">
          <p>
            <strong>Fecha:</strong> {assignedDay.date}
          </p>
          <p>
            <strong>Horario:</strong> {assignedDay.startTime} –{" "}
            {assignedDay.endTime}
          </p>
          <p>
            <strong>Equipo:</strong>{" "}
            {assignedDay.driver.name} {assignedDay.driver.lastName} &nbsp;|&nbsp;
            {assignedDay.medic.name} {assignedDay.medic.lastName}
          </p>
          <p>
            <strong>Ambulancia:</strong> {vehicleNumber}
          </p>
          <p>
            <strong>Kilómetros totales ambulancia:</strong> {initialKm} →{" "}
            {finalKm}
          </p>
        </div>

        {/* ───── Lista de viajes ───── */}
        <div>
          <h3 className="font-semibold mb-2">🚐 Viajes realizados ({trips.length}):</h3>
          <ul className="space-y-2">
            {trips.map((trip, idx) => (
              <li
                key={idx}
                className="border rounded p-3 text-sm space-y-1 bg-gray-50"
              >
                <p>
                  <strong>Auftrag:</strong> {trip.auftragNumber}
                  {trip.wasCancelled && (
                    <span className="ml-2 text-red-600">(cancelado)</span>
                  )}
                </p>
                <p>
                  <strong>Paciente:</strong> {trip.patientName}
                </p>
                <p>
                  <strong>Ruta:</strong> {trip.fromAddress} → {trip.toAddress}
                </p>
                <p>
                  <strong>KM:</strong> {trip.kmStart} → {trip.kmEnd}
                </p>
              </li>
            ))}
          </ul>
        </div>

        {/* ───── Botones ───── */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={onConfirm}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded"
          >
            📤 Enviar al Admin y cerrar día
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 rounded"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

export default FinalReviewModal;
