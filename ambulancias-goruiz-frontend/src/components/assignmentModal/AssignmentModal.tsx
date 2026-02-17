// frontend/src/components/AssignmentModal.tsx
import { useState, useEffect, useId, useMemo } from "react";
import { useAuth } from "../../hooks/useAuth";
import { updateDienstPartial, removeAssignment } from "../../modules/diensts";
import { toastT } from "../../utils/toast";
import {
  mergeClasses,
  dimClass,
  driverClass,
  driverExpired,
  driverPscheinTitle,
  userVacationInfo,
  userSickInfo,
} from "./utils";
import UserDropdown from "./UserDropdown";
import AmbulanceDropdown from "./AmbulanceDropdown";
import { useAvailableUsersForAssignment } from "./hooks/useAvailableUsersForAssignment";
import { useAmbulances } from "./hooks/useAmbulances";
import { useDayFlags } from "./hooks/useDayFlags";
import { buildUpdateAssignment } from "./buildUpdateAssignment";
import type { FlexibleAssignment } from "../../types/assignment";
import { useTranslation } from "react-i18next";
import {
  normalizeAmbulanceIdToString,
  toUserRefOrNull,
} from "../../modules/diensts/assignments";
import {
  formatAmbulanceLabel,
  formatPersonLabel,
} from "../../modules/diensts/utils";
import { validateAssignmentSave } from "./validation";
import { formatYYYYMMDDToDDMMYYYY } from "../../utils/timeUtils";

interface AssignmentModalProps {
  isOpen: boolean;
  date: string; // 'YYYY-MM-DD'
  assignment?: FlexibleAssignment; // ✅ tipo estable para el modal
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
  const { ambulances } = useAmbulances({ token });
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [selectedMedicId, setSelectedMedicId] = useState("");
  const { availableDrivers, availableMedics } = useAvailableUsersForAssignment({
    token,
    isAdmin,
    date,
    assignment,
    startTime,
    endTime,
    selectedDriverId,
    selectedMedicId,
  });
  const userIdsForFlags = useMemo(() => {
    const ids = new Set<string>();
    for (const u of availableDrivers) if (u?._id) ids.add(u._id);
    for (const u of availableMedics) if (u?._id) ids.add(u._id);
    if (selectedDriverId) ids.add(selectedDriverId);
    if (selectedMedicId) ids.add(selectedMedicId);
    return Array.from(ids);
  }, [availableDrivers, availableMedics, selectedDriverId, selectedMedicId]);

  const { vacationFlags, sickFlags, flagsLoading } = useDayFlags({
    isOpen,
    token,
    date,
    userIds: userIdsForFlags,
  });

  const [isLoading, setIsLoading] = useState(false);

  // Dropdowns
  const [openDriverList, setOpenDriverList] = useState(false);
  const [openMedicList, setOpenMedicList] = useState(false);
  const [openAmbulanceList, setOpenAmbulanceList] = useState(false);



  // IDs accesibilidad
  const driverBtnId = useId();
  const medicBtnId = useId();
  const ambulanceBtnId = useId();


  // Precarga del assignment
  useEffect(() => {
    if (!assignment) return;

    setStartTime(assignment.startTime || "");
    setEndTime(assignment.endTime || "");

    setAmbulanceId(normalizeAmbulanceIdToString(assignment.ambulanceId));

    setSelectedDriverId(
      typeof assignment.driver === "string"
        ? assignment.driver
        : assignment.driver?._id || "",
    );
    setSelectedMedicId(
      typeof assignment.medic === "string"
        ? assignment.medic
        : assignment.medic?._id || "",
    );
  }, [assignment]);


  if (!isOpen) return null;

  // Guardado
  const handleSave = async () => {
    if (!token) return;

    const validation = validateAssignmentSave({
      dienstId,
      startTime,
      endTime,
      selectedDriverId,
      selectedMedicId,
      sickFlags,
      vacationFlags,
    });

    if (validation) {
      if (validation.type === "error") toastT.error([validation.key]);
      else toastT.warn([validation.key]);
      return;
    }


    try {
      const updatedAssignment = buildUpdateAssignment({
        date,
        startTime,
        endTime,
        selectedDriverId,
        selectedMedicId,
        ambulanceId,
        assignment,
      });


      await updateDienstPartial(dienstId, { assignments: [updatedAssignment] }, token);
      toastT.success(["toasts.assignments.saveSuccess"]);
      onClose();
      onUpdate();
    } catch (error) {
      console.error("Error al guardar cambios:", error);
      toastT.error(["toasts.assignments.saveError"]);
    }
  };

  // Borrado
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


  const selectedDriver = useMemo(() => {
    const bySelected = availableDrivers.find((u) => u._id === selectedDriverId);
    if (bySelected) return bySelected;

    const fromAssignment = toUserRefOrNull(assignment?.driver);
    if (fromAssignment) {
      return availableDrivers.find((u) => u._id === fromAssignment._id) ?? fromAssignment;
    }
    return null;
  }, [availableDrivers, selectedDriverId, assignment]);

