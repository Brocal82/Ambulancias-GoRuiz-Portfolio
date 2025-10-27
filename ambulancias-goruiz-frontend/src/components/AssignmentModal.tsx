// frontend/src/components/AssignmentModal.tsx
import React, { useState, useEffect, useId, useMemo } from "react";
import { useAuth } from "../hooks/useAuth";
import { updateDienstPartial, removeAssignment } from "../api/diensts";
import { getAvailableUsersForDate } from "../api/users";
import { getPscheinInfo } from "../utils/pscheinUtils";
import { toastT } from "../utils/toast";
import "react-toastify/dist/ReactToastify.css";
import type { UserRef, DienstAssignment } from "../types/dienst";
import { mergeWithAssigned } from "../utils/mergeWithAssigned";
import type { FlexibleAssignment } from "../types/assignment";
import { useTranslation } from "react-i18next";
import { formatYYYYMMDDToDDMMYYYY } from '../utils/timeUtils';
import { getVacationFlagsInRange } from "../api/vacation";

interface AssignmentModalProps {
  isOpen: boolean;
  date: string;
  assignment?: FlexibleAssignment;
  dienstId: string;
  onClose: () => void;
  onUpdate: () => void;
}

type VacFlag = {
  hasVacationInRange: boolean;
  vacationStartInRange?: string; // 'YYYY-MM-DD'
  vacationUntilInRange?: string; // 'YYYY-MM-DD'
};

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

  // Dropdowns personalizados (como en Team/User modals)
  const [openDriverList, setOpenDriverList] = useState(false);
  const [openMedicList, setOpenMedicList] = useState(false);

  // Flags de vacaciones (día objetivo). Un único mapa por id de usuario.
  const [vacationFlags, setVacationFlags] = useState<Record<string, VacFlag>>({});
  const [flagsLoading, setFlagsLoading] = useState(false);

  // IDs para accesibilidad
  const driverBtnId = useId();
  const medicBtnId = useId();

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

  // Cargar ambulancias (igual que antes)
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

  // Cargar flags de vacaciones para EL DÍA especificado (fromISO=toISO=date)
  useEffect(() => {
    if (!isOpen || !token || !date) return;

    // Reunir ids de listas (drivers/medics) y también los ya seleccionados si no están en las listas
    const ids = new Set<string>();
    for (const u of availableDrivers) if (u?._id) ids.add(u._id);
    for (const u of availableMedics) if (u?._id) ids.add(u._id);
    if (selectedDriverId) ids.add(selectedDriverId);
    if (selectedMedicId) ids.add(selectedMedicId);

    const userIds = Array.from(ids);
    if (userIds.length === 0) {
      setVacationFlags({});
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setFlagsLoading(true);
        const flags = await getVacationFlagsInRange(token, {
          userIds,
          fromISO: date,
          toISO: date,
        });
        if (!cancelled) setVacationFlags(flags);
      } catch (e) {
        console.error("❌ Error al obtener flags de vacaciones (día):", e);
        if (!cancelled) setVacationFlags({});
      } finally {
        if (!cancelled) setFlagsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isOpen, token, date, availableDrivers, availableMedics, selectedDriverId, selectedMedicId]);

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

  // ===== Helpers visuales coherentes (igual que en los otros modales) =====

  const driverClass = (pschein?: string | null) => {
    if (!pschein) return '';
    const info = getPscheinInfo(pschein);
    if (info.status === 'expired') return 'text-red-600 font-medium';
    if (info.status === 'warning') return 'text-yellow-600 font-medium';
    return '';
  };

  const driverExpired = (u: UserRef) => {
    const info = getPscheinInfo((u as any)?.pscheinExpiry);
    return info.status === 'expired';
  };

  const mergeClasses = (...classes: (string | false | null | undefined)[]) =>
    classes.filter(Boolean).join(' ');

  const dimClass = 'text-slate-400';

  const fmtDDMM = (iso?: string) => {
    if (!iso) return '';
    const [, m, d] = iso.split('-');
    return `${d}/${m}`;
  };

  const userVacationInfo = (u?: UserRef | null) => {
    if (!u || !u._id) return { has: false, title: undefined as string | undefined };
    const vf = vacationFlags[u._id];
    const has = !!vf?.hasVacationInRange;
    if (!has) return { has: false, title: undefined as string | undefined };
    const from = fmtDDMM(vf?.vacationStartInRange);
    const to = fmtDDMM(vf?.vacationUntilInRange);
    const title =
      from && to
        ? `🏖️ ${t('pages.diensts.weekModals.vacations', 'Vacaciones')}: ${from} → ${to}`
        : `🏖️ ${t('pages.diensts.weekModals.vacations', 'Vacaciones')}`;
    return { has: true, title };
  };

  // Seleccionados (para pintar rótulo)
  const selectedDriver = useMemo(
    () => (availableDrivers.find(u => u._id === selectedDriverId) ||
           availableDrivers.find(u => (assignment?.driver as any)?._id === u._id) ||
           null),
    [availableDrivers, selectedDriverId, assignment]
  );
  const selectedMedic = useMemo(
    () => (availableMedics.find(u => u._id === selectedMedicId) ||
           availableMedics.find(u => (assignment?.medic as any)?._id === u._id) ||
           null),
    [availableMedics, selectedMedicId, assignment]
  );

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
              {/* Horas y ambulancia (igual) */}
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

              {/* Conductor: dropdown personalizado (coherente con Team/User) */}
              <div className="space-y-1">
                <label htmlFor={driverBtnId} className="block text-sm font-medium text-slate-700">
                  {t("pages.assignmentModal.labels.driver")}
                </label>

                <div className="relative">
                  <button
                    id={driverBtnId}
                    type="button"
                    className="w-full flex items-center justify-between rounded-xl border border-slate-300 ring-1 ring-slate-200 px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
                    onClick={() => setOpenDriverList(v => !v)}
                    aria-haspopup="listbox"
                    aria-expanded={openDriverList}
                  >
                    <span className="truncate">
                      {(() => {
                        const u = selectedDriver || (assignment?.driver as any) || null;
                        if (!u) return t("pages.assignmentModal.placeholders.selectDriver");
                        const vac = userVacationInfo(u);
                        return (
                          <span
                            className={mergeClasses(
                              driverClass((u as any)?.pscheinExpiry),
                              vac.has && dimClass
                            )}
                            title={vac.title}
                          >
                            {(u.lastName || '') + ', ' + (u.name || '')}{vac.has ? ' 🏖️' : ''}
                          </span>
                        );
                      })()}
                    </span>
                    <svg
                      className="h-4 w-4 shrink-0 text-slate-500"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>

                  {openDriverList && (
                    <div
                      role="listbox"
                      tabIndex={-1}
                      aria-label="Opciones del selector de conductor"
                      className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg ring-1 ring-slate-200"
                    >
                      {availableDrivers.length === 0 && (
                        <div className="px-3 py-2 text-sm text-slate-500">
                          {t('common.empty', 'No hay resultados')}
                        </div>
                      )}

                      {availableDrivers
                        .slice()
                        .sort((a, b) => {
                          const da = driverExpired(a) ? 1 : 0;
                          const db = driverExpired(b) ? 1 : 0;
                          if (da !== db) return da - db;
                          const ka = `${a.lastName || ''} ${a.name || ''}`.toLowerCase();
                          const kb = `${b.lastName || ''} ${b.name || ''}`.toLowerCase();
                          return ka.localeCompare(kb, 'es');
                        })
                        .map((u) => {
                          const vac = userVacationInfo(u);
                          const expired = driverExpired(u);
                          return (
                            <button
                              key={u._id}
                              role="option"
                              aria-selected={selectedDriverId === u._id}
                              onClick={() => {
                                if (expired) return;
                                setSelectedDriverId(u._id || "");
                                if (u._id === selectedMedicId) setSelectedMedicId("");
                                setOpenDriverList(false);
                              }}
                              className={mergeClasses(
                                'w-full text-left px-3 py-2 text-sm hover:bg-slate-50 focus:bg-slate-50 focus:outline-none',
                                selectedDriverId === u._id && 'bg-slate-50',
                                expired && 'opacity-50 cursor-not-allowed'
                              )}
                              title={vac.title}
                            >
                              <span
                                className={mergeClasses(
                                  driverClass((u as any)?.pscheinExpiry),
                                  vac.has && dimClass
                                )}
                              >
                                {(u.lastName || '') + ', ' + (u.name || '')}{vac.has ? ' 🏖️' : ''}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>

                {/* Leyenda para el caso driver */}
                <p className="mt-1 text-[11px] text-slate-500">
                  🚫 {t('pages.diensts.adminPage.legendCantDrive', 'No puede conducir, P-schein caducado')}
                </p>

                {/* Hint vacaciones */}
                {flagsLoading ? (
                  <p className="mt-1 text-[11px] text-slate-500">
                    {t('common.loading', 'Cargando...')}
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] text-slate-500">
                    🏖️ {t('pages.diensts.weekModals.vacationsHint', 'Pasa el ratón para ver fechas de vacaciones')}
                  </p>
                )}
              </div>

              {/* Sanitario: dropdown personalizado */}
              <div className="space-y-1">
                <label htmlFor={medicBtnId} className="block text-sm font-medium text-slate-700">
                  {t("pages.assignmentModal.labels.medic")}
                </label>

                <div className="relative">
                  <button
                    id={medicBtnId}
                    type="button"
                    className="w-full flex items-center justify-between rounded-xl border border-slate-300 ring-1 ring-slate-200 px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
                    onClick={() => setOpenMedicList(v => !v)}
                    aria-haspopup="listbox"
                    aria-expanded={openMedicList}
                  >
                    <span className="truncate">
                      {(() => {
                        const u = selectedMedic || (assignment?.medic as any) || null;
                        if (!u) return t("pages.assignmentModal.placeholders.selectMedic");
                        const vac = userVacationInfo(u);
                        return (
                          <span
                            className={mergeClasses(vac.has && dimClass)}
                            title={vac.title}
                          >
                            {(u.lastName || '') + ', ' + (u.name || '')}{vac.has ? ' 🏖️' : ''}
                          </span>
                        );
                      })()}
                    </span>
                    <svg
                      className="h-4 w-4 shrink-0 text-slate-500"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>

                  {openMedicList && (
                    <div
                      role="listbox"
                      tabIndex={-1}
                      aria-label="Opciones del selector de sanitario"
                      className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg ring-1 ring-slate-200"
                    >
                      {availableMedics.length === 0 && (
                        <div className="px-3 py-2 text-sm text-slate-500">
                          {t('common.empty', 'No hay resultados')}
                        </div>
                      )}

                      {availableMedics
                        .slice()
                        .sort((a, b) => {
                          const ka = `${a.lastName || ''} ${a.name || ''}`.toLowerCase();
                          const kb = `${b.lastName || ''} ${b.name || ''}`.toLowerCase();
                          return ka.localeCompare(kb, 'es');
                        })
                        .map((u) => {
                          const vac = userVacationInfo(u);
                          return (
                            <button
                              key={u._id}
                              role="option"
                              aria-selected={selectedMedicId === u._id}
                              onClick={() => {
                                if (u._id === selectedDriverId) setSelectedDriverId("");
                                setSelectedMedicId(u._id || "");
                                setOpenMedicList(false);
                              }}
                              className={mergeClasses(
                                'w-full text-left px-3 py-2 text-sm hover:bg-slate-50 focus:bg-slate-50 focus:outline-none',
                                selectedMedicId === u._id && 'bg-slate-50'
                              )}
                              title={vac.title}
                            >
                              <span className={mergeClasses(vac.has && dimClass)}>
                                {(u.lastName || '') + ', ' + (u.name || '')}{vac.has ? ' 🏖️' : ''}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>

                {/* Hint vacaciones */}
                {flagsLoading ? (
                  <p className="mt-1 text-[11px] text-slate-500">
                    {t('common.loading', 'Cargando...')}
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] text-slate-500">
                    🏖️ {t('pages.diensts.weekModals.vacationsHint', 'Pasa el ratón para ver fechas de vacaciones')}
                  </p>
                )}
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
