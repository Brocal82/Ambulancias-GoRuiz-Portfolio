// frontend/src/components/AssignmentModal.tsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { updateDienstPartial, removeAssignment } from "../api/diensts";
import { getAvailableUsersForDate } from "../api/users";
import { getPscheinStatus } from "../utils/pscheinUtils";
import { toastT } from "../utils/toast";
import "react-toastify/dist/ReactToastify.css";
import type { UserRef, DienstAssignment } from "../types/dienst";
import { mergeWithAssigned } from "../utils/mergeWithAssigned";
import type { FlexibleAssignment } from "../types/assignment";
import { useTranslation } from "react-i18next";
import { formatYYYYMMDDToDDMMYYYY } from '../utils/timeUtils';

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
  const { t } = useTranslation();

  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [ambulanceId, setAmbulanceId] = useState("");
  const [ambulances, setAmbulances] = useState<{ _id: string; ambulanceNumber: string }[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [selectedMedicId, setSelectedMedicId] = useState("");
  const [availableDrivers, setAvailableDrivers] = useState<UserRef[]>([]);
  const [availableMedics, setAvailableMedics] = useState<UserRef[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (assignment) {
      setStartTime(assignment.startTime);
      setEndTime(assignment.endTime);

      if (typeof assignment.ambulanceId === "string") {
        setAmbulanceId(assignment.ambulanceId);
      } else if (assignment.ambulanceId && typeof assignment.ambulanceId === "object") {
        setAmbulanceId(assignment.ambulanceId._id);
      } else {
        setAmbulanceId(""); // fallback
      }

      setSelectedDriverId(
        typeof assignment.driver === "string" ? assignment.driver : assignment.driver?._id || ""
      );
      setSelectedMedicId(
        typeof assignment.medic === "string" ? assignment.medic : assignment.medic?._id || ""
      );
    }
  }, [assignment]);

  useEffect(() => {
    const fetchAvailableUsers = async () => {
      if (!token || !isAdmin || !date) return;
      try {
        const [drivers, medics] = await Promise.all([
          getAvailableUsersForDate(date, "driver", token),
          getAvailableUsersForDate(date, "medic", token),
        ]);

        setAvailableDrivers(mergeWithAssigned(drivers, assignment, "driver"));
        setAvailableMedics(mergeWithAssigned(medics, assignment, "medic"));
      } catch (error) {
        console.error("Error al cargar usuarios disponibles:", error);
        toastT.error(["toasts.assignments.loadUsersError"]);
      }
    };

    fetchAvailableUsers();
  }, [token, isAdmin, date, assignment, t]);

  useEffect(() => {
    const fetchAmbulances = async () => {
      if (!token) return;
      try {
        const response = await fetch("/api/ambulances", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        setAmbulances(data);
      } catch (error) {
        console.error("❌ Error al cargar ambulancias:", error);
        toastT.error(["toasts.assignments.loadAmbulancesError"]);
      }
    };

    fetchAmbulances();
  }, [token, t]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!token) return;

    if (!dienstId) {
      toastT.error(["toasts.assignments.missingDienstId"]);
      return;
    }

    if (!startTime || !endTime || !ambulanceId) {
      toastT.warn(["toasts.assignments.missingFields"]);
      return;
    }

    if (selectedDriverId && selectedMedicId && selectedDriverId === selectedMedicId) {
      toastT.warn(["toasts.assignments.samePerson"]);
      return;
    }

    try {
      const updatedAssignment: DienstAssignment = {
        _id: assignment?._id || "",
        date,
        startTime,
        endTime,
        ambulanceId,
        driver: selectedDriverId,
        medic: selectedMedicId,
      };

      await updateDienstPartial(dienstId, { assignments: [updatedAssignment] }, token);
      toastT.success(["toasts.assignments.saveSuccess"]);
      onClose();
      onUpdate();
    } catch (error) {
      console.error("Error al guardar cambios:", error);
      toastT.error(["toasts.assignments.saveError"]);
    }
  };

  const handleDelete = async () => {
    if (!token || !assignment) return;
    const confirmed = confirm(t("pages.assignmentModal.confirm.delete"));
    if (!confirmed) return;

    setIsLoading(true);
    try {
      await removeAssignment(dienstId, assignment.date, token);
      toastT.success(["toasts.assignments.deleteSuccess"]);
      onClose();
      onUpdate();
    } catch (error) {
      console.error("Error al eliminar assignment:", error);
      toastT.error(["toasts.assignments.deleteError"]);
    } finally {
      setIsLoading(false);
    }
  };

