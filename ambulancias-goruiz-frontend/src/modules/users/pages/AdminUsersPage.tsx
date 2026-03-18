// frontend/src/pages/AdminUsersPage.tsx
import { useEffect, useState, useCallback } from "react";
import * as UsersApi from "../domain/api";
import { useAuth } from "../../../hooks/useAuth";
import type { User } from "../domain/types";
import { toastT } from "../../../utils/toast";
import { getPscheinInfo, getPscheinWarningTitle } from "../../../utils/pscheinUtils";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getVacationFlagsInRange, type VacFlag } from "../../vacation/domain/api";
import { getSickFlagsInRange, type SickFlag } from "../../sick/domain";
import { fmtDDMM } from "../../../utils/timeUtils";


// Mapeo de estilos de la píldora de rol (no cambia lógica)
const rolePillClass: Record<
  NonNullable<User["ambulanceRole"]> | "unknown",
  string
> = {
  driver: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  medic: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  both: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  unknown: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
};

// Helpers de fecha (Europe/Berlin) → ISO 'YYYY-MM-DD'
const getBerlinYMD = (d: Date) => {
  const y = Number(
    d.toLocaleString("en-CA", { timeZone: "Europe/Berlin", year: "numeric" }),
  );
  const m = Number(
    d.toLocaleString("en-CA", { timeZone: "Europe/Berlin", month: "2-digit" }),
  );
  const day = Number(
    d.toLocaleString("en-CA", { timeZone: "Europe/Berlin", day: "2-digit" }),
  );
  return { y, m, day };
};
const toISO = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

// Dado el "hoy" en Berlin, calcula lunes y domingo de la semana (en Berlin)
const getBerlinWeekRangeISO = () => {
  const now = new Date();
  const { y, m, day } = getBerlinYMD(now);
  // Construimos una fecha UTC con los componentes "Berlin" para que getUTCDay sea consistente
  const todayUTC = new Date(Date.UTC(y, m - 1, day));
  const dow = todayUTC.getUTCDay(); // 0=Dom, 1=Lun, ... 6=Sáb
  const diffToMonday = dow === 0 ? -6 : 1 - dow; // si Dom -> -6, si Lun -> 0, etc.
  const mondayUTC = new Date(Date.UTC(y, m - 1, day + diffToMonday));
  const sundayUTC = new Date(Date.UTC(y, m - 1, day + diffToMonday + 6));
  const mondayISO = toISO(
    mondayUTC.getUTCFullYear(),
    mondayUTC.getUTCMonth() + 1,
    mondayUTC.getUTCDate(),
  );
  const sundayISO = toISO(
    sundayUTC.getUTCFullYear(),
    sundayUTC.getUTCMonth() + 1,
    sundayUTC.getUTCDate(),
  );
  return { weekStartISO: mondayISO, weekEndISO: sundayISO };
};

