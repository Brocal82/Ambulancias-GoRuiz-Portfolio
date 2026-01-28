import { useEffect, useState, useId, useMemo } from "react";
import { useAuth } from "../../hooks/useAuth";
import { getTeams, type Team, getUsedTeamsForWeek } from "../../api/teams";
import { toastT } from "../../utils/toast";
import { useTranslation } from "react-i18next";
import {
  getPscheinInfo,
  getPscheinWarningTitle,
} from "../../utils/pscheinUtils";
import { getVacationFlagsInRange, type VacFlag } from "../../api/vacation";
import { getSickFlagsInRange, type SickFlag } from "../../api/sickLeaves";
import { fmtDDMM } from "../../utils/timeUtils";
import { UsersApi } from "../../modules/users";


interface Props {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Mantiene compatibilidad con tu caller actual.
   * Si hace falta swap de roles, envío resolvedRoles en el 2º argumento (opcional).
   */
  onConfirm: (
    teamId: string,
    resolvedRoles?: { driverId: string; medicId: string },
  ) => Promise<void> | void;
  weekStartISO: string;

  /** Número de Dienst para esa semana (1,2,3,...) */
  dienstNumber: number;

  /** Opcional: si lo pasas, filtramos por disponibilidad real del día/franja */
  date?: string; // 'YYYY-MM-DD'
  startTime?: string; // 'HH:mm'
  endTime?: string; // 'HH:mm'
}

