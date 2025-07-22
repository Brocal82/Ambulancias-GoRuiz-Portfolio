import React, { useState } from "react";
import { toast } from "react-toastify";
import type { AssignedDayFull } from "../../types/dienst";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  assignedDay: AssignedDayFull;
  ambulanceId: string;
  finalKm: number;
  onSubmit: (issueData: { issueText: string }) => void;
}

const IssueReportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  assignedDay,
  ambulanceId,
  finalKm,
  onSubmit,
}) => {
  const [description, setDescription] = useState("");
  const [finalKmInput, setFinalKmInput] = useState<string>(finalKm > 0 ? finalKm.toString() : "");

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!description.trim()) {
      toast.warn("📝 Describe la avería antes de enviar.");
      return;
    }

    if (!finalKmInput.trim() || isNaN(Number(finalKmInput))) {
      toast.warn("📏 Introduce un número válido de KM finales.");
      return;
    }

    const finalKmValue = Number(finalKmInput);

    const payload = {
      dienstNumber: assignedDay.dienstNumber!,
      date: assignedDay.date,
      startTime: assignedDay.startTime,
      endTime: assignedDay.endTime,
      team: `${assignedDay.driver.lastName}, ${assignedDay.driver.name} + ${assignedDay.medic.lastName}, ${assignedDay.medic.name}`,
      ambulanceId,
      ambulanceNumber: assignedDay.ambulanceNumber || "Desconocido",
      finalKm: finalKmValue,
      timestamp: new Date().toISOString(),
      issueText: description.trim(),
      driver: assignedDay.driver._id,
      medic: assignedDay.medic._id,
    };

    try {
      const res = await fetch("/api/workday-summary/report-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      toast.success("🔧 Avería reportada correctamente.");
      onSubmit({ issueText: description.trim() });
      onClose();
    } catch (err) {
      console.error("Error al reportar avería:", err);
      toast.error("❌ No se pudo reportar la avería.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg w-full max-w-lg space-y-4">
        <h2 className="text-xl font-bold text-center">🔧 Reporte técnico de avería</h2>
        <p><strong>Dienst #</strong> {assignedDay.dienstNumber}</p>
        <p><strong>Fecha</strong> {assignedDay.date}</p>
        <p><strong>Horario</strong> {assignedDay.startTime} – {assignedDay.endTime}</p>
        <p><strong>🚗 Conductor:</strong> {assignedDay.driver.lastName}, {assignedDay.driver.name}</p>
        <p><strong>🧑‍⚕️ Sanitario:</strong> {assignedDay.medic.lastName}, {assignedDay.medic.name}</p>
        <p><strong>🚐 Ambulancia:</strong> {assignedDay.ambulanceNumber || "Desconocido"} (ID: {ambulanceId})</p>

        <div>
          <label className="block text-sm font-medium mb-1">🔢 KM finales</label>
          <input
            type="number"
            inputMode="numeric"
            value={finalKmInput}
            onChange={(e) => setFinalKmInput(e.target.value.replace(/\D/g, ""))}
            placeholder="Introduce los kilómetros finales"
            className="w-full border rounded p-2"
          />
        </div>

        <p><strong>⏱ Timestamp:</strong> {new Date().toLocaleString()}</p>

        <textarea
          placeholder="Describe la avería…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full h-32 border rounded p-2"
        />

        <div className="flex justify-end space-x-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-300 rounded">Cancelar</button>
          <button onClick={handleSend} className="px-4 py-2 bg-red-600 text-white rounded">Enviar avería</button>
        </div>
      </div>
    </div>
  );
};

export default IssueReportModal;
