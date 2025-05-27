import React, { useState } from "react";
import type { DienstAssignment } from "../types/dienst";
import { useAuth } from "../context/AuthContext";
import { updateDienstPartial } from "../api/diensts";

interface AssignmentModalProps {
  isOpen: boolean;
  date: string;
  assignment?: DienstAssignment;
  dienstId: string;
  onClose: () => void;
}

const AssignmentModal: React.FC<AssignmentModalProps> = ({
  isOpen,
  date,
  assignment,
  dienstId,
  onClose,
}) => {
  const { role: userRole, token } = useAuth();
  const isAdmin = userRole === "admin";

  const [startTime, setStartTime] = useState(assignment?.startTime || "");
  const [endTime, setEndTime] = useState(assignment?.endTime || "");
  const [vehicleNumber, setVehicleNumber] = useState(assignment?.vehicleNumber || "");

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!assignment || !token) return;

    const updatedAssignment: DienstAssignment = {
      _id: assignment._id,
      date: assignment.date,
      startTime,
      endTime,
      vehicleNumber,
      driver: assignment.driver, // sigue siendo objeto UserRef
      medic: assignment.medic,
    };

    try {
      const updatedData = { assignments: [updatedAssignment] };
      await updateDienstPartial(dienstId, updatedData, token);
      alert("Cambios guardados");
      onClose();
    } catch (error) {
      console.error("Error al guardar cambios:", error);
      alert("Error al guardar los cambios.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-xl shadow-lg max-w-md w-full">
        <h3 className="text-lg font-bold mb-4">Detalle del día: {date}</h3>

        {assignment ? (
          <div className="space-y-2">
            {isAdmin ? (
              <>
                <label htmlFor="startTime" className="block text-sm font-medium">
                  Hora inicio
                </label>
                <input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full border p-1 rounded"
                  placeholder="Hora de inicio"
                />

                <label htmlFor="endTime" className="block text-sm font-medium">
                  Hora fin
                </label>
                <input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full border p-1 rounded"
                  placeholder="Hora de fin"
                />

                <label htmlFor="vehicleNumber" className="block text-sm font-medium">
                  Vehículo
                </label>
                <input
                  id="vehicleNumber"
                  type="text"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  className="w-full border p-1 rounded"
                  placeholder="Número de vehículo"
                />

                <p>👨‍✈️ Conductor: {assignment.driver?.name}</p>
                <p>👩‍⚕️ Sanitario: {assignment.medic?.name}</p>

                <button
                  onClick={handleSave}
                  className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded"
                >
                  Guardar cambios
                </button>
              </>
            ) : (
              <>
                <p>🕒 {assignment.startTime} - {assignment.endTime}</p>
                <p>🚑 Vehículo: {assignment.vehicleNumber}</p>
                <p>👨‍✈️ Conductor: {assignment.driver?.name}</p>
                <p>👩‍⚕️ Sanitario: {assignment.medic?.name}</p>
              </>
            )}
          </div>
        ) : (
          <p className="text-green-700 font-semibold text-center text-xl">
            🌴 Día libre
          </p>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
};

export default AssignmentModal;
