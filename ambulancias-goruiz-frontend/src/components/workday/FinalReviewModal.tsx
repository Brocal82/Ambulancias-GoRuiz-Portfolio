import React, { useState } from "react";
import { toast } from "react-toastify";

import ReviewSummary from "./ReviewSummary";
import type { Trip } from "../../types/trip";
import type { AssignedDay } from "../../types/assignedDay";

interface FinalReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** callback ⇒ (nota del día, km finales) */
  onConfirm: (note: string, finalKm: number) => void;
  trips: Trip[];
  vehicleNumber: string;
  initialKm: string;
  finalKm: string;
  assignedDay: AssignedDay;
}

const FinalReviewModal: React.FC<FinalReviewModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  trips,
  vehicleNumber,
  initialKm,
  finalKm,
  assignedDay,
}) => {
  /* ---------- hooks: SIEMPRE antes de returns condicionales ---------- */
  const [note, setNote] = useState<string>("");

  // si finalKm llega vacío ⇒ "", si no conviértelo a número
  const [finalKmLocal, setFinalKmLocal] = useState<number | "">(
    finalKm === "" ? "" : Number(finalKm)
  );

  /* ---------- valores numéricos seguros ---------- */
  const parsedInitialKm = Number(initialKm);
  const parsedFinalKm   = finalKmLocal === "" ? 0 : Number(finalKmLocal);

  /* ---------- early-return DESPUÉS de declarar hooks ---------- */
  if (!isOpen) return null;

  /* ---------- envío al admin ---------- */
  const handleSend = () => {
    if (finalKmLocal === "" || isNaN(Number(finalKmLocal))) {
      toast.warn("📏 Introduce los kilómetros finales.");
      return;
    }
    onConfirm(note.trim(), Number(finalKmLocal));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-3xl overflow-y-auto max-h-[90vh] space-y-6">

        {/* ✔️ Título con círculo naranja */}
        <h2 className="text-xl font-bold text-center">✅ Revisión final del día</h2>

        {/* ───── Resumen cabecera + viajes ───── */}
        <ReviewSummary
          assignedDay={assignedDay}
          vehicleNumber={vehicleNumber}
          initialKm={parsedInitialKm}
          finalKm={parsedFinalKm}
          trips={trips}
        />

        {/* ───── Notas extra + KM finales ───── */}
        <textarea
          placeholder="Notas del día (opcional)…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full h-24 border rounded p-2"
        />

        <input
          type="number"
          placeholder="Kilómetros finales de la ambulancia"
          value={finalKmLocal}
          onChange={(e) =>
            setFinalKmLocal(
              e.target.value === "" ? "" : Number(e.target.value)
            )
          }
          className="w-full border rounded p-2 mt-2"
        />

        {/* ───── Botones — mismos estilos que modal parcial ───── */}
        <div className="flex justify-end gap-2 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded"
          >
            Cancelar
          </button>

          <button
            onClick={handleSend}
            className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded"
          >
            Enviar al Admin
          </button>
        </div>
      </div>
    </div>
  );
};

export default FinalReviewModal;
