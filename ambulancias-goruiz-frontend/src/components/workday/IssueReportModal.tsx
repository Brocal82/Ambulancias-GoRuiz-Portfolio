import React, { useState } from "react";
import type { AssignedDayFull } from "../../types/assignedDay";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  assignedDay: AssignedDayFull;
  vehicleNumber: string;
  ambulanceId: string;
  finalKm: number;
  onSubmit: (data: {
    dienstNumber: number;
    date: string;
    startTime: string;
    endTime: string;
    team: string;
    vehicleNumber: string;
    ambulanceId: string;
    finalKm: number;
    timestamp: string;
    issueText: string;
  }) => Promise<void>;
}

const IssueReportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  assignedDay,
  vehicleNumber,
  ambulanceId,
  finalKm,
  onSubmit,
}) => {
  const [description, setDescription] = useState("");

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!description.trim()) return;
    await onSubmit({
      dienstNumber: assignedDay.dienstNumber!,
      date: assignedDay.date,
      startTime: assignedDay.startTime,
      endTime: assignedDay.endTime,
      team: `${assignedDay.driver.lastName}, ${assignedDay.driver.name} + ${assignedDay.medic.lastName}, ${assignedDay.medic.name}`,
      vehicleNumber,
      ambulanceId,
      finalKm,
      timestamp: new Date().toISOString(),
      issueText: description.trim(),
    });
    onClose();
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
        <p><strong>🚐 Ambulancia</strong> {vehicleNumber} (ID: {ambulanceId})</p>
        <p><strong>Km finales</strong> {finalKm}</p>
        <p><strong>⏱ Timestamp</strong> {new Date().toLocaleString()}</p>
        <textarea
          placeholder="Describe la avería…"
          value={description}
          onChange={e => setDescription(e.target.value)}
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
