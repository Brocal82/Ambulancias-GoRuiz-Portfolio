import React from "react";
import type { DienstAssignment } from "../types/dienst";

interface AssignmentModalProps {
  isOpen: boolean;
  date: string;
  assignment?: DienstAssignment;
  onClose: () => void;
}

const AssignmentModal: React.FC<AssignmentModalProps> = ({
  isOpen,
  date,
  assignment,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-xl shadow-lg max-w-md w-full">
        <h3 className="text-lg font-bold mb-4">Detalle del día: {date}</h3>

        {assignment ? (
          <>
            <p>🕒 {assignment.startTime} - {assignment.endTime}</p>
            <p>🚑 Vehículo: {assignment.vehicleNumber}</p>
            <p>👨‍✈️ Conductor: {assignment.driver?.name || "No asignado"}</p>
            <p>👩‍⚕️ Sanitario: {assignment.medic?.name || "No asignado"}</p>
          </>
        ) : (
          <p className="text-green-700 font-semibold text-center text-xl">
            🌴 Día libre
          </p>
        )}

        <button
          onClick={onClose}
          className="mt-6 w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
};

export default AssignmentModal;
