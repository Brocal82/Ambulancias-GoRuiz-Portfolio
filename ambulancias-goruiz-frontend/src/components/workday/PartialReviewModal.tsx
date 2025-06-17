import React, { useState } from "react";
import type { Trip } from "../../types/trip";
import { toast } from "react-toastify";

interface Props {
  trips: Trip[];
  onClose: () => void;
  onSend: (report: string, finalKm: number) => void; // ✅ Añadido finalKm al callback
}

const PartialReviewModal: React.FC<Props> = ({ trips, onClose, onSend }) => {
  const [report, setReport] = useState("");
  const [finalKm, setFinalKm] = useState<number | "">("");

  const handleSubmit = () => {
    if (!report.trim()) {
      toast.warn("✏️ Escribe un motivo del cierre parcial.");
      return;
    }

    if (finalKm === "" || isNaN(Number(finalKm))) {
      toast.warn("📏 Introduce los kilómetros finales.");
      return;
    }

    onSend(report.trim(), Number(finalKm)); // ✅ Enviar ambos valores
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50">
      <div className="bg-white p-6 rounded shadow max-w-2xl w-full">
        <h2 className="text-xl font-bold mb-4">📋 Cierre parcial del día</h2>
        <p className="mb-2">Resumen de los viajes enviados:</p>

        <ul className="max-h-48 overflow-y-auto border rounded p-2 text-sm mb-4">
          {trips.map((trip, i) => (
            <li key={i}>
              {trip.auftragNumber} — {trip.fromAddress} → {trip.toAddress}{" "}
              ({trip.kmStart} km → {trip.kmEnd} km)
            </li>
          ))}
        </ul>

        <textarea
          placeholder="Motivo del cierre parcial..."
          value={report}
          onChange={(e) => setReport(e.target.value)}
          className="w-full h-24 border rounded p-2 mb-4"
        />

        <input
          type="number"
          placeholder="Kilómetros finales de la ambulancia"
          value={finalKm}
          onChange={(e) => setFinalKm(e.target.value === "" ? "" : Number(e.target.value))}
          className="w-full border rounded p-2 mb-4"
        />

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded"
          >
            Enviar al Admin
          </button>
        </div>
      </div>
    </div>
  );
};

export default PartialReviewModal;