export default function TeamAssignModal({
  isOpen,
  onClose,
  onConfirm,
  weekStartISO,
  dienstNumber,
  date,
  startTime,
  endTime,
}: Props) {
  const { token } = useAuth();
  const { t } = useTranslation();

  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [resolvedRoles, setResolvedRoles] = useState<{
    driverId: string;
    medicId: string;
  } | null>(null);
  const [openList, setOpenList] = useState(false);

  const [usedTeamIds, setUsedTeamIds] = useState<string[]>([]);

  // disponibilidad por día/franja (si llega date)
  const [availDriverIds, setAvailDriverIds] = useState<Set<string>>(new Set());
  const [availMedicIds, setAvailMedicIds] = useState<Set<string>>(new Set());
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  // Flags por usuario (driver/medic)
  const [vacationFlags, setVacationFlags] = useState<Record<string, VacFlag>>(
    {},
  );
  const [sickFlags, setSickFlags] = useState<Record<string, SickFlag>>({});
  const [flagsLoading, setFlagsLoading] = useState(false);

  const selectId = useId();

  // Helpers locales
  const addDaysISO = (iso: string, days: number) => {
    const d = new Date(iso);
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
  };

  // Fin de semana = inicio + 6 días
  const weekEndISO = useMemo(() => addDaysISO(weekStartISO, 6), [weekStartISO]);

  // Cargar equipos
  useEffect(() => {
    const load = async () => {
      if (!isOpen || !token) return;
      try {
        setLoading(true);
        const data = await getTeams(token);
        setTeams(data);
      } catch (e) {
        console.error(e);
        toastT.error(["toasts.teams.loadError"]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isOpen, token]);

  // 🔄 Cargar equipos ya usados en esa semana/dienst (para atenuarlos en el selector)
  useEffect(() => {
    if (!isOpen || !token || !weekStartISO || !dienstNumber) {
      setUsedTeamIds([]);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const ids = await getUsedTeamsForWeek(token, {
          weekStartDate: weekStartISO,
          dienstNumber,
        });
        if (!cancelled) {
          setUsedTeamIds(ids);
        }
      } catch (e) {
        console.error("❌ Error al cargar equipos usados para la semana:", e);
        if (!cancelled) {
          setUsedTeamIds([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, token, weekStartISO, dienstNumber]);

  // Cargar disponibilidad por día/franja (si llega date)
  useEffect(() => {
    if (!isOpen || !token || !date) {
      setAvailDriverIds(new Set());
      setAvailMedicIds(new Set());
      setAvailabilityLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setAvailabilityLoading(true);
        const opts = { startTime, endTime };
        const [drivers, medics] = await Promise.all([
          UsersApi.getAvailableUsersForDate(date, "driver", token, opts),
          UsersApi.getAvailableUsersForDate(date, "medic", token, opts),
        ]);

        if (cancelled) return;
        setAvailDriverIds(new Set(drivers.map((u) => u._id)));
        setAvailMedicIds(new Set(medics.map((u) => u._id)));
      } catch (e) {
        console.error("❌ Error al cargar disponibilidad (equipos):", e);
        if (!cancelled) {
          setAvailDriverIds(new Set());
          setAvailMedicIds(new Set());
        }
      } finally {
        if (!cancelled) setAvailabilityLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, token, date, startTime, endTime]);

  // IDs únicos de miembros (driver/medic) en todos los equipos
  const collectUserIds = (teamsList: Team[]) => {
    const ids = new Set<string>();
    for (const t of teamsList) {
      const dId = (t.driver as any)?._id || (t.driver as any);
      const mId = (t.medic as any)?._id || (t.medic as any);
      if (typeof dId === "string") ids.add(dId);
      if (typeof mId === "string") ids.add(mId);
    }
    return Array.from(ids);
  };

  // Cargar flags de vacaciones y bajas para todos los usuarios presentes en los equipos (con includeFullSpan)
  useEffect(() => {
    if (!isOpen || !token) return;
    if (teams.length === 0) {
      setVacationFlags({});
      setSickFlags({});
      return;
    }

    const userIds = collectUserIds(teams);
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
          fromISO: weekStartISO,
          toISO: weekEndISO,
          includeFullSpan: true,
        });
        const sickPromise = getSickFlagsInRange({
          userIds,
          fromISO: weekStartISO,
          toISO: weekEndISO,
          includeFullSpan: true,
        });

        const [vacFlagsRes, sickFlagsRes] = await Promise.all([
          vacPromise,
          sickPromise,
        ]);
        if (!cancelled) {
          setVacationFlags(vacFlagsRes);
          setSickFlags(sickFlagsRes);
        }
      } catch (e) {
        console.error("❌ Error al obtener flags (teams):", e);
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
  }, [isOpen, token, teams, weekStartISO, weekEndISO]);

  // --- Compatibilidad de equipo con reglas de P-Schein y swap ---
  const selectedTeam = teams.find((t) => t._id === selectedId) || null;

  const pscheinValidOnDate = (pschein?: string | null) => {
    if (!pschein) return true;
    const info = getPscheinInfo(pschein);
    return info.status !== "expired";
  };

  const canDrive = (user: any) => {
    const role = user?.ambulanceRole as "driver" | "medic" | "both" | undefined;
    const hasRole = role === "driver" || role === "both";
    if (!hasRole) return false;
    return pscheinValidOnDate(user?.pscheinExpiry);
  };

  // disponibilidad por rol (si no hay date, no filtramos por disponibilidad)
  const isAvailDriver = (uid?: string) =>
    !date || (uid ? availDriverIds.has(uid) : false);
  const isAvailMedic = (uid?: string) =>
    !date || (uid ? availMedicIds.has(uid) : false);

  const computeCompatibility = (team: any) => {
    if (!team)
      return {
        compatible: false as const,
        reason: t("common.select", "Selecciona un equipo"),
        resolve: null as null | { driverId: string; medicId: string },
      };

    const drv = team.driver as any;
    const med = team.medic as any;

    const drvId = (drv?._id || drv) as string | undefined;
    const medId = (med?._id || med) as string | undefined;

    // 1) Caso estándar: driver conduce (válido) y ambos disponibles por rol
    const standardOk =
      !!drvId &&
      !!medId &&
      canDrive(drv) &&
      isAvailDriver(drvId) &&
      isAvailMedic(medId);

    if (standardOk) {
      return {
        compatible: true as const,
        reason: null,
        resolve: { driverId: drvId!, medicId: medId! },
      };
    }

    // 2) Caso swap: si el "driver" tiene P-Schein caducado pero su rol es 'both',
    // y el "medic" SÍ puede conducir -> invertimos roles (medic = driver, driver = medic)
    const driverExpiredButBoth =
      drv?.ambulanceRole === "both" && !pscheinValidOnDate(drv?.pscheinExpiry);
    const medicCanDrive = canDrive(med);

    const swapOk =
      !!drvId &&
      !!medId &&
      driverExpiredButBoth &&
      medicCanDrive &&
      isAvailDriver(medId) &&
      isAvailMedic(drvId);

    if (swapOk) {
      return {
        compatible: true as const,
        reason: null,
        resolve: { driverId: medId!, medicId: drvId! },
      };
    }

    // 3) Incompatibilidades (mensaje razonado)
    if (!drvId || !medId) {
      return {
        compatible: false as const,
        reason: t(
          "pages.diensts.assignTeamModal.errors.missingMembers",
          "Equipo incompleto",
        ),
        resolve: null,
      };
    }

    // Sin conductor válido en ninguna configuración
    const noValidDriver = !canDrive(drv) && !canDrive(med);

    if (noValidDriver) {
      return {
        compatible: false as const,
        reason: t(
          "pages.diensts.assignTeamModal.errors.noValidDriver",
          "La pareja no tiene ningún conductor válido",
        ),
        resolve: null,
      };
    }

    // Fallo por disponibilidad (día/franja)
    if (date) {
      const drvAsDriver = canDrive(drv) && !isAvailDriver(drvId);
      const medAsMedic = !isAvailMedic(medId);
      const medAsDriver = canDrive(med) && !isAvailDriver(medId);
      const drvAsMedic = !isAvailMedic(drvId);

      if (drvAsDriver || medAsMedic) {
        return {
          compatible: false as const,
          reason: t(
            "pages.diensts.assignTeamModal.errors.unavailableStandard",
            "No disponibles en la franja como Driver/Sanitario seleccionados",
          ),
          resolve: null,
        };
      }
      if (driverExpiredButBoth && !medAsDriver && drvAsMedic) {
        // driver caducado (both), medic puede conducir, pero falta disponibilidad en algún rol del swap
        return {
          compatible: false as const,
          reason: t(
            "pages.diensts.assignTeamModal.errors.unavailableSwap",
            "Swap posible pero alguno no está disponible en la franja",
          ),
          resolve: null,
        };
      }
    }

    return {
      compatible: false as const,
      reason: t(
        "pages.diensts.assignTeamModal.errors.incompatible",
        "Equipo no compatible con las condiciones",
      ),
      resolve: null,
    };
  };

  const compat = useMemo(
    () => computeCompatibility(selectedTeam),
    [selectedTeam, availDriverIds, availMedicIds, date],
  );

  useEffect(() => {
    setResolvedRoles(compat.resolve);
  }, [compat]);

  if (!isOpen) return null;

  const driverClass = (pschein?: string | null) => {
    if (!pschein) return "";
    const info = getPscheinInfo(pschein);
    if (info.status === "expired") return "text-red-600 font-medium";
    if (info.status === "warning") return "text-yellow-600 font-medium";
    return "";
  };

  const mergeClasses = (...classes: (string | false | null | undefined)[]) =>
    classes.filter(Boolean).join(" ");

  const dimClass = "opacity-50";

  const driverPscheinTitle = (user: any): string | undefined => {
    const expiry = user?.pscheinExpiry as string | undefined;
    if (!expiry) return undefined;
    const info = getPscheinInfo(expiry);
    if (info.status === "warning" || info.status === "expired") {
      return getPscheinWarningTitle(expiry, t);
    }
    return undefined;
  };

  const userVacationInfo = (user: any) => {
    const uid: string | undefined =
      typeof user === "object" && user ? (user as any)._id : (user as any);
    if (!uid) return { has: false, title: undefined as string | undefined };

    const vf = vacationFlags[uid];
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

  const userSickInfo = (user: any) => {
    const uid: string | undefined =
      typeof user === "object" && user ? (user as any)._id : (user as any);
    if (!uid) return { has: false, title: undefined as string | undefined };

    const sf = sickFlags[uid];
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

  const renderSelectedTeamLabel = () => {
    if (loading) return t("common.loading");
    if (!selectedTeam) return t("common.select");

    const drv: any = selectedTeam.driver;
    const med: any = selectedTeam.medic;

    const drvVac = userVacationInfo(drv);
    const medVac = userVacationInfo(med);
    const drvSick = userSickInfo(drv);
    const medSick = userSickInfo(med);

    return (
      <span className="truncate">
        <span
          className={mergeClasses(
            driverClass(drv?.pscheinExpiry),
            (drvVac.has || drvSick.has) && dimClass,
          )}
          title={driverPscheinTitle(drv)}
        >
          {(drv?.lastName || "") + ", " + (drv?.name || "")}
        </span>
        {drvVac.has && (
          <span
            className="ml-1 align-middle text-slate-400"
            title={drvVac.title}
          >
            🏖️
          </span>
        )}
        {drvSick.has && (
          <span
            className="ml-1 align-middle text-slate-500"
            title={drvSick.title}
          >
            🤒
          </span>
        )}

        <span className="text-slate-500"> / </span>

        <span className={mergeClasses((medVac.has || medSick.has) && dimClass)}>
          {(med?.lastName || "") + ", " + (med?.name || "")}
        </span>
        {medVac.has && (
          <span
            className="ml-1 align-middle text-slate-400"
            title={medVac.title}
          >
            🏖️
          </span>
        )}
        {medSick.has && (
          <span
            className="ml-1 align-middle text-slate-500"
            title={medSick.title}
          >
            🤒
          </span>
        )}
      </span>
    );
  };

  const canConfirm =
    !!selectedId &&
    compat.compatible &&
    !loading &&
    !availabilityLoading &&
    !usedTeamIds.includes(selectedId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
        <h3 className="text-lg font-semibold text-slate-900 mb-3">
          {t("pages.diensts.assignTeamModal.title")}
        </h3>

        <div className="space-y-2">
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-slate-700"
          >
            {t("pages.diensts.assignTeamModal.select")}
          </label>

          <div className="relative">
            <button
              id={selectId}
              type="button"
              className="w-full flex items-center justify-between rounded-xl border border-slate-300 ring-1 ring-slate-200 px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
              onClick={() => setOpenList((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={openList}
            >
              {renderSelectedTeamLabel()}
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
                {teams.length === 0 && (
                  <div className="px-3 py-2 text-sm text-slate-500">
                    {t(
                      "pages.adminTeams.empty",
                      "Todavía no hay equipos creados.",
                    )}
                  </div>
                )}

                {teams.map((tItem) => {
                  const isSelected = selectedId === tItem._id;
                  const isUsed = usedTeamIds.includes(tItem._id); // 👈 ya asignado en otro Dienst esta semana
                  const drv: any = tItem.driver;
                  const med: any = tItem.medic;

                  const drvVac = userVacationInfo(drv);
                  const medVac = userVacationInfo(med);
                  const drvSick = userSickInfo(drv);
                  const medSick = userSickInfo(med);

                  return (
                    <button
                      key={tItem._id}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        if (isUsed) return; // 🚫 no seleccionable si ya está usado
                        setSelectedId(tItem._id);
                        setOpenList(false);
                      }}
                      className={mergeClasses(
                        "w-full text-left px-3 py-2 text-sm hover:bg-slate-50 focus:bg-slate-50 focus:outline-none",
                        isSelected && "bg-slate-50",
                        isUsed && "opacity-40 cursor-not-allowed", // 👈 visualmente “apagado”
                      )}
                      disabled={isUsed}
                      title={
                        isUsed
                          ? t(
                            "pages.diensts.assignTeamModal.usedTooltip",
                            "Este equipo ya está asignado a otro Dienst esta semana",
                          )
                          : undefined
                      }
                    >
                      <span
                        className={mergeClasses(
                          driverClass(drv?.pscheinExpiry),
                          (drvVac.has || drvSick.has) && dimClass,
                        )}
                        title={driverPscheinTitle(drv)}
                      >
                        {(drv?.lastName || "") + ", " + (drv?.name || "")}
                      </span>
                      {drvVac.has && (
                        <span
                          className="ml-1 align-middle text-slate-400"
                          title={drvVac.title}
                        >
                          🏖️
                        </span>
                      )}
                      {drvSick.has && (
                        <span
                          className="ml-1 align-middle text-slate-500"
                          title={drvSick.title}
                        >
                          🤒
                        </span>
                      )}

                      <span className="text-slate-500"> / </span>

                      <span
                        className={mergeClasses(
                          (medVac.has || medSick.has) && dimClass,
                        )}
                      >
                        {(med?.lastName || "") + ", " + (med?.name || "")}
                      </span>
                      {medVac.has && (
                        <span
                          className="ml-1 align-middle text-slate-400"
                          title={medVac.title}
                        >
                          🏖️
                        </span>
                      )}
                      {medSick.has && (
                        <span
                          className="ml-1 align-middle text-slate-500"
                          title={medSick.title}
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

          {/* Hint tooltips */}
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

          {usedTeamIds.length > 0 && (
            <p className="mt-1 text-[11px] text-slate-500">
              ♻️{" "}
              {t(
                "pages.diensts.assignTeamModal.usedHint",
                "Los equipos atenuados ya están asignados en otro Dienst esta semana",
              )}
            </p>
          )}

          {/* Estado de compatibilidad */}
          {availabilityLoading && date && (
            <p className="mt-1 text-[12px] text-slate-500">
              {t(
                "pages.diensts.assignTeamModal.checking",
                "Comprobando disponibilidad...",
              )}
            </p>
          )}
          {!compat.compatible && selectedId && (
            <p className="mt-1 text-[12px] text-rose-600">{compat.reason}</p>
          )}
        </div>

        <div className="mt-4 space-y-2">
          <button
            className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-50"
            disabled={!canConfirm}
            onClick={async () => {
              if (!selectedId) return;
              await onConfirm(selectedId, resolvedRoles ?? undefined);
            }}
          >
            {t("pages.diensts.assignTeamModal.confirm")}
          </button>
          <button
            className="w-full rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-300 focus:outline-none focus:ring-4 focus:ring-slate-100"
            onClick={onClose}
          >
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