return (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    {/* Backdrop */}
    <div className="fixed inset-0 bg-black/50" onClick={onClose} />

    {/* Card */}
    <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">
        {t("pages.assignmentModal.title", { date: formatYYYYMMDDToDDMMYYYY(date) })}
      </h3>

      <div className="space-y-3">
        {isAdmin ? (
          <>
            <div className="space-y-1">
              <label htmlFor="startTime" className="block text-sm font-medium text-slate-700">
                {t("pages.assignmentModal.labels.startTime")}
              </label>
              <input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-xl border border-slate-300 ring-1 ring-slate-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="endTime" className="block text-sm font-medium text-slate-700">
                {t("pages.assignmentModal.labels.endTime")}
              </label>
              <input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-xl border border-slate-300 ring-1 ring-slate-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="ambulanceId" className="block text-sm font-medium text-slate-700">
                {t("pages.assignmentModal.labels.ambulance")}
              </label>
              <select
                id="ambulanceId"
                value={ambulanceId}
                onChange={(e) => setAmbulanceId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 ring-1 ring-slate-200 px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
              >
                <option value="">{t("pages.assignmentModal.placeholders.selectAmbulance")}</option>
                {ambulances.map((amb) => (
                  <option key={amb._id} value={amb._id}>
                    {amb.ambulanceNumber}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="driverSelect" className="block text-sm font-medium text-slate-700">
                {t("pages.assignmentModal.labels.driver")}
              </label>
              <select
                id="driverSelect"
                title={t("pages.assignmentModal.placeholders.selectDriver")}
                value={selectedDriverId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedDriverId(id);
                  if (id === selectedMedicId) setSelectedMedicId("");
                }}
                className="w-full rounded-xl border border-slate-300 ring-1 ring-slate-200 px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
              >
                <option value="">{t("pages.assignmentModal.placeholders.selectDriver")}</option>
                {availableDrivers.map((user) => {
                  const status = getPscheinStatus(user.pscheinExpiry);
                  const icon = status === "warning" ? " ⚠️" : status === "expired" ? " ❌" : "";
                  return (
                    <option key={user._id} value={user._id} disabled={status === "expired"}>
                      {user.lastName}, {user.name}{icon}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="medicSelect" className="block text-sm font-medium text-slate-700">
                {t("pages.assignmentModal.labels.medic")}
              </label>
              <select
                id="medicSelect"
                title={t("pages.assignmentModal.placeholders.selectMedic")}
                value={selectedMedicId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedMedicId(id);
                  if (id === selectedDriverId) setSelectedDriverId("");
                }}
                className="w-full rounded-xl border border-slate-300 ring-1 ring-slate-200 px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
              >
                <option value="">{t("pages.assignmentModal.placeholders.selectMedic")}</option>
                {availableMedics.map((user) => (
                  <option key={user._id} value={user._id}>
                    {user.lastName}, {user.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleSave}
              disabled={isLoading}
              className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:opacity-50"
            >
              {isLoading ? t("pages.assignmentModal.buttons.saving") : t("pages.assignmentModal.buttons.save")}
            </button>

            {assignment && (
              <button
                onClick={handleDelete}
                disabled={isLoading}
                className="w-full rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-rose-700 focus:outline-none focus:ring-4 focus:ring-rose-100 disabled:opacity-50"
              >
                {isLoading ? t("pages.assignmentModal.buttons.deleting") : t("pages.assignmentModal.buttons.deleteDay")}
              </button>
            )}
          </>
        ) : assignment ? (
          <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
            <p className="text-sm text-slate-700">🕒 {startTime} - {endTime}</p>
            <p className="text-sm text-slate-700">
              {t("pages.assignmentModal.readOnly.ambulance")}{' '}
              {typeof assignment?.ambulanceId === "object"
                ? assignment.ambulanceId?.ambulanceNumber ?? t("pages.assignmentModal.info.dash")
                : assignment?.ambulanceNumber ?? t("pages.assignmentModal.info.dash")}
            </p>
            <p className="text-sm text-slate-700">
              {t("pages.assignmentModal.readOnly.driver")}{' '}
              {typeof assignment.driver === "object"
                ? `${assignment.driver.lastName}, ${assignment.driver.name}`
                : "(ID)"}
            </p>
            <p className="text-sm text-slate-700">
              {t("pages.assignmentModal.readOnly.medic")}{' '}
              {typeof assignment.medic === "object"
                ? `${assignment.medic.lastName}, ${assignment.medic.name}`
                : "(ID)"}
            </p>
          </div>
        ) : (
          <p className="text-emerald-700 font-semibold text-center text-base">
            {t("pages.assignmentModal.info.dayOff")}
          </p>
        )}
      </div>

      <button
        onClick={onClose}
        disabled={isLoading}
        className="mt-4 w-full rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-300 focus:outline-none focus:ring-4 focus:ring-slate-100 disabled:opacity-50"
      >
        {t("pages.assignmentModal.buttons.close")}
      </button>
    </div>
  </div>
);

};

export default AssignmentModal;