  const selectedMedic = useMemo(() => {
    const bySelected = availableMedics.find((u) => u._id === selectedMedicId);
    if (bySelected) return bySelected;

    const fromAssignment = toUserRefOrNull(assignment?.medic);
    if (fromAssignment) {
      return availableMedics.find((u) => u._id === fromAssignment._id) ?? fromAssignment;
    }
    return null;
  }, [availableMedics, selectedMedicId, assignment]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          {t("pages.assignmentModal.title", {
            date: formatYYYYMMDDToDDMMYYYY(date),
          })}
        </h3>

        <div className="space-y-3">
          {isAdmin ? (
            <>
              {/* Horas */}
              <div className="space-y-1">
                <label
                  htmlFor="startTime"
                  className="block text-sm font-medium text-slate-700"
                >
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
                <label
                  htmlFor="endTime"
                  className="block text-sm font-medium text-slate-700"
                >
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

              {/* Ambulancia */}
              <div className="space-y-1">
                <AmbulanceDropdown
                  label={t("pages.assignmentModal.labels.ambulance")}
                  buttonId={ambulanceBtnId}
                  isOpen={openAmbulanceList}
                  setIsOpen={setOpenAmbulanceList}
                  ambulances={ambulances}
                  selectedId={ambulanceId}
                  setSelectedId={setAmbulanceId}
                  emptyLabel={t("common.empty", "No hay resultados")}
                  placeholderLabel={t(
                    "pages.assignmentModal.placeholders.selectAmbulance",
                    "Selecciona ambulancia"
                  )}
                  unassignedLabel={t("common.none", "Ninguno")}
                />

              </div>

              {/* Conductor */}
              <UserDropdown
                label={t("pages.assignmentModal.labels.driver")}
                buttonId={driverBtnId}
                isOpen={openDriverList}
                setIsOpen={setOpenDriverList}
                selectedUser={selectedDriver}
                selectedId={selectedDriverId}
                setSelectedId={(id) => {
                  setSelectedDriverId(id);
                  if (id && id === selectedMedicId) setSelectedMedicId("");
                }}
                otherSelectedId={selectedMedicId}
                clearOtherIfSame
                availableUsers={availableDrivers}
                renderSelected={(u) => {
                  if (selectedDriverId === "") {
                    return t("pages.assignmentModal.placeholders.selectDriver", "Selecciona conductor");

                  }

                  if (!u) {
                    return t("pages.assignmentModal.placeholders.selectDriver", "Selecciona conductor");

                  }

                  const vac = userVacationInfo(u, vacationFlags, t);
                  const sick = userSickInfo(u, sickFlags, t);

                  return (
                    <>
                      <span
                        className={mergeClasses(
                          driverClass((u as any)?.pscheinExpiry),
                          (vac.has || sick.has) && dimClass,
                        )}
                        title={driverPscheinTitle(u, t)}
                      >
                        {formatPersonLabel(u)}
                      </span>

                      {vac.has && (
                        <span className="ml-1 align-middle text-slate-400" title={vac.title}>
                          🏖️
                        </span>
                      )}
                      {sick.has && (
                        <span className="ml-1 align-middle text-slate-500" title={sick.title}>
                          🤒
                        </span>
                      )}
                    </>
                  );
                }}
                renderOption={(u) => {
                  const vac = userVacationInfo(u, vacationFlags, t);
                  const sick = userSickInfo(u, sickFlags, t);

                  const isSick = sick.has;
                  const isVac = vac.has;

                  return (
                    <>
                      <span
                        className={mergeClasses(
                          driverClass((u as any)?.pscheinExpiry),
                          (isVac || isSick) && "opacity-50",
                        )}
                        title={driverPscheinTitle(u, t)}
                      >
                        {formatPersonLabel(u)}
                      </span>

                      {vac.has && (
                        <span className="ml-1 align-middle text-slate-400" title={vac.title}>
                          🏖️
                        </span>
                      )}
                      {isSick && (
                        <span className="ml-1 align-middle text-slate-500" title={sick.title}>
                          🤒
                        </span>
                      )}
                    </>
                  );
                }}
                sortFn={(a, b) => {
                  const da = driverExpired(a) ? 1 : 0;
                  const db = driverExpired(b) ? 1 : 0;
                  if (da !== db) return da - db;

                  const ka = `${a.lastName || ""} ${a.name || ""}`.toLowerCase();
                  const kb = `${b.lastName || ""} ${b.name || ""}`.toLowerCase();
                  return ka.localeCompare(kb, "es");
                }}
                isDisabled={(u) => {
                  const vac = userVacationInfo(u, vacationFlags, t);
                  const sick = userSickInfo(u, sickFlags, t);
                  const expired = driverExpired(u);
                  return expired || vac.has || sick.has;
                }}
                emptyLabel={t("common.empty", "No hay resultados")}
                unassignedLabel={t("common.none", "Ninguno")}

              />

              {flagsLoading ? (
                <p className="mt-1 text-[11px] text-slate-500">
                  {t("common.loading", "Cargando...")}
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-slate-500">
                  🏖️/🤒{" "}
                  {t(
                    "pages.diensts.weekModals.vacationsHint",
                    "Pasa el ratón por los iconos para ver fechas",
                  )}
                </p>
              )}

              {/* Sanitario */}

              <UserDropdown
                label={t("pages.assignmentModal.labels.medic")}
                buttonId={medicBtnId}
                isOpen={openMedicList}
                setIsOpen={setOpenMedicList}
                selectedUser={selectedMedic}
                selectedId={selectedMedicId}
                setSelectedId={(id) => {
                  if (id === selectedDriverId) setSelectedDriverId("");
                  setSelectedMedicId(id);
                }}
                otherSelectedId={selectedDriverId}
                clearOtherIfSame
                availableUsers={availableMedics}
                renderSelected={(u) => {
                  if (selectedMedicId === "") {
                    return t("pages.assignmentModal.placeholders.selectMedic", "Selecciona sanitario");

                  }

                  if (!u) {
                    return t("pages.assignmentModal.placeholders.selectMedic", "Selecciona sanitario");

                  }

                  const vac = userVacationInfo(u, vacationFlags, t);
                  const sick = userSickInfo(u, sickFlags, t);

                  return (
                    <>
                      <span className={(vac.has || sick.has) ? dimClass : ""}>
                        {formatPersonLabel(u)}
                      </span>
                      {vac.has && (
                        <span className="ml-1 align-middle text-slate-400" title={vac.title}>
                          🏖️
                        </span>
                      )}
                      {sick.has && (
                        <span className="ml-1 align-middle text-slate-500" title={sick.title}>
                          🤒
                        </span>
                      )}
                    </>
                  );
                }}
                renderOption={(u) => {
                  const vac = userVacationInfo(u, vacationFlags, t);
                  const sick = userSickInfo(u, sickFlags, t);
                  const isVac = vac.has;
                  const isSick = sick.has;

                  return (
                    <>
                      <span className={(isVac || isSick) ? "opacity-50" : ""}>
                        {formatPersonLabel(u)}
                      </span>
                      {vac.has && (
                        <span className="ml-1 align-middle text-slate-400" title={vac.title}>
                          🏖️
                        </span>
                      )}
                      {sick.has && (
                        <span className="ml-1 align-middle text-slate-500" title={sick.title}>
                          🤒
                        </span>
                      )}
                    </>
                  );
                }}
                sortFn={(a, b) => {
                  const ka = `${a.lastName || ""} ${a.name || ""}`.toLowerCase();
                  const kb = `${b.lastName || ""} ${b.name || ""}`.toLowerCase();
                  return ka.localeCompare(kb, "es");
                }}
                isDisabled={(u) => {
                  const vac = userVacationInfo(u, vacationFlags, t);
                  const sick = userSickInfo(u, sickFlags, t);
                  return vac.has || sick.has;
                }}
                emptyLabel={t("common.empty", "No hay resultados")}
                unassignedLabel={t("common.none", "Ninguno")}

              />

              <button
                onClick={handleSave}
                disabled={isLoading}
                className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:opacity-50"
              >
                {isLoading
                  ? t("pages.assignmentModal.buttons.saving")
                  : t("pages.assignmentModal.buttons.save")}
              </button>

              {assignment && (
                <button
                  onClick={handleDelete}
                  disabled={isLoading}
                  className="w-full rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-rose-700 focus:outline-none focus:ring-4 focus:ring-rose-100 disabled:opacity-50"
                >
                  {isLoading
                    ? t("pages.assignmentModal.buttons.deleting")
                    : t("pages.assignmentModal.buttons.deleteDay")}
                </button>
              )}
            </>
          ) : assignment ? (
            <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
              <p className="text-sm text-slate-700">
                🕒 {startTime} - {endTime}
              </p>
              <p className="text-sm text-slate-700">
                {t("pages.assignmentModal.readOnly.ambulance")}{" "}
                {formatAmbulanceLabel(assignment.ambulanceId)}
              </p>
              <p className="text-sm text-slate-700">
                {t("pages.assignmentModal.readOnly.driver")}{" "}
                {formatPersonLabel(toUserRefOrNull(assignment.driver) ?? undefined)}
              </p>
              <p className="text-sm text-slate-700">
                {t("pages.assignmentModal.readOnly.medic")}{" "}
                {formatPersonLabel(toUserRefOrNull(assignment.medic) ?? undefined)}
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