const AdminUsersPage = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation("common");

  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<
    "all" | "driver" | "medic" | "both"
  >("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "onLeave" | "onVacation"
  >("all");
  const [vacationFlags, setVacationFlags] = useState<Record<string, VacFlag>>(
    {},
  );
  const [sickFlags, setSickFlags] = useState<Record<string, SickFlag>>({});

  // ✅ Helper UI para vacaciones (usa vacationFlags, t y fmtDDMM centralizado)
  const getVacationUI = (userId: string) => {
    const vf = vacationFlags[userId];
    const has = !!vf?.hasVacationInRange;

    if (!has) return { has: false, title: undefined as string | undefined };

    const fullFrom = vf?.vacationStartFull;
    const fullTo = vf?.vacationUntilFull;

    let title: string | undefined;
    if (fullFrom && fullTo) {
      title = `🏖️  ${t("pages.diensts.weekModals.vacations", "Vacaciones")}: ${fmtDDMM(fullFrom)} → ${fmtDDMM(fullTo)}`;
    } else {
      title = `🏖️  ${t("pages.diensts.weekModals.vacations", "Vacaciones")}`;
    }

    return { has: true, title };
  };

  const fetchUsers = useCallback(async () => {
    try {
      if (!token) return;
      const data = await UsersApi.getAllUsers();

      const sortedUsers = data.sort((a, b) => {
        const aLast = a.lastName || "";
        const bLast = b.lastName || "";
        return aLast.localeCompare(bLast);
      });
      setUsers(sortedUsers);
    } catch (error) {
      console.error(error);
      toastT.error(["toasts.users.loadError"]);
    }
  }, [token]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Cargar flags de vacaciones para la semana actual (Berlin) — con includeFullSpan:true para tooltips FULL
  useEffect(() => {
    if (!token || users.length === 0) {
      setVacationFlags({});
      return;
    }

    const userIds = users.map((u) => u._id).filter(Boolean);
    if (userIds.length === 0) {
      setVacationFlags({});
      return;
    }

    const { weekStartISO, weekEndISO } = getBerlinWeekRangeISO();
    let cancelled = false;

    (async () => {
      try {
        const flags = await getVacationFlagsInRange(token, {
          userIds,
          fromISO: weekStartISO,
          toISO: weekEndISO,
          includeFullSpan: true, // ⬅️ regla de coherencia para tooltips FULL
        });
        if (!cancelled) setVacationFlags(flags);
      } catch (e) {
        console.error(
          "❌ Error al cargar flags de vacaciones (semana actual) en AdminUsersPage:",
          e,
        );
        if (!cancelled) setVacationFlags({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, users]);

  // Bajas por enfermedad: flags para la semana actual (Europe/Berlin), con includeFullSpan=true para tooltips con el tramo completo real.
  useEffect(() => {
    if (!token || users.length === 0) {
      setSickFlags({});
      return;
    }

    const userIds = users.map((u) => u._id).filter(Boolean);
    const { weekStartISO, weekEndISO } = getBerlinWeekRangeISO();

    let cancelled = false;
    (async () => {
      try {
        const flags = await getSickFlagsInRange({
          userIds,
          fromISO: weekStartISO,
          toISO: weekEndISO,
          includeFullSpan: true,
        });
        if (!cancelled) setSickFlags(flags);
      } catch (e) {
        console.error(
          "❌ Error al cargar flags de bajas (semana actual) en AdminUsersPage:",
          e,
        );
        if (!cancelled) setSickFlags({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, users]);

  const handleEdit = (user: User) => {
    navigate(`/admin/user/${user._id}`);
  };


  const filteredUsers = users.filter((user) => {
    const fullName = `${user.name} ${user.lastName}`.toLowerCase();
    const matchesName = fullName.includes(searchTerm.toLowerCase());
    const matchesRole =
      roleFilter === "all" || user.ambulanceRole === roleFilter;

    // 🏖️ vacaciones (semana actual) usando flags
    const vacFlag = vacationFlags[user._id];
    const isOnVacationThisWeek = !!vacFlag?.hasVacationInRange;

    // 🤒 enfermedad (semana actual) usando flags
    const sickFlag = sickFlags[user._id];
    const isOnSickThisWeek = !!sickFlag?.hasSickInRange;

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "onLeave" &&
        (Boolean((user as any).onLeave) || isOnSickThisWeek)) ||
      (statusFilter === "onVacation" &&
        (Boolean((user as any).onVacation) || isOnVacationThisWeek));

    return matchesName && matchesRole && matchesStatus;
  });

  const count = filteredUsers.length;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
        {/* Cabecera */}
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              {t("pages.adminUsers.title")}
            </h1>
            <p className="text-xs text-slate-600">
              {t(
                "pages.adminUsers.subtitle",
                "Gestiona y filtra el listado. Haz clic en una fila para ver/editar.",
              )}
            </p>
          </div>
          <div className="text-xs text-slate-600">
            {t("pages.common.results", "Resultado")}:{" "}
            <span className="font-medium text-slate-800">{count}</span>
          </div>
        </div>

        {/* Barra de filtros */}
        <div className="mb-4 rounded-2xl bg-white/70 backdrop-blur shadow-sm ring-1 ring-slate-200 p-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Búsqueda por nombre */}
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-slate-700">
                {t("pages.adminUsers.search.label")}
              </span>
              <input
                type="text"
                placeholder={t("pages.adminUsers.search.placeholder") || ""}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 shadow-sm outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
              />
            </label>

            {/* Selector visual de rol (centrado) */}
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="text-[11px] font-medium text-slate-700">
                {t("pages.adminUsers.filters.role.label")}
              </span>
              <div className="flex flex-wrap justify-center gap-1.5">
                {(["all", "driver", "medic", "both"] as const).map((value) => {
                  const isActive = roleFilter === value;
                  const baseClasses =
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs md:text-[13px] font-medium transition-colors select-none";

                  const activeClasses =
                    "border-blue-500 bg-blue-50 text-blue-700";
                  const inactiveClasses =
                    "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/60";

                  const label =
                    value === "all"
                      ? t("pages.adminUsers.filters.role.all")
                      : t(`pages.profile.roles.${value}` as any);

                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRoleFilter(value)}
                      className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses
                        }`}
                    >
                      {/* El texto (con o sin emoji) viene de i18n */}
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Filtro de status con iconos de traducción (centrado, sin duplicados) */}
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="text-[11px] font-medium text-slate-700">
                {t("pages.adminUsers.filters.status.label")}
              </span>

              <div className="flex flex-wrap justify-center gap-1.5">
                {(["all", "onLeave", "onVacation"] as const).map((value) => {
                  const isActive = statusFilter === value;
                  const baseClasses =
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs md:text-[13px] font-medium transition-colors select-none";

                  const activeClasses =
                    "border-emerald-500 bg-emerald-50 text-emerald-700";
                  const inactiveClasses =
                    "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/60";

                  const labelKey =
                    value === "all"
                      ? "pages.adminUsers.filters.status.all"
                      : value === "onLeave"
                        ? "pages.adminUsers.filters.status.onLeave"
                        : "pages.adminUsers.filters.status.onVacation";

                  const label = t(labelKey);

                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setStatusFilter(value)}
                      className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
                    >
                      {/* El icono que venga EN el JSON, sin duplicar nada */}
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Leyenda */}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="text-red-500">🚫</span>{" "}
              {t("pages.adminUsers.legend.expired")}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-orange-400">⚠️</span>{" "}
              {t("pages.adminUsers.legend.warning")}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-green-600">🏖️ </span>{" "}
              {t(
                "pages.adminUsers.legend.vacation",
                "Vacaciones (esta semana)",
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-600">🤒</span>{" "}
              {t("pages.adminUsers.legend.sick", "Baja médica (esta semana)")}
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="rounded-2xl bg-white shadow-md ring-1 ring-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 table-fixed">
              <colgroup>
                <col className="w-[32%]" />
                <col className="w-[32%]" />
                <col className="w-[18%]" /> {/* Rol */}
                <col className="w-[18%]" /> {/* Status */}
              </colgroup>
              <thead className="bg-slate-100">
                <tr>
                  <th
                    scope="col"
                    className="py-2.5 px-4 text-center align-middle text-[11px] font-semibold uppercase tracking-wide text-slate-900"
                  >
                    {t("pages.adminUsers.columns.lastName")}
                  </th>
                  <th
                    scope="col"
                    className="py-2.5 px-4 text-center align-middle text-[11px] font-semibold uppercase tracking-wide text-slate-900"
                  >
                    {t("pages.adminUsers.columns.name")}
                  </th>
                  <th
                    scope="col"
                    className="py-2.5 px-4 text-center align-middle text-[11px] font-semibold uppercase tracking-wide text-slate-900"
                  >
                    {t("pages.adminUsers.columns.role")}
                  </th>
                  <th
                    scope="col"
                    className="py-2.5 px-4 text-center align-middle text-[11px] font-semibold uppercase tracking-wide text-slate-900"
                  >
                    {t("pages.adminUsers.columns.status", "Status")}
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredUsers.map((user, index) => {
                  const pschein = getPscheinInfo(user.pscheinExpiry);

                  const firstCellBorder =
                    pschein.status === "expired"
                      ? "border-l-4 border-red-500"
                      : pschein.status === "warning"
                        ? "border-l-4 border-orange-400"
                        : "";

                  const roleKey = (user.ambulanceRole ?? "unknown") as
                    | NonNullable<User["ambulanceRole"]>
                    | "unknown";

                  // Vacaciones (helper) + baja
                  const vacUI = getVacationUI(user._id);
                  const onVac = vacUI.has;

                  const sflag = sickFlags[user._id];
                  const isSick = !!sflag?.hasSickInRange;
                  const sickFromISO =
                    sflag?.sickStartFull || sflag?.sickStartInRange;
                  const sickToISO =
                    sflag?.sickUntilFull || sflag?.sickUntilInRange;
                  const sickTitle = isSick
                    ? sickFromISO && sickToISO
                      ? `🤒 ${t(
                        "pages.sick.tooltip.full",
                        "Baja médica",
                      )}: ${fmtDDMM(sickFromISO)} → ${fmtDDMM(sickToISO)}`
                      : `🤒 ${t("pages.sick.tooltip.full", "Baja médica")}`
                    : undefined;

                  const dimTextClass =
                    onVac || isSick ? "text-slate-400" : "text-slate-900";

                  return (
                    <tr
                      key={user._id}
                      className={`${index % 2 === 0 ? "bg-slate-50/50" : "bg-white"
                        } group cursor-pointer hover:bg-blue-50/50 transition-colors`}
                      onClick={() => handleEdit(user)}
                    >
                      {/* Apellido */}
                      <td
                        className={`whitespace-nowrap py-2 px-4 text-sm text-center align-middle ${dimTextClass} ${firstCellBorder}`}
                      >
                        {user.lastName}
                      </td>

                      {/* Nombre */}
                      <td
                        className={`whitespace-nowrap py-2 px-4 text-sm text-center align-middle ${dimTextClass}`}
                      >
                        {user.name}
                      </td>

                      {/* Rol (píldora pequeña, lineal) */}
                      <td className="py-2 px-4 text-sm text-center align-middle">
                        <span
                          className={`inline-flex items-center justify-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${rolePillClass[roleKey]}`}
                        >
                          {user.ambulanceRole
                            ? t(
                              `pages.profile.roles.${user.ambulanceRole}` as any,
                            )
                            : "—"}
                        </span>
                      </td>

                      {/* Status (solo iconos, centrado y estable) */}
                      <td className="py-2 px-4 text-sm text-center align-middle">
                        <div className="min-w-[80px] mx-auto flex items-center justify-center gap-1.5">
                          {pschein.status === "expired" && (
                            <span
                              className="align-middle text-red-500 text-base leading-none"
                              title={getPscheinWarningTitle(
                                user.pscheinExpiry,
                                t,
                              )}
                            >
                              🚫
                            </span>
                          )}
                          {pschein.status === "warning" && (
                            <span
                              className="align-middle text-orange-400 text-base leading-none"
                              title={getPscheinWarningTitle(
                                user.pscheinExpiry,
                                t,
                              )}
                            >
                              ⚠️
                            </span>
                          )}
                          {onVac && (
                            <span
                              className="align-middle text-slate-400 text-base leading-none"
                              title={vacUI.title}
                            >
                              🏖️
                            </span>
                          )}
                          {isSick && (
                            <span
                              className="align-middle text-slate-500 text-base leading-none"
                              title={sickTitle}
                            >
                              🤒
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminUsersPage;
