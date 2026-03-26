import { useEffect, useId, useMemo, useState } from "react";

import { useAuth } from "../../../hooks/useAuth";
import { useTranslation } from "react-i18next";

import { UsersApi } from "../../users";

import type { AmbulanceRole, User } from "../../users";

import {
  getPscheinInfo,
} from "../../../utils/pscheinUtils";
import { getPscheinWarningTitle } from "../utils/pscheinWarningTitle";

import { getVacationFlagsInRange, type VacFlag } from "../../vacation/domain/api";
import { getSickFlagsInRange, type SickFlag } from "../../sick/domain";

import { mergeClasses } from "../utils";

import { fmtDDMM } from "../../../utils/timeUtils";
import { isDriverEligibleForAssignment } from "../utils/driverEligibility";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (params: {
    role: "driver" | "medic";
    userId: string;
  }) => Promise<void> | void;
  weekStartISO: string;

  /** Opcional: si lo pasas, filtramos por disponibilidad real del día/franja */
  date?: string; // 'YYYY-MM-DD'
  startTime?: string; // 'HH:mm'
  endTime?: string; // 'HH:mm'
}

export default function UserAssignModal({
  isOpen,
  onClose,
  onConfirm,
  weekStartISO,
  date,
  startTime,
  endTime,
}: Props) {
  const { token } = useAuth();
  const { t } = useTranslation();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<"driver" | "medic">("driver");
  const [userId, setUserId] = useState("");

  const [openList, setOpenList] = useState(false);

  const [vacationFlags, setVacationFlags] = useState<Record<string, VacFlag>>(
    {},
  );
  const [sickFlags, setSickFlags] = useState<Record<string, SickFlag>>({});
  const [flagsLoading, setFlagsLoading] = useState(false);

  const addDaysISO = (iso: string, days: number) => {
    const d = new Date(`${iso}T12:00:00`); // evita saltos por UTC
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const weekEndISO = useMemo(() => addDaysISO(weekStartISO, 6), [weekStartISO]);

  const roleId = useId();
  const userSelectId = useId();

  // Cargar usuarios: si hay date usamos /users/available con horas; si no, fallback a /users
  useEffect(() => {
    if (!isOpen || !token) return;
    (async () => {
      try {
        setLoading(true);

        if (date) {
          const data = await UsersApi.getAvailableUsersForDate(
            date,
            role, // rol deseado actual
            { startTime, endTime },
          );
          setUsers(data);
          setUserId(""); // reset selección al cambiar role/date/horas
        } else {
          const all = await UsersApi.getAllUsers();
          setUsers(all);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
    // recarga cuando cambian role/date/start/end
  }, [isOpen, token, role, date, startTime, endTime]);

  // Filtrar por rol de ambulancia solo si NO estamos usando /users/available (porque ese ya viene filtrado por desiredRole)
  const filteredByRole = useMemo(() => {
    if (date) return users; // ya viene filtrado por rol + elegibilidad conductor desde el backend
    const need: AmbulanceRole[] =
      role === "driver" ? ["driver", "both"] : ["medic", "both"];
    return users.filter((u) => {
      if (!u.ambulanceRole || !need.includes(u.ambulanceRole)) return false;
      if (role === "driver") {
        return isDriverEligibleForAssignment(u, undefined);
      }
      return true;
    });
  }, [users, role, date]);

  // Flags para usuarios visibles por rol
  useEffect(() => {
    if (!isOpen || !token) return;
    if (filteredByRole.length === 0) {
      setVacationFlags({});
      setSickFlags({});
      return;
    }

    const ids = filteredByRole.map((u) => u._id).filter(Boolean);
    let cancelled = false;

    (async () => {
      try {
        setFlagsLoading(true);
        const vacPromise = getVacationFlagsInRange({
          userIds: ids,
          fromISO: weekStartISO,
          toISO: weekEndISO,
          includeFullSpan: true,
        });
        const sickPromise = getSickFlagsInRange({
          userIds: ids,
          fromISO: weekStartISO,
          toISO: weekEndISO,
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
        console.error("❌ Error al obtener flags (usuarios):", e);
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
  }, [isOpen, token, filteredByRole, weekStartISO, weekEndISO]);

  // P-Schein solo afecta a DRIVER (UI: colorear/inhabilitar)
  const driverPscheinClass = (pschein?: string | null) => {
    if (!pschein) return "";
    const info = getPscheinInfo(pschein);
    if (info.status === "expired") return "text-red-600 font-medium";
    if (info.status === "warning") return "text-yellow-600 font-medium";
    return "";
  };

  const isDriverIneligible = (u: User) => {
    if (role !== "driver") return false;
    return !isDriverEligibleForAssignment(u, date);
  };

  // Tooltip SOLO sobre el nombre cuando P-Schein warning/expired (rol driver)
  const driverPscheinTitle = (u?: User | null): string | undefined => {
    if (!u || role !== "driver") return undefined;
    const expiry = (u as any)?.pscheinExpiry as string | undefined;
    if (!expiry) return undefined;
    const info = getPscheinInfo(expiry);
    if (info.status === "warning" || info.status === "expired") {
      return getPscheinWarningTitle
        ? getPscheinWarningTitle(expiry, t)
        : (t("pages.diensts.adminPage.driverPscheinWarning", {
          count: info.monthsLeft ?? 0,
        }) as string);
    }
    return undefined;
  };

  const dimClass = "opacity-50";

  const userVacationInfo = (u: User) => {
    const vf = vacationFlags[u._id];
    const has = !!vf?.hasVacationInRange;
    if (!has) return { has: false, title: undefined as string | undefined };

    const fullFrom = vf?.vacationStartFull;
    const fullTo = vf?.vacationUntilFull;

    let title: string | undefined;
    if (fullFrom && fullTo) {
      title = `🏖️ ${t("pages.diensts.weekModals.vacations", "Vacaciones")}: ${fmtDDMM(fullFrom)} → ${fmtDDMM(fullTo)}`;
    } else {
      title = `🏖️ ${t("pages.diensts.weekModals.vacations", "Vacaciones")}`;
    }
    return { has: true, title };
  };

  const userSickInfo = (u: User) => {
    const sf = sickFlags[u._id];
    const has = !!sf?.hasSickInRange;
    if (!has) return { has: false, title: undefined as string | undefined };

    const fullFrom = sf?.sickStartFull || sf?.sickStartInRange;
    const fullTo = sf?.sickUntilFull || sf?.sickUntilInRange;

    let title: string | undefined;
    if (fullFrom && fullTo) {
      title = `🤒 ${t("pages.sick.tooltip.full", "Baja médica")}: ${fmtDDMM(fullFrom)} → ${fmtDDMM(fullTo)}`;
    } else {
      title = `🤒 ${t("pages.sick.tooltip.full", "Baja médica")}`;
    }
    return { has: true, title };
  };

  const selectedUser = useMemo(
    () => filteredByRole.find((u) => u._id === userId) || null,
    [filteredByRole, userId],
  );

  const handleClose = () => {
    setOpenList(false);
    onClose();
  };


  if (!isOpen) return null;

  const canAssign = !!userId && !loading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
        <h3 className="text-lg font-semibold text-slate-900 mb-3">
          {t(
            "pages.diensts.assignUserModal.title",
            "Asignar trabajador a la semana",
          )}
        </h3>

        <div className="space-y-3">
          {/* Selector de rol */}
          <div>
            <label
              htmlFor={roleId}
              className="block text-sm font-medium text-slate-700"
            >
              {t("pages.diensts.assignUserModal.role", "Rol")}
            </label>
            <select
              id={roleId}
              value={role}
              onChange={(e) => {
                setRole(e.target.value as "driver" | "medic");
                setUserId("");
              }}
              className="w-full rounded-xl border border-slate-300 ring-1 ring-slate-200 px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
              disabled={loading}
            >
              <option value="driver">
                {t("pages.diensts.assignUserModal.roleDriver", "Conductor")}
              </option>
              <option value="medic">
                {t("pages.diensts.assignUserModal.roleMedic", "Sanitario")}
              </option>
            </select>
          </div>

          {/* Selector de usuario */}
          <div>
            <label
              htmlFor={userSelectId}
              className="block text-sm font-medium text-slate-700"
            >
              {t("pages.diensts.assignUserModal.user", "Trabajador")}
            </label>

            <div className="relative">
              <button
                id={userSelectId}
                type="button"
                className="w-full flex items-center justify-between rounded-xl border border-slate-300 ring-1 ring-slate-200 px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
                onClick={() => setOpenList((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={openList}
              >
                <span className="truncate">
                  {loading
                    ? t("common.loading", "Cargando...")
                    : selectedUser
                      ? (() => {
                        const vac = userVacationInfo(selectedUser);
                        const sick = userSickInfo(selectedUser);
                        const dClass =
                          role === "driver"
                            ? driverPscheinClass(
                              (selectedUser as any)?.pscheinExpiry,
                            )
                            : "";
                        const dim =
                          (role === "driver" &&
                            isDriverIneligible(selectedUser)) ||
                          (!!date && (vac.has || sick.has))
                            ? dimClass
                            : "";
                        const title = driverPscheinTitle(selectedUser);
                        return (
                          <>
                            <span
                              className={mergeClasses(dClass, dim)}
                              title={title}
                            >
                              {(selectedUser.lastName || "") +
                                ", " +
                                (selectedUser.name || "")}
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
                      })()
                      : t("common.select", "Selecciona")}
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

              {openList && !loading && (
                <div
                  role="listbox"
                  tabIndex={-1}
                  aria-label="Opciones del selector"
                  className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg ring-1 ring-slate-200"
                >
                  {filteredByRole.length === 0 && (
                    <div className="px-3 py-2 text-sm text-slate-500">
                      {t("common.empty", "No hay resultados")}
                    </div>
                  )}

                  {filteredByRole
                    .slice()
                    .sort((a, b) => {
                      const da = isDriverIneligible(a) ? 1 : 0;
                      const db = isDriverIneligible(b) ? 1 : 0;
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
                      const dClass =
                        role === "driver"
                          ? driverPscheinClass((u as any)?.pscheinExpiry)
                          : "";
                      const ineligible =
                        role === "driver" ? isDriverIneligible(u) : false;
                      const vacSickBlocksSelection =
                        !!date && (vac.has || sick.has);
                      const isBlocked = ineligible || vacSickBlocksSelection;

                      const dim =
                        ineligible || vacSickBlocksSelection ? dimClass : "";
                      const title = driverPscheinTitle(u);

                      return (
                        <button
                          key={u._id}
                          role="option"
                          aria-selected={userId === u._id}
                          onClick={() => {
                            if (isBlocked) return;
                            setUserId(u._id);
                            setOpenList(false);
                          }}

                          className={mergeClasses(
                            "w-full text-left px-3 py-2 text-sm hover:bg-slate-50 focus:bg-slate-50 focus:outline-none",
                            userId === u._id && "bg-slate-50",
                            isBlocked && "opacity-50 cursor-not-allowed",
                          )}

                        >
                          <span
                            className={mergeClasses(dClass, dim)}
                            title={title}
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

            {role === "driver" && (
              <p className="mt-1 text-[11px] text-slate-500">
                🚫{" "}
                {t(
                  "pages.diensts.adminPage.legendCantDrive",
                  "No puede conducir, P-Schein caducado",
                )}
              </p>
            )}

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
        </div>

        <div className="mt-4 space-y-2">
          <button
            className="w-full rounded-xl bg-slate-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-200 disabled:opacity-50"
            disabled={!canAssign}
            onClick={async () => {
              if (!canAssign) return;
              await onConfirm({ role, userId });
            }}
          >
            {t("pages.diensts.assignUserModal.confirm", "Asignar")}
          </button>
          <button
            className="w-full rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-300 focus:outline-none focus:ring-4 focus:ring-slate-100"
            onClick={handleClose}
          >
            {t("common.cancel", "Cancelar")}
          </button>
        </div>
      </div>
    </div>
  );
}


