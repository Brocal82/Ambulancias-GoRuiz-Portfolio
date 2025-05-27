import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { updateDienstPartial } from "../api/diensts";
import { getAllUsers } from "../api/users";
import type { DienstAssignment, UserRef } from "../types/dienst";

interface FlexibleAssignment extends Omit<DienstAssignment, 'driver' | 'medic'> {
  driver: string | UserRef;
  medic: string | UserRef;
}

interface AssignmentModalProps {
  isOpen: boolean;
  date: string;
  assignment?: FlexibleAssignment;
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

  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [selectedMedicId, setSelectedMedicId] = useState("");
  const [users, setUsers] = useState<UserRef[]>([]);

  useEffect(() => {
    if (assignment) {
      setStartTime(assignment.startTime);
      setEndTime(assignment.endTime);
      setVehicleNumber(assignment.vehicleNumber);
      setSelectedDriverId(
        typeof assignment.driver === "string"
          ? assignment.driver
          : assignment.driver._id
      );
      setSelectedMedicId(
        typeof assignment.medic === "string"
          ? assignment.medic
          : assignment.medic._id
      );
    }
  }, [assignment]);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!token) return;
      try {
        const data = await getAllUsers(token);
        setUsers(data);
      } catch (error) {
        console.error("Error al cargar usuarios:", error);
      }
    };

    if (isAdmin) fetchUsers();
  }, [token, isAdmin]);

  if (!isOpen || !assignment) return null;

  const handleSave = async () => {
    if (!token || !assignment) return;

    try {
      const updatedAssignment = {
        _id: assignment._id,
        date: assignment.date,
        startTime,
        endTime,
        vehicleNumber,
        driver: selectedDriverId,
        medic: selectedMedicId,
      };

      const updatedData = {
        assignments: [updatedAssignment],
      };

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

              <label htmlFor="driver" className="block text-sm font-medium">
                Conductor
              </label>
              <select
                id="driver"
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(e.target.value)}
                className="w-full border p-1 rounded"
              >
                <option value="">-- Selecciona conductor --</option>
                {users.map((user) => (
                  <option key={user._id} value={user._id}>
                    {user.name}
                  </option>
                ))}
              </select>

              <label htmlFor="medic" className="block text-sm font-medium">
                Sanitario
              </label>
              <select
                id="medic"
                value={selectedMedicId}
                onChange={(e) => setSelectedMedicId(e.target.value)}
                className="w-full border p-1 rounded"
              >
                <option value="">-- Selecciona sanitario --</option>
                {users.map((user) => (
                  <option key={user._id} value={user._id}>
                    {user.name}
                  </option>
                ))}
              </select>

              <button
                onClick={handleSave}
                className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded"
              >
                Guardar cambios
              </button>
            </>
          ) : (
            <>
              <p>🕒 {startTime} - {endTime}</p>
              <p>🚑 Vehículo: {vehicleNumber}</p>
              <p>
                👨‍✈️ Conductor:{" "}
                {typeof assignment.driver === "string"
                  ? "(ID)"
                  : assignment.driver?.name}
              </p>
              <p>
                👩‍⚕️ Sanitario:{" "}
                {typeof assignment.medic === "string"
                  ? "(ID)"
                  : assignment.medic?.name}
              </p>
            </>
          )}
        </div>

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
