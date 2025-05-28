import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { updateDienstPartial, removeAssignment } from "../api/diensts";
import { getAvailableUsersForDate } from "../api/users";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import type { UserRef, UpdateAssignment } from "../types/dienst";
import { mergeWithAssigned } from "../utils/mergeWithAssigned";
import type { FlexibleAssignment } from "../types/assignment";

interface AssignmentModalProps {
  isOpen: boolean;
  date: string;
  assignment?: FlexibleAssignment;
  dienstId: string;
  onClose: () => void;
  onUpdate: () => void;
}

const AssignmentModal: React.FC<AssignmentModalProps> = ({
  isOpen,
  date,
  assignment,
  dienstId,
  onClose,
  onUpdate,
}) => {
  const { role: userRole, token } = useAuth();
  const isAdmin = userRole === "admin";

  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [selectedMedicId, setSelectedMedicId] = useState("");
  const [users, setUsers] = useState<UserRef[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (assignment) {
      setStartTime(assignment.startTime);
      setEndTime(assignment.endTime);
      setVehicleNumber(assignment.vehicleNumber);
      setSelectedDriverId(
        typeof assignment.driver === "string"
          ? assignment.driver
          : assignment.driver?._id || ""
      );
      setSelectedMedicId(
        typeof assignment.medic === "string"
          ? assignment.medic
          : assignment.medic?._id || ""
      );
    }
  }, [assignment]);

  useEffect(() => {
    const fetchAvailableUsers = async () => {
      if (!token || !isAdmin || !date) return;

      try {
        const availableUsers = await getAvailableUsersForDate(date, token);
        const merged = mergeWithAssigned(availableUsers, assignment);
        setUsers(merged);
      } catch (error) {
        console.error("Error al cargar usuarios disponibles:", error);
        toast.error("❌ Error al cargar usuarios.");
      }
    };

    fetchAvailableUsers();
  }, [token, isAdmin, date, assignment]);

  if (!isOpen) return null;

const handleSave = async () => {
  if (!token) return;

  // Validación mínima: deben estar definidas las horas
if (!startTime || !endTime || !vehicleNumber) {
  toast.warn("🚫 Debes rellenar hora de inicio, fin y vehículo.");
  return;
}

if (
  selectedDriverId &&
  selectedMedicId &&
  selectedDriverId === selectedMedicId
) {
  toast.warn("🚫 No puedes asignar a la misma persona como conductor y sanitario.");
  return;
}


  try {
    const updatedAssignment: UpdateAssignment = {
      date,
      startTime,
      endTime,
      vehicleNumber,
      driver: selectedDriverId,
      medic: selectedMedicId,
    };

    if (assignment?._id) {
      updatedAssignment._id = assignment._id;
    }

    const updatedData = {
      assignments: [updatedAssignment],
    };

    await updateDienstPartial(dienstId, updatedData, token);
    toast.success("✅ Cambios guardados correctamente");
    onClose();
    onUpdate();
  } catch (error) {
    console.error("Error al guardar cambios:", error);
    toast.error("❌ Error al guardar los cambios.");
  }
};


  const handleDelete = async () => {
    if (!token || !assignment) return;
    const confirmed = confirm("¿Estás seguro de eliminar este día del Dienst?");
    if (!confirmed) return;

    setIsLoading(true);
    try {
      await removeAssignment(dienstId, assignment.date, token);
      toast.success("✅ Día eliminado (ahora es libre)");
      onClose();
      onUpdate();
    } catch (error) {
      console.error("Error al eliminar el assignment:", error);
      toast.error("❌ Error al eliminar el assignment.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-xl shadow-lg max-w-md w-full">
        <h3 className="text-lg font-bold mb-4">Detalle del día: {date}</h3>

        <div className="space-y-2">
          {isAdmin ? (
            <>
              <label htmlFor="startTime" className="block text-sm font-medium">Hora inicio</label>
              <input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full border p-1 rounded"
              />

              <label htmlFor="endTime" className="block text-sm font-medium">Hora fin</label>
              <input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full border p-1 rounded"
              />

              <label htmlFor="vehicleNumber" className="block text-sm font-medium">Vehículo</label>
              <input
                id="vehicleNumber"
                type="text"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                className="w-full border p-1 rounded"
              />

              <label htmlFor="driver" className="block text-sm font-medium">Conductor</label>
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

              <label htmlFor="medic" className="block text-sm font-medium">Sanitario</label>
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
                disabled={isLoading}
                className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded"
              >
                {isLoading ? "Guardando..." : "Guardar cambios"}
              </button>

              {assignment && (
                <button
                  onClick={handleDelete}
                  disabled={isLoading}
                  className="mt-2 w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded"
                >
                  {isLoading ? "Eliminando..." : "Eliminar este día (hacer libre)"}
                </button>
              )}
            </>
          ) : assignment ? (
            <>
              <p>🕒 {startTime} - {endTime}</p>
              <p>🚑 Vehículo: {vehicleNumber}</p>
              <p>👨‍✈️ Conductor: {typeof assignment.driver === "string" ? "(ID)" : assignment.driver?.name}</p>
              <p>👩‍⚕️ Sanitario: {typeof assignment.medic === "string" ? "(ID)" : assignment.medic?.name}</p>
            </>
          ) : (
            <p className="text-green-700 font-semibold text-center text-xl">🌴 Día libre</p>
          )}
        </div>

        <button
          onClick={onClose}
          disabled={isLoading}
          className="mt-4 w-full bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
};

export default AssignmentModal;
