//frontend/src/components/workday/FinalReviewModal.tsx
import React, { useState } from "react";
import { toast } from "react-toastify";

import ReviewSummary from "./ReviewSummary";
import type { Trip } from "../../types/trip";
import type { AssignedDayFull } from "../../types/assignedDay";
import { calculateEffectivePatients } from "../../utils/prämienUtils";

interface FinalReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** callback ⇒ (nota del día, km finales) */
  onConfirm: (note: string, finalKm: number) => void;
  trips: Trip[];
  vehicleNumber: string;
  initialKm: string;
  finalKm: string;
  assignedDay: AssignedDayFull;
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
  const [note, setNote] = useState<string>("");

  const [finalKmLocal, setFinalKmLocal] = useState<number | "">(
    finalKm === "" ? "" : Number(finalKm)
  );

  const parsedInitialKm = Number(initialKm);
  const parsedFinalKm = finalKmLocal === "" ? 0 : Number(finalKmLocal);
  const totalEffectivePatients = calculateEffectivePatients(trips, assignedDay.date);


  if (!isOpen) return null;

  const handleSend = () => {
    if (finalKmLocal === "" || isNaN(Number(finalKmLocal))) {
      toast.warn("📏 Introduce los kilómetros finales.");
      return;
    }
    // 👇 Aquí mandamos la nota como argumento a MyWorkDay.tsx
    onConfirm(note.trim(), Number(finalKmLocal));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-3xl overflow-y-auto max-h-[90vh] space-y-6">

        <h2 className="text-xl font-bold text-center">✅ Revisión final del día</h2>

        <ReviewSummary
          assignedDay={assignedDay}
          vehicleNumber={vehicleNumber}
          initialKm={parsedInitialKm}
          finalKm={parsedFinalKm}
          trips={trips}
        />

        <p className="text-center font-semibold text-green-700">
          Total de pacientes (con multiplicadores): {totalEffectivePatients}
        </p>


        {/* ✅ CAMBIO: placeholder más claro */}
        <textarea
          placeholder="Motivo del cierre final (opcional)…"
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
