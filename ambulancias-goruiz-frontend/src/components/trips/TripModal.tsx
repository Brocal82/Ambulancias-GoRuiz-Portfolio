// frontend/src/components/trips/TripModal.tsx

import React from "react";
import type { Trip } from "../../types/trip";

interface TripModalProps {
  trip: Trip | null;
  onClose: () => void;
}

const TripModal: React.FC<TripModalProps> = ({ trip, onClose }) => {
  if (!trip) return null;

  const totalKm = trip.kmEnd - trip.kmStart;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white rounded-lg p-6 shadow-lg max-w-md w-full relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-lg"
        >
          &times;
        </button>

        <h3 className="text-xl font-bold mb-4">Detalles del viaje</h3>

        <div className="space-y-2">
          <p><strong>📝 Auftrag:</strong> {trip.auftragNumber}</p>
          <p><strong>👤 Paciente:</strong> {trip.patientName || "Sin nombre"}</p>
          <p><strong>📍 Desde:</strong> {trip.fromAddress || "Sin dirección"}</p>
          <p><strong>🏥 Hasta:</strong> {trip.toAddress || "Sin destino"}</p>
          <p><strong>⏱️ Horas:</strong> {trip.timeWarning} - {trip.timeEnd}</p>
          <p><strong>📏 KM:</strong> {trip.kmStart} → {trip.kmEnd} (Total: {totalKm} km)</p>
          <p><strong>📝 Observaciones:</strong> {trip.reports || "Sin observaciones"}</p>

          {trip.wasCancelled && (
            <p className="text-red-600 font-semibold">
              ⚠️ Este viaje fue cancelado
              {trip.cancelledAtPickup && " en punto de recogida"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TripModal;
