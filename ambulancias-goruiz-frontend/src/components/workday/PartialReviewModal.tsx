import React, { useState } from "react";
import type { Trip } from "../../types/trip";
import type { AssignedDay } from "../../types/assignedDay";
import ReviewSummary from "./ReviewSummary";
import { toast } from "react-toastify";
import { calculateEffectivePatients } from "../../utils/prämienUtils";

interface Props {
  trips: Trip[];
  assignedDay: AssignedDay;
  vehicleNumber: string;
  initialKm: string;
  finalKm: string;
  onClose: () => void;
  onSend: (report: string, finalKm: number, totalEffectivePatients: number) => void; // ✅ actualizado
}

const PartialReviewModal: React.FC<Props> = ({
  trips,
  assignedDay,
  vehicleNumber,
  initialKm,
  onClose,
  onSend,
}) => {
  const [report, setReport] = useState("");
  const [finalKm, setFinalKm] = useState<number | "">("");

  const parsedInitialKm = Number(initialKm);
  const parsedFinalKm = finalKm === "" ? 0 : Number(finalKm);

  const totalEffectivePatients = calculateEffectivePatients(trips, assignedDay.date);

  const handleSubmit = () => {
    if (!report.trim()) {
      toast.warn("✏️ Escribe un motivo del cierre parcial.");
      return;
    }

    if (finalKm === "" || isNaN(Number(finalKm))) {
      toast.warn("📏 Introduce los kilómetros finales.");
      return;
    }

    // ✅ enviamos los pacientes efectivos
    onSend(report.trim(), Number(finalKm), totalEffectivePatients);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-3xl overflow-y-auto max-h-[90vh] space-y-6">
        <h2 className="text-xl font-bold text-center">🟠 Revisión parcial del día</h2>

        {/* Reutilizamos el componente común */}
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

        <textarea
          placeholder="Motivo del cierre parcial..."
          value={report}
          onChange={(e) => setReport(e.target.value)}
          className="w-full h-24 border rounded p-2"
        />

        <input
          type="number"
          placeholder="Kilómetros finales de la ambulancia"
          value={finalKm}
          onChange={(e) =>
            setFinalKm(e.target.value === "" ? "" : Number(e.target.value))
          }
          className="w-full border rounded p-2"
        />

        <div className="flex justify-end gap-2 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-orange-500 text-white hover:bg-orange-700 rounded"
          >
            Enviar al Admin
          </button>
        </div>
      </div>
    </div>
  );
};

export default PartialReviewModal;
