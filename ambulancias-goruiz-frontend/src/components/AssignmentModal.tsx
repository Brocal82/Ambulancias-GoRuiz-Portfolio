// frontend/src/components/AssignmentModal.tsx
import React, { useState, useEffect, useId, useMemo } from "react";
import { useAuth } from "../hooks/useAuth";
import { updateDienstPartial, removeAssignment } from "../modules/diensts";
import { UsersApi } from "../modules/users";

import { getPscheinInfo, getPscheinWarningTitle } from "../utils/pscheinUtils";
import { toastT } from "../utils/toast";
import "react-toastify/dist/ReactToastify.css";
import type {
  UserRef,
  UpdateAssignment,
  FlexibleAssignment,
} from "../modules/diensts";

import { mergeWithAssigned } from "../utils/mergeWithAssigned";
import { useTranslation } from "react-i18next";
import { formatYYYYMMDDToDDMMYYYY, fmtDDMM } from "../utils/timeUtils";
import { getVacationFlagsInRange, type VacFlag } from "../api/vacation";
import { getSickFlagsInRange, type SickFlag } from "../api/sickLeaves";

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
  const [ambulances, setAmbulances] = useState<
    { _id: string; ambulanceNumber: string }[]
  >([]);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [selectedMedicId, setSelectedMedicId] = useState("");
  const [availableDrivers, setAvailableDrivers] = useState<UserRef[]>([]);
  const [availableMedics, setAvailableMedics] = useState<UserRef[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Dropdowns
  const [openDriverList, setOpenDriverList] = useState(false);
  const [openMedicList, setOpenMedicList] = useState(false);

  // Flags (día objetivo)
  const [vacationFlags, setVacationFlags] = useState<Record<string, VacFlag>>(
    {},
  );
  const [sickFlags, setSickFlags] = useState<Record<string, SickFlag>>({});
  const [flagsLoading, setFlagsLoading] = useState(false);

  // IDs accesibilidad
  const driverBtnId = useId();
  const medicBtnId = useId();

  // Precarga del assignment
  useEffect(() => {
    if (assignment) {
      setStartTime(assignment.startTime);
      setEndTime(assignment.endTime);

      if (typeof assignment.ambulanceId === "string") {
        setAmbulanceId(assignment.ambulanceId);
      } else if (
        assignment.ambulanceId &&
        typeof assignment.ambulanceId === "object"
      ) {
        setAmbulanceId(assignment.ambulanceId._id);
      } else {
        setAmbulanceId("");
      }

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
    }
  }, [assignment]);

  // Si el seleccionado viene como id y no está en la lista, lo traemos e inyectamos
  const ensureSelectedPresent = async (
    list: UserRef[],
    selectedId: string | undefined,
    token: string,
  ): Promise<UserRef[]> => {
    if (!selectedId) return list;
    if (list.some((u) => u._id === selectedId)) return list;

    try {
      const u = await UsersApi.getUserById(token, selectedId);
      const asRef: UserRef = {
        _id: u._id,
        name: u.name,
        lastName: u.lastName,
        ambulanceRole: u.ambulanceRole,
        pscheinExpiry: u.pscheinExpiry,
      };
      return [asRef, ...list];
    } catch {
      return list;
    }
  };

  // Cargar disponibles (incluyendo conductores con P-Schein caducado) y fusionar con asignado
  useEffect(() => {
    const fetchAvailableUsers = async () => {
      if (!token || !isAdmin || !date) return;
      try {
        const commonOpts = { startTime, endTime, includeExpired: true }; // <- clave

        const [drivers, medics] = await Promise.all([
          UsersApi.getAvailableUsersForDate(date, "driver", token, commonOpts),
          UsersApi.getAvailableUsersForDate(date, "medic", token, {
            startTime,
            endTime,
          }),
        ]);

        let drv = mergeWithAssigned(drivers, assignment, "driver");
        let med = mergeWithAssigned(medics, assignment, "medic");

        const driverIdFromAssignment =
          typeof assignment?.driver === "string"
            ? assignment?.driver
            : undefined;
        const medicIdFromAssignment =
          typeof assignment?.medic === "string" ? assignment?.medic : undefined;

        drv = await ensureSelectedPresent(
          drv,
          driverIdFromAssignment ?? selectedDriverId,
          token,
        );
        med = await ensureSelectedPresent(
          med,
          medicIdFromAssignment ?? selectedMedicId,
          token,
        );

        setAvailableDrivers(drv);
        setAvailableMedics(med);
      } catch (error) {
        console.error("Error al cargar usuarios disponibles:", error);
        toastT.error(["toasts.assignments.loadUsersError"]);
      }
    };

    fetchAvailableUsers();
  }, [
    token,
    isAdmin,
    date,
    assignment,
    startTime,
    endTime,
    selectedDriverId,
    selectedMedicId,
    t,
  ]);

  // Cargar ambulancias
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

  // Flags del día (vacaciones/bajas) para tooltips FULL
  useEffect(() => {
    if (!isOpen || !token || !date) return;

    const ids = new Set<string>();
    for (const u of availableDrivers) if (u?._id) ids.add(u._id);
    for (const u of availableMedics) if (u?._id) ids.add(u._id);
    if (selectedDriverId) ids.add(selectedDriverId);
    if (selectedMedicId) ids.add(selectedMedicId);

    const userIds = Array.from(ids);
    if (userIds.length === 0) {
      setVacationFlags({});
      setSickFlags({});
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setFlagsLoading(true);
        const vacPromise = getVacationFlagsInRange(token, {
          userIds,
          fromISO: date,
          toISO: date,
          includeFullSpan: true,
        });
        const sickPromise = getSickFlagsInRange({
          userIds,
          fromISO: date,
          toISO: date,
          includeFullSpan: true,
        });

        const [vacFlags, sickFlagsRes] = await Promise.all([
          vacPromise,
          sickPromise,
        ]);
        if (!cancelled) {
          setVacationFlags(vacFlags);
          setSickFlags(sickFlagsRes);
        }
      } catch (e) {
        console.error("❌ Error al obtener flags (día):", e);
        if (!cancelled) {
          setVacationFlags({});
          setSickFlags({});
        }
      } finally {
        if (!cancelled) setFlagsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    token,
    date,
    availableDrivers,
    availableMedics,
    selectedDriverId,
    selectedMedicId,
  ]);

  if (!isOpen) return null;

  // Guardado
  const handleSave = async () => {
    if (!token) return;

    if (!dienstId) {
      toastT.error(["toasts.assignments.missingDienstId"]);
      return;
    }
    if (!startTime || !endTime) {
      toastT.warn(["toasts.assignments.missingFields"]);
      return;
    }
    if (
      selectedDriverId &&
      selectedMedicId &&
      selectedDriverId === selectedMedicId
    ) {
      toastT.warn(["toasts.assignments.samePerson"]);
      return;
    }
    // bloqueo por baja
    if (selectedDriverId && sickFlags[selectedDriverId]?.hasSickInRange) {
      toastT.warn(["toasts.assignments.userSickDriver"]);
      return;
    }
    if (selectedMedicId && sickFlags[selectedMedicId]?.hasSickInRange) {
      toastT.warn(["toasts.assignments.userSickMedic"]);
      return;
    }
    // ⛔ No permitir guardar si alguno está de VACACIONES ese día (seguridad)
    if (
      selectedDriverId &&
      vacationFlags[selectedDriverId]?.hasVacationInRange
    ) {
      toastT.warn(["toasts.assignments.userOnVacationDriver"]);
      return;
    }
    if (selectedMedicId && vacationFlags[selectedMedicId]?.hasVacationInRange) {
      toastT.warn(["toasts.assignments.userOnVacationMedic"]);
      return;
    }

    try {
      const updatedAssignment: UpdateAssignment = {
        date,
        startTime,
        endTime,
        driver: selectedDriverId,
        medic: selectedMedicId,
      };

      // ✅ Si viene _id (cuando el objeto lo trae), lo añadimos. Si no, no.
      const assignmentMongoId =
        assignment && typeof (assignment as any)._id === "string"
          ? ((assignment as any)._id as string)
          : undefined;

      if (assignmentMongoId) {
        updatedAssignment._id = assignmentMongoId;
      }



      // Detecta si ANTES había ambulancia
      const hadAmbulanceBefore =
        typeof assignment?.ambulanceId === "string"
          ? assignment?.ambulanceId?.trim()?.length > 0
          : assignment?.ambulanceId &&
            typeof assignment.ambulanceId === "object"
            ? Boolean((assignment.ambulanceId as any)?._id)
            : false;

      // Lógica de ambulancia:
      // - Si el select tiene un valor => enviamos ese ID (asignar/actualizar)
      // - Si el select está vacío PERO antes había ambulancia => enviamos "" para BORRAR explícitamente
      // - Si el select está vacío y antes NO había => no mandamos el campo
      if (ambulanceId && ambulanceId.trim() !== "") {
        updatedAssignment.ambulanceId = ambulanceId;
      } else if (hadAmbulanceBefore) {
        // borrado explícito
        updatedAssignment.ambulanceId = "";
      }

      await updateDienstPartial(
        dienstId,
        { assignments: [updatedAssignment] },
        token,
      );
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

  // ===== Helpers visuales coherentes con UserAssignModal =====

  // --- helpers de types (FASE 1 compat) ---
  const toUserRef = (v: unknown): UserRef | null => {
    if (!v || typeof v !== "object") return null;
    const anyV = v as any;
    if (typeof anyV._id === "string") return anyV as UserRef;
    return null;
  };

  const driverClass = (pschein?: string | null) => {
    if (!pschein) return "";
    const info = getPscheinInfo(pschein);
    if (info.status === "expired") return "text-red-600 font-medium";
    if (info.status === "warning") return "text-yellow-600 font-medium";
    return "";
  };
  const driverExpired = (u: UserRef) => {
    const info = getPscheinInfo((u as any)?.pscheinExpiry);
    return info.status === "expired";
  };
  const driverPscheinTitle = (u?: UserRef | null) => {
    if (!u) return undefined;
    const expiry = (u as any)?.pscheinExpiry as string | undefined;
    const info = getPscheinInfo(expiry);
    if (info.status === "warning" || info.status === "expired") {
      return getPscheinWarningTitle(expiry, t);
    }
    return undefined;
  };
  const mergeClasses = (...classes: (string | false | null | undefined)[]) =>
    classes.filter(Boolean).join(" ");
  // "Apagado" para vacaciones/bajas; NO se usa para caducado para no perder el rojo.
  const dimClass = "text-slate-400";

  // Tooltips de vacaciones/bajas (día actual)
  const userVacationInfo = (u?: UserRef | null) => {
    if (!u || !u._id)
      return { has: false, title: undefined as string | undefined };
    const vf = vacationFlags[u._id];
    const has = !!vf?.hasVacationInRange;
    if (!has) return { has: false, title: undefined as string | undefined };
    const fromFull = vf?.vacationStartFull;
    const toFull = vf?.vacationUntilFull;
    let title: string | undefined;
    if (fromFull && toFull) {
      title = `🏖️ ${t("pages.diensts.weekModals.vacations", "Vacaciones")}: ${fmtDDMM(
        fromFull,
      )} → ${fmtDDMM(toFull)}`;
    } else {
      title = `🏖️ ${t("pages.diensts.weekModals.vacations", "Vacaciones")}`;
    }
    return { has: true, title };
  };
  const userSickInfo = (u?: UserRef | null) => {
    if (!u || !u._id)
      return { has: false, title: undefined as string | undefined };
    const sf = sickFlags[u._id];
    const has = !!sf?.hasSickInRange;
    if (!has) return { has: false, title: undefined as string | undefined };
    const fromFull = sf?.sickStartFull || sf?.sickStartInRange;
    const toFull = sf?.sickUntilFull || sf?.sickUntilInRange;
    let title: string | undefined;
    if (fromFull && toFull) {
      title = `🤒 ${t("pages.sick.tooltip.full", "Baja médica")}: ${fmtDDMM(fromFull)} → ${fmtDDMM(
        toFull,
      )}`;
    } else {
      title = `🤒 ${t("pages.sick.tooltip.full", "Baja médica")}`;
    }
    return { has: true, title };
  };

  // Seleccionados (para rótulos)
  const selectedDriver = useMemo(() => {
    const bySelected = availableDrivers.find((u) => u._id === selectedDriverId);
    if (bySelected) return bySelected;

    const fromAssignment = toUserRef(assignment?.driver);
    if (fromAssignment) {
      return (
        availableDrivers.find((u) => u._id === fromAssignment._id) ??
        fromAssignment
      );
    }

    return null;
  }, [availableDrivers, selectedDriverId, assignment]);

  const selectedMedic = useMemo(() => {
    const bySelected = availableMedics.find((u) => u._id === selectedMedicId);
    if (bySelected) return bySelected;

    const fromAssignment = toUserRef(assignment?.medic);
    if (fromAssignment) {
      return (
        availableMedics.find((u) => u._id === fromAssignment._id) ??
        fromAssignment
      );
    }

    return null;
  }, [availableMedics, selectedMedicId, assignment]);


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />

      {/* Card */}
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          {t("pages.assignmentModal.title", {
            date: formatYYYYMMDDToDDMMYYYY(date),
          })}
        </h3>

        <div className="space-y-3">
          {isAdmin ? (
            <>
              {/* Horas y ambulancia */}
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

              <div className="space-y-1">
                <label
                  htmlFor="ambulanceId"
                  className="block text-sm font-medium text-slate-700"
                >
                  {t("pages.assignmentModal.labels.ambulance")}
                </label>
                <select
                  id="ambulanceId"
                  value={ambulanceId}
                  onChange={(e) => setAmbulanceId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 ring-1 ring-slate-200 px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">
                    {t("pages.assignmentModal.placeholders.selectAmbulance")}
                  </option>
                  {ambulances.map((amb) => (
                    <option key={amb._id} value={amb._id}>
                      {amb.ambulanceNumber}
                    </option>
                  ))}
                </select>
              </div>

              {/* Conductor */}
              <div className="space-y-1">
                <label
                  htmlFor={driverBtnId}
                  className="block text-sm font-medium text-slate-700"
                >
                  {t("pages.assignmentModal.labels.driver")}
                </label>

                <div className="relative">
                  <button
                    id={driverBtnId}
                    type="button"
                    className="w-full flex items-center justify-between rounded-xl border border-slate-300 ring-1 ring-slate-200 px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
                    onClick={() => setOpenDriverList((v) => !v)}
                    aria-haspopup="listbox"
                    aria-expanded={openDriverList}
                  >
                    <span className="truncate">
                      {(() => {
                        const u =
                          selectedDriver || (assignment?.driver as any) || null;
                        if (!u)
                          return t(
                            "pages.assignmentModal.placeholders.selectDriver",
                          );
                        const vac = userVacationInfo(u);
                        const sick = userSickInfo(u);
                        return (
                          <>
                            <span
                              className={mergeClasses(
                                typeof u === "object"
                                  ? driverClass((u as any)?.pscheinExpiry)
                                  : "",
                                // solo vac/sick se ven "apagados" en el nombre; si está caducado mantenemos el rojo visible
                                (vac.has || sick.has) && dimClass,
                              )}
                              title={
                                typeof u === "object"
                                  ? driverPscheinTitle(u)
                                  : undefined
                              }
                            >
                              {typeof u === "object"
                                ? `${u.lastName || ""}, ${u.name || ""}`
                                : t(
                                  "pages.assignmentModal.placeholders.selectDriver",
                                )}
                            </span>
                            {vac.has && (
                              <span
                                className="ml-1 align-middle text-slate-400"
                                title={vac.title}
                              >
                                🏖️
                              </span>
                            )}
                            {sick.has && (
                              <span
                                className="ml-1 align-middle text-slate-500"
                                title={sick.title}
                              >
                                🤒
                              </span>
                            )}
                          </>
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
                          {t("common.empty", "No hay resultados")}
                        </div>
                      )}

                      {/* Opción para limpiar el conductor */}
                      <button
                        role="option"
                        aria-selected={selectedDriverId === ""}
                        onClick={() => {
                          setSelectedDriverId("");
                          setOpenDriverList(false);
                        }}
                        className={mergeClasses(
                          "w-full text-left px-3 py-2 text-sm hover:bg-slate-50 focus:bg-slate-50 focus:outline-none",
                          selectedDriverId === "" && "bg-slate-50",
                        )}
                      >
                        —{" "}
                        {t(
                          "pages.assignmentModal.placeholders.selectDriver",
                          "Sin asignar",
                        )}{" "}
                        —
                      </button>

                      {availableDrivers
                        .slice()
                        .sort((a, b) => {
                          const da = driverExpired(a) ? 1 : 0;
                          const db = driverExpired(b) ? 1 : 0;
                          if (da !== db) return da - db;
                          const ka =
                            `${a.lastName || ""} ${a.name || ""}`.toLowerCase();
                          const kb =
                            `${b.lastName || ""} ${b.name || ""}`.toLowerCase();
                          return ka.localeCompare(kb, "es");
                        })
                        .map((u) => {
                          const vac = userVacationInfo(u);
                          const sick = userSickInfo(u);
                          const expired = driverExpired(u);
                          const isSick = sick.has;
                          const isVac = vac.has; // ⛔ vacaciones en ESTA FECHA

                          return (
                            <button
                              key={u._id}
                              role="option"
                              aria-selected={selectedDriverId === u._id}
                              onClick={() => {
                                if (expired) return; // no puede conducir con P-Schein caducado
                                if (isSick) return; // bloqueado si está de baja
                                if (isVac) return; // 🆕 bloqueado si está de vacaciones
                                setSelectedDriverId(u._id || "");
                                if (u._id === selectedMedicId)
                                  setSelectedMedicId("");
                                setOpenDriverList(false);
                              }}
                              className={mergeClasses(
                                "w-full text-left px-3 py-2 text-sm hover:bg-slate-50 focus:bg-slate-50 focus:outline-none",
                                selectedDriverId === u._id && "bg-slate-50",
                                (expired || isSick || isVac) &&
                                "opacity-50 cursor-not-allowed", // 🆕 añade isVac
                              )}
                            >
                              <span
                                className={mergeClasses(
                                  driverClass((u as any)?.pscheinExpiry),
                                  (isVac || isSick || expired) && "opacity-50", // atenuado si vac/sick/expired
                                )}
                                title={driverPscheinTitle(u)}
                              >
                                {(u.lastName || "") + ", " + (u.name || "")}
                              </span>
                              {vac.has && (
                                <span
                                  className="ml-1 align-middle text-slate-400"
                                  title={vac.title}
                                >
                                  🏖️
                                </span>
                              )}
                              {isSick && (
                                <span
                                  className="ml-1 align-middle text-slate-500"
                                  title={sick.title}
                                >
                                  🤒
                                </span>
                              )}
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>

                {/* Leyenda driver */}
                <p className="mt-1 text-[11px] text-slate-500">
                  🚫{" "}
                  {t(
                    "pages.diensts.adminPage.legendCantDrive",
                    "No puede conducir, P-Schein caducado",
                  )}
                </p>

                {/* Hint vacaciones/bajas */}
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
              </div>

              {/* Sanitario */}
              <div className="space-y-1">
                <label
                  htmlFor={medicBtnId}
                  className="block text-sm font-medium text-slate-700"
                >
                  {t("pages.assignmentModal.labels.medic")}
                </label>

                <div className="relative">
                  <button
                    id={medicBtnId}
                    type="button"
                    className="w-full flex items-center justify-between rounded-xl border border-slate-300 ring-1 ring-slate-200 px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
                    onClick={() => setOpenMedicList((v) => !v)}
                    aria-haspopup="listbox"
                    aria-expanded={openMedicList}
                  >
                    <span className="truncate">
                      {(() => {
                        const u =
                          selectedMedic || (assignment?.medic as any) || null;
                        if (!u)
                          return t(
                            "pages.assignmentModal.placeholders.selectMedic",
                          );
                        const vac = userVacationInfo(u);
                        const sick = userSickInfo(u);
                        return (
                          <>
                            <span
                              className={mergeClasses(
                                (vac.has || sick.has) && dimClass,
                              )}
                            >
                              {typeof u === "object"
                                ? `${u.lastName || ""}, ${u.name || ""}`
                                : t(
                                  "pages.assignmentModal.placeholders.selectMedic",
                                )}
                            </span>
                            {vac.has && (
                              <span
                                className="ml-1 align-middle text-slate-400"
                                title={vac.title}
                              >
                                🏖️
                              </span>
                            )}
                            {sick.has && (
                              <span
                                className="ml-1 align-middle text-slate-500"
                                title={sick.title}
                              >
                                🤒
                              </span>
                            )}
                          </>
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
                          {t("common.empty", "No hay resultados")}
                        </div>
                      )}

                      {/* Opción para limpiar el sanitario */}
                      <button
                        role="option"
                        aria-selected={selectedMedicId === ""}
                        onClick={() => {
                          setSelectedMedicId("");
                          setOpenMedicList(false);
                        }}
                        className={mergeClasses(
                          "w-full text-left px-3 py-2 text-sm hover:bg-slate-50 focus:bg-slate-50 focus:outline-none",
                          selectedMedicId === "" && "bg-slate-50",
                        )}
                      >
                        —{" "}
                        {t(
                          "pages.assignmentModal.placeholders.selectMedic",
                          "Sin asignar",
                        )}{" "}
                        —
                      </button>

                      {availableMedics
                        .slice()
                        .sort((a, b) => {
                          const ka =
                            `${a.lastName || ""} ${a.name || ""}`.toLowerCase();
                          const kb =
                            `${b.lastName || ""} ${b.name || ""}`.toLowerCase();
                          return ka.localeCompare(kb, "es");
                        })
                        .map((u) => {
                          const vac = userVacationInfo(u);
                          const sick = userSickInfo(u);
                          const isVac = vac.has; // 🆕 vacaciones
                          const isSick = sick.has;

                          return (
                            <button
                              key={u._id}
                              role="option"
                              aria-selected={selectedMedicId === u._id}
                              onClick={() => {
                                if (isVac) return; // 🆕 bloqueado si está de vacaciones
                                if (isSick) return; // bloqueado si está de baja
                                if (u._id === selectedDriverId)
                                  setSelectedDriverId("");
                                setSelectedMedicId(u._id || "");
                                setOpenMedicList(false);
                              }}
                              className={mergeClasses(
                                "w-full text-left px-3 py-2 text-sm hover:bg-slate-50 focus:bg-slate-50 focus:outline-none",
                                selectedMedicId === u._id && "bg-slate-50",
                                (isVac || isSick) &&
                                "opacity-50 cursor-not-allowed", // 🆕 añade isVac
                              )}
                            >
                              <span
                                className={mergeClasses(
                                  (isVac || isSick) && "opacity-50",
                                )}
                              >
                                {(u.lastName || "") + ", " + (u.name || "")}
                              </span>
                              {vac.has && (
                                <span
                                  className="ml-1 align-middle text-slate-400"
                                  title={vac.title}
                                >
                                  🏖️
                                </span>
                              )}
                              {sick.has && (
                                <span
                                  className="ml-1 align-middle text-slate-500"
                                  title={sick.title}
                                >
                                  🤒
                                </span>
                              )}
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>

                {/* Hint vacaciones/bajas */}
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
              </div>

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
                {typeof assignment?.ambulanceId === "object"
                  ? (assignment.ambulanceId?.ambulanceNumber ??
                    t("pages.assignmentModal.info.dash"))
                  : (assignment?.ambulanceNumber ??
                    t("pages.assignmentModal.info.dash"))}
              </p>
              <p className="text-sm text-slate-700">
                {t("pages.assignmentModal.readOnly.driver")}{" "}
                {typeof assignment.driver === "object"
                  ? `${assignment.driver.lastName}, ${assignment.driver.name}`
                  : "(ID)"}
              </p>
              <p className="text-sm text-slate-700">
                {t("pages.assignmentModal.readOnly.medic")}{" "}
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
