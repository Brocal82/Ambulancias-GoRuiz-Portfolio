// frontend/src/pages/AdminUsersPage.tsx
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import * as UsersApi from "../domain/api";
import { useAuth } from "../../../hooks/useAuth";
import type { User } from "../domain/types";
import { toastT } from "../../../utils/toast";
import { getPscheinInfo, getPscheinWarningTitle } from "../../../utils/pscheinUtils";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  getVacationFlagsInRange,
  type VacFlag,
} from "../../vacation/domain/api";
import AdminUserVacationsTab from "../../vacation/components/AdminUserVacationsTab";
import {
  adminListSickLeaves,
  getSickFlagsInRange,
  type SickFlag,
  type SickLeave,
} from "../../sick/domain";
import { fmtDDMM } from "../../../utils/timeUtils";
import { MODULE_KEYS } from "../../../constants/modules";
import {
  AdminManualPraemieQueueColumnHeaders,
  AdminManualPraemieQueueRowBody,
} from "../../praemien/components/AdminManualPraemieQueueRowTable";
import {
  getAdminManualPraemiePendingByUser,
  getAdminManualPraemiePendingEntries,
  pendingListEntryToQueueRowData,
  postAdminManualDailyApprove,
  type AdminManualPraemiePendingListEntry,
} from "../../praemien/domain/manualDailyApi";
import { parseManualPraemieClientValue } from "../../praemien/utils/parseManualPraemieClientValue";
import {
  PRAEMIEN_MANUAL_PENDING_CHANGED,
  dispatchPraemienManualPendingChanged,
} from "../../praemien/utils/praemienManualPendingEvents";
import {
  APP_NAV_MATCH_TABLE_THEAD,
} from "../../../components/ui/appTableHeader";

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
  const { token, role, enabledModules } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, i18n } = useTranslation("common");

  /** Estable por render (no re-crea useCallback a cada frame como `hasModule`). */
  const praemienModuleEnabled = useMemo(
    () =>
      role === "superadmin" ||
      enabledModules === null ||
      enabledModules.includes(MODULE_KEYS.PRAEMIEN),
    [enabledModules, role],
  );
  const vacationModuleEnabled = useMemo(
    () =>
      role === "superadmin" ||
      enabledModules === null ||
      enabledModules.includes(MODULE_KEYS.VACATION),
    [enabledModules, role],
  );
  const sickLeavesModuleEnabled = useMemo(
    () =>
      role === "superadmin" ||
      enabledModules === null ||
      enabledModules.includes(MODULE_KEYS.SICK_LEAVES),
    [enabledModules, role],
  );
  const showStatusFilter = vacationModuleEnabled || sickLeavesModuleEnabled;

  const praemiePendingInitialLoadDoneRef = useRef(false);

  const onlyPraemieManualPending = searchParams.get("praemienPending") === "1";

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
  const [vacationModalUser, setVacationModalUser] = useState<User | null>(null);
  const [sickModalUser, setSickModalUser] = useState<User | null>(null);
  const [sickModalLoading, setSickModalLoading] = useState(false);
  const [sickModalItems, setSickModalItems] = useState<SickLeave[]>([]);
  const [praemiePendingByUser, setPraemiePendingByUser] = useState<
    Map<string, number>
  >(() => new Map());
  const [praemiePendingLoading, setPraemiePendingLoading] = useState(false);
  const [praemiePendingListRows, setPraemiePendingListRows] = useState<
    AdminManualPraemiePendingListEntry[]
  >([]);
  const [praemiePendingListLoading, setPraemiePendingListLoading] =
    useState(false);
  const [praemieListBusyKey, setPraemieListBusyKey] = useState<string | null>(
    null,
  );
  const [rectifyInputByRowKey, setRectifyInputByRowKey] = useState<
    Record<string, string>
  >({});
  const [expandedPraemieRowKey, setExpandedPraemieRowKey] = useState<string | null>(
    null,
  );
  const praemieListInitialLoadDoneRef = useRef(false);

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
    if (onlyPraemieManualPending) return;
    void fetchUsers();
  }, [fetchUsers, onlyPraemieManualPending]);

  const loadPraemiePendingMap = useCallback(async () => {
    if (onlyPraemieManualPending) return;
    if (!token || !praemienModuleEnabled) {
      setPraemiePendingByUser(new Map());
      setPraemiePendingLoading(false);
      praemiePendingInitialLoadDoneRef.current = false;
      return;
    }
    const showBlockingSpinner = !praemiePendingInitialLoadDoneRef.current;
    if (showBlockingSpinner) {
      setPraemiePendingLoading(true);
    }
    try {
      const items = await getAdminManualPraemiePendingByUser();
      const m = new Map<string, number>();
      items.forEach((row) => m.set(row.userId, row.count));
      setPraemiePendingByUser(m);
    } catch (e) {
      console.error("Error al cargar Prämies pendientes (admin users):", e);
      setPraemiePendingByUser(new Map());
    } finally {
      praemiePendingInitialLoadDoneRef.current = true;
      setPraemiePendingLoading(false);
    }
  }, [token, praemienModuleEnabled, onlyPraemieManualPending]);

  const loadPraemiePendingList = useCallback(async () => {
    if (!onlyPraemieManualPending) return;
    if (!token || !praemienModuleEnabled) {
      setPraemiePendingListRows([]);
      setPraemiePendingListLoading(false);
      praemieListInitialLoadDoneRef.current = false;
      return;
    }
    const showBlocking = !praemieListInitialLoadDoneRef.current;
    if (showBlocking) {
      setPraemiePendingListLoading(true);
    }
    try {
      const data = await getAdminManualPraemiePendingEntries();
      setPraemiePendingListRows(data);
    } catch (e) {
      console.error("Error al cargar cola de Prämie manual (admin):", e);
      setPraemiePendingListRows([]);
      toastT.error(["pages.adminUsers.praemiePendingListLoadError"]);
    } finally {
      praemieListInitialLoadDoneRef.current = true;
      setPraemiePendingListLoading(false);
    }
  }, [token, praemienModuleEnabled, onlyPraemieManualPending]);

  useEffect(() => {
    void loadPraemiePendingMap();
  }, [loadPraemiePendingMap]);

  useEffect(() => {
    if (onlyPraemieManualPending) {
      void loadPraemiePendingList();
    } else {
      setPraemiePendingListRows([]);
      praemieListInitialLoadDoneRef.current = false;
    }
  }, [loadPraemiePendingList, onlyPraemieManualPending]);

  useEffect(() => {
    const onChanged = () => {
      if (onlyPraemieManualPending) {
        void loadPraemiePendingList();
      } else {
        void loadPraemiePendingMap();
      }
    };
    window.addEventListener(PRAEMIEN_MANUAL_PENDING_CHANGED, onChanged);
    return () =>
      window.removeEventListener(PRAEMIEN_MANUAL_PENDING_CHANGED, onChanged);
  }, [loadPraemiePendingMap, loadPraemiePendingList, onlyPraemieManualPending]);

  // Cargar flags de vacaciones para la semana actual (Berlin) — con includeFullSpan:true para tooltips FULL
  useEffect(() => {
    if (onlyPraemieManualPending) {
      setVacationFlags({});
      return;
    }
    if (!vacationModuleEnabled) {
      setVacationFlags({});
      return;
    }
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
        const flags = await getVacationFlagsInRange({
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
  }, [token, users, onlyPraemieManualPending, vacationModuleEnabled]);

  // Bajas por enfermedad: flags para la semana actual (Europe/Berlin), con includeFullSpan=true para tooltips con el tramo completo real.
  useEffect(() => {
    if (onlyPraemieManualPending) {
      setSickFlags({});
      return;
    }
    if (!sickLeavesModuleEnabled) {
      setSickFlags({});
      return;
    }
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
  }, [token, users, onlyPraemieManualPending, sickLeavesModuleEnabled]);

  useEffect(() => {
    if (statusFilter === "onVacation" && !vacationModuleEnabled) {
      setStatusFilter("all");
    }
    if (statusFilter === "onLeave" && !sickLeavesModuleEnabled) {
      setStatusFilter("all");
    }
  }, [statusFilter, vacationModuleEnabled, sickLeavesModuleEnabled]);

  const handleEdit = (user: User) => {
    navigate(`/admin/user/${user._id}`);
  };

  const handleOpenVacationModal = (user: User) => {
    setVacationModalUser(user);
  };

  const handleOpenSickModal = async (user: User) => {
    if (!token) return;
    setSickModalUser(user);
    setSickModalLoading(true);
    setSickModalItems([]);
    try {
      const allSickLeaves = await adminListSickLeaves();
      const byUser = (allSickLeaves as SickLeave[])
        .filter((it) => {
          const sickUser = it.user as SickLeave["user"];
          const uid = typeof sickUser === "string" ? sickUser : sickUser?._id;
          return uid === user._id;
        })
        .sort((a, b) => {
          const aTime = new Date(a.createdAt || a.startDate).getTime();
          const bTime = new Date(b.createdAt || b.startDate).getTime();
          return bTime - aTime;
        });
      setSickModalItems(byUser);
    } catch (error) {
      console.error(error);
      toastT.error(["pages.adminUsers.modals.sick.loadError"]);
      setSickModalItems([]);
    } finally {
      setSickModalLoading(false);
    }
  };

  const rowPraemieKey = (r: { userId: string; date: string }) =>
    `${r.userId}|${r.date}`;

  const clearPraemieRowDrafts = (k: string) => {
    setRectifyInputByRowKey((prev) => {
      const next = { ...prev };
      delete next[k];
      return next;
    });
    setExpandedPraemieRowKey((prev) => (prev === k ? null : prev));
  };

  const togglePraemieRowExpanded = (k: string) => {
    setExpandedPraemieRowKey((prev) => (prev === k ? null : k));
  };

  const handlePraemieListApproveAsWorker = async (
    row: AdminManualPraemiePendingListEntry,
  ) => {
    const k = rowPraemieKey(row);
    const rawRectify = (rectifyInputByRowKey[k] ?? "").trim();
    let approveBody: Parameters<typeof postAdminManualDailyApprove>[0] = {
      userId: row.userId,
      date: row.date,
    };
    if (rawRectify !== "") {
      const parsed = parseManualPraemieClientValue(rawRectify);
      if (!parsed.ok) {
        toastT.error(t("pages.praemien.adminManual.invalidCorrect"));
        return;
      }
      approveBody = { ...approveBody, adminFinalValue: parsed.value };
    }
    setPraemieListBusyKey(k);
    try {
      await postAdminManualDailyApprove(approveBody);
      toastT.success(["pages.adminUsers.praemiePendingListApproveSuccess"]);
      dispatchPraemienManualPendingChanged();
      clearPraemieRowDrafts(k);
      await loadPraemiePendingList();
    } catch (e) {
      console.error(e);
      toastT.error(["pages.adminUsers.praemiePendingListApproveError"]);
    } finally {
      setPraemieListBusyKey(null);
    }
  };

  const filteredUsers =
    onlyPraemieManualPending && praemienModuleEnabled
      ? []
      : users.filter((user) => {
    const fullName = `${user.name} ${user.lastName}`.toLowerCase();
    const matchesName = fullName.includes(searchTerm.toLowerCase());
    const matchesRole =
      roleFilter === "all" || user.ambulanceRole === roleFilter;

    // 🏖️ vacaciones (semana actual) usando flags
    const vacFlag = vacationFlags[user._id];
    const isOnVacationThisWeek =
      vacationModuleEnabled && !!vacFlag?.hasVacationInRange;

    // 🤒 enfermedad (semana actual) usando flags
    const sickFlag = sickFlags[user._id];
    const isOnSickThisWeek = sickLeavesModuleEnabled && !!sickFlag?.hasSickInRange;

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "onLeave" &&
        sickLeavesModuleEnabled &&
        (Boolean((user as any).onLeave) || isOnSickThisWeek)) ||
      (statusFilter === "onVacation" &&
        vacationModuleEnabled &&
        (Boolean((user as any).onVacation) || isOnVacationThisWeek));

    const matchesPraemie =
      !onlyPraemieManualPending ||
      !praemienModuleEnabled ||
      praemiePendingByUser.has(user._id);

    return matchesName && matchesRole && matchesStatus && matchesPraemie;
  });

  const count = filteredUsers.length;

  const isPraemieQueueView = onlyPraemieManualPending && praemienModuleEnabled;

  if (isPraemieQueueView) {
    return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto min-w-0 max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
        <div className="mb-4">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            {t("pages.adminUsers.titlePraemiePendingQueue")}
          </h1>
          <p className="mt-1 text-xs text-slate-600">
            {t("pages.praemien.adminManual.queueExpandHint")}
          </p>
        </div>

        <div className="min-w-0 rounded-2xl bg-white shadow-md ring-1 ring-slate-200 overflow-hidden">
          {praemiePendingListLoading && praemiePendingListRows.length === 0 ? (
            <p className="p-6 text-sm text-slate-600">
              {t("pages.adminUsers.praemiePendingBannerLoading")}
            </p>
          ) : praemiePendingListRows.length === 0 ? (
            <p className="p-6 text-sm text-slate-600">
              {t("pages.adminUsers.praemiePendingListEmpty")}
            </p>
          ) : (
            <div className="min-w-0">
              <div
                className="w-full min-w-0 text-xs"
                role="region"
                aria-label={t("pages.adminUsers.titlePraemiePendingQueue")}
              >
                <AdminManualPraemieQueueColumnHeaders />
                {praemiePendingListRows.map((row) => {
                  const k = rowPraemieKey(row);
                  const qRow = pendingListEntryToQueueRowData(row);
                  return (
                    <AdminManualPraemieQueueRowBody
                      key={k}
                      row={qRow}
                      rectifyInput={rectifyInputByRowKey[k] ?? ""}
                      onRectifyChange={(value) =>
                        setRectifyInputByRowKey((prev) => ({ ...prev, [k]: value }))
                      }
                      onApprove={() => void handlePraemieListApproveAsWorker(row)}
                      busy={praemieListBusyKey === k}
                      onReopen={() => {}}
                      expandable
                      expanded={expandedPraemieRowKey === k}
                      onToggleExpand={() => togglePraemieRowExpanded(k)}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
        {/* Cabecera */}
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              {onlyPraemieManualPending && praemienModuleEnabled
                ? t("pages.adminUsers.titlePraemiePendingFilter")
                : t("pages.adminUsers.title")}
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

        {onlyPraemieManualPending && praemienModuleEnabled && (
          <div className="mb-4 flex flex-col gap-2 rounded-xl border border-orange-200 bg-orange-50/90 px-4 py-3 ring-1 ring-orange-200/80 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-orange-950">
              {praemiePendingLoading
                ? t("pages.adminUsers.praemiePendingBannerLoading")
                : t("pages.adminUsers.praemiePendingBanner", {
                    count: praemiePendingByUser.size,
                  })}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg border border-orange-300 bg-white px-3 py-1.5 text-xs font-medium text-orange-900 shadow-sm hover:bg-orange-100/80"
                onClick={() => {
                  setSearchParams((prev) => {
                    const next = new URLSearchParams(prev);
                    next.delete("praemienPending");
                    return next;
                  });
                }}
              >
                {t("pages.adminUsers.praemiePendingShowAll")}
              </button>
            </div>
          </div>
        )}

        {/* Barra de filtros */}
        <div
          className={`mb-4 rounded-2xl bg-white/70 backdrop-blur p-3 shadow-sm ring-1 ${
            onlyPraemieManualPending && praemienModuleEnabled
              ? "ring-2 ring-orange-200"
              : "ring-slate-200"
          }`}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
                className="h-9 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 shadow-sm outline-none transition focus:border-orange-300 focus-visible:ring-1 focus-visible:ring-orange-200/60"
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
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs md:text-[13px] font-medium transition select-none";

                  const activeClasses =
                    "border-orange-300 bg-blue-50 text-slate-900 shadow-sm";
                  const inactiveClasses =
                    "border-transparent bg-white text-slate-700 shadow hover:shadow-md hover:bg-blue-50 hover:border-orange-300";

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

            {/* Filtro de status condicional a módulos de bajas/vacaciones */}
            {showStatusFilter && (
              <div className="flex flex-col items-center gap-1 text-center">
                <span className="text-[11px] font-medium text-slate-700">
                  {t("pages.adminUsers.filters.status.label")}
                </span>

                <div className="flex flex-wrap justify-center gap-1.5">
                  {(
                    [
                      "all",
                      ...(sickLeavesModuleEnabled ? (["onLeave"] as const) : []),
                      ...(vacationModuleEnabled ? (["onVacation"] as const) : []),
                    ] as const
                  ).map((value) => {
                    const isActive = statusFilter === value;
                    const baseClasses =
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs md:text-[13px] font-medium transition select-none";

                    const activeClasses =
                      "border-orange-300 bg-blue-50 text-slate-900 shadow-sm";
                    const inactiveClasses =
                      "border-transparent bg-white text-slate-700 shadow hover:shadow-md hover:bg-blue-50 hover:border-orange-300";

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
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {praemienModuleEnabled && (
            <div className="mt-3 flex flex-col items-center gap-1 border-t border-slate-200 pt-3">
              <span className="text-[11px] font-medium text-slate-700">
                {t("pages.adminUsers.filters.praemienManual.label")}
              </span>
              <div className="flex flex-wrap justify-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSearchParams((prev) => {
                      const next = new URLSearchParams(prev);
                      next.delete("praemienPending");
                      return next;
                    });
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors select-none md:text-[13px] ${
                    !onlyPraemieManualPending
                      ? "border-orange-400 bg-orange-50 text-orange-900"
                      : "border-slate-200 bg-white text-slate-700 hover:border-orange-200 hover:bg-orange-50/50"
                  }`}
                >
                  {t("pages.adminUsers.filters.praemienManual.all")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSearchParams((prev) => {
                      const next = new URLSearchParams(prev);
                      next.set("praemienPending", "1");
                      return next;
                    });
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors select-none md:text-[13px] ${
                    onlyPraemieManualPending
                      ? "border-orange-400 bg-orange-50 text-orange-900 ring-1 ring-orange-200"
                      : "border-slate-200 bg-white text-slate-700 hover:border-orange-200 hover:bg-orange-50/50"
                  }`}
                >
                  {t("pages.adminUsers.filters.praemienManual.pendingOnly")}
                </button>
              </div>
            </div>
          )}

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
              <span className="text-slate-600">❓</span>{" "}
              {t(
                "pages.adminUsers.legend.noPscheinDate",
                "No P-Schein date (driver / both)",
              )}
            </div>
            {vacationModuleEnabled && (
              <div className="flex items-center gap-1.5">
                <span className="text-green-600">🏖️ </span>{" "}
                {t(
                  "pages.adminUsers.legend.vacation",
                  "Vacaciones (esta semana)",
                )}
              </div>
            )}
            {sickLeavesModuleEnabled && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-600">🤒</span>{" "}
                {t("pages.adminUsers.legend.sick", "Baja médica (esta semana)")}
              </div>
            )}
            {praemienModuleEnabled && (
              <div className="flex items-center gap-1.5">
                <span className="text-orange-500" aria-hidden>
                  🎖
                </span>
                {t("pages.adminUsers.legend.praemiePendingDays")}
              </div>
            )}
          </div>
        </div>

        {/* Tabla */}
        <div className="rounded-2xl bg-white shadow-md ring-1 ring-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 table-fixed">
              <colgroup>
                <col className="w-[22%]" />
                <col className="w-[20%]" />
                <col className="w-[12%]" /> {/* Nº trabajador */}
                <col className="w-[14%]" /> {/* Rol */}
                <col className="w-[14%]" /> {/* Status */}
                {vacationModuleEnabled && <col className="w-[9%]" />} {/* Vacaciones */}
                {sickLeavesModuleEnabled && <col className="w-[9%]" />} {/* Bajas */}
              </colgroup>
              <thead className={APP_NAV_MATCH_TABLE_THEAD}>
                <tr>
                  <th
                    scope="col"
                    className="py-2.5 px-4 text-center align-middle text-[11px] font-semibold uppercase tracking-wide text-slate-200"
                  >
                    {t("pages.adminUsers.columns.lastName")}
                  </th>
                  <th
                    scope="col"
                    className="py-2.5 px-4 text-center align-middle text-[11px] font-semibold uppercase tracking-wide text-slate-200"
                  >
                    {t("pages.adminUsers.columns.name")}
                  </th>
                  <th
                    scope="col"
                    className="py-2.5 px-4 text-center align-middle text-[11px] font-semibold uppercase tracking-wide text-slate-200"
                  >
                    {t("pages.adminUsers.columns.employeeNumber", "Nº trabajador")}
                  </th>
                  <th
                    scope="col"
                    className="py-2.5 px-4 text-center align-middle text-[11px] font-semibold uppercase tracking-wide text-slate-200"
                  >
                    {t("pages.adminUsers.columns.role")}
                  </th>
                  <th
                    scope="col"
                    className="py-2.5 px-4 text-center align-middle text-[11px] font-semibold uppercase tracking-wide text-slate-200"
                  >
                    {t("pages.adminUsers.columns.status", "Status")}
                  </th>
                  {vacationModuleEnabled && (
                    <th
                      scope="col"
                      className="py-2.5 px-4 text-center align-middle text-[11px] font-semibold uppercase tracking-wide text-slate-200"
                    >
                      {t("pages.adminUsers.columns.vacations", "Vacaciones")}
                    </th>
                  )}
                  {sickLeavesModuleEnabled && (
                    <th
                      scope="col"
                      className="py-2.5 px-4 text-center align-middle text-[11px] font-semibold uppercase tracking-wide text-slate-200"
                    >
                      {t("pages.adminUsers.columns.sickLeaves", "Bajas")}
                    </th>
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredUsers.map((user, index) => {
                  const pschein = getPscheinInfo(user.pscheinExpiry);
                  const showMissingPscheinDate =
                    (user.ambulanceRole === "driver" ||
                      user.ambulanceRole === "both") &&
                    pschein.status === "no-date";

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
                  const vacUI = vacationModuleEnabled
                    ? getVacationUI(user._id)
                    : { has: false, title: undefined as string | undefined };
                  const onVac = vacUI.has;

                  const sflag = sickLeavesModuleEnabled ? sickFlags[user._id] : undefined;
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

                      {/* Nº trabajador */}
                      <td
                        className={`whitespace-nowrap py-2 px-4 text-sm text-center align-middle ${dimTextClass}`}
                      >
                        {user.employeeNumber?.trim() || "—"}
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
                          {praemienModuleEnabled &&
                            (() => {
                              const pc = praemiePendingByUser.get(user._id);
                              if (!pc) return null;
                              return (
                                <span
                                  className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-orange-900 ring-1 ring-orange-200"
                                  title={t(
                                    "pages.adminUsers.praemiePendingDaysTooltip",
                                    { count: pc },
                                  )}
                                >
                                  {pc}
                                </span>
                              );
                            })()}
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
                          {showMissingPscheinDate && (
                            <span
                              className="align-middle text-slate-600 text-base leading-none"
                              title={t(
                                "pages.adminUsers.noPscheinDateTitle",
                                "P-Schein expiry date not set",
                              )}
                            >
                              ❓
                            </span>
                          )}
                          {vacationModuleEnabled && onVac && (
                            <span
                              className="align-middle text-slate-400 text-base leading-none"
                              title={vacUI.title}
                            >
                              🏖️
                            </span>
                          )}
                          {sickLeavesModuleEnabled && isSick && (
                            <span
                              className="align-middle text-slate-500 text-base leading-none"
                              title={sickTitle}
                            >
                              🤒
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Vacaciones (histórico en modal) */}
                      {vacationModuleEnabled && (
                        <td className="py-2 px-4 text-sm text-center align-middle">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleOpenVacationModal(user);
                            }}
                            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-100"
                            title={t(
                              "pages.adminUsers.modals.vacations.open",
                              "Ver historial de vacaciones",
                            )}
                          >
                            {t("pages.adminUsers.columns.view", "Ver")}
                          </button>
                        </td>
                      )}

                      {/* Bajas (histórico en modal) */}
                      {sickLeavesModuleEnabled && (
                        <td className="py-2 px-4 text-sm text-center align-middle">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              void handleOpenSickModal(user);
                            }}
                            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-100"
                            title={t(
                              "pages.adminUsers.modals.sick.open",
                              "Ver historial de bajas",
                            )}
                          >
                            {t("pages.adminUsers.columns.view", "Ver")}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal: Vacaciones por trabajador */}
      {vacationModuleEnabled && vacationModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">
                {t("pages.adminUsers.modals.vacations.title", {
                  name: `${vacationModalUser.lastName} ${vacationModalUser.name}`,
                })}
              </h2>
              <button
                type="button"
                onClick={() => setVacationModalUser(null)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {t("pages.adminUsers.modals.close", "Cerrar")}
              </button>
            </div>

            <div className="max-h-[65vh] overflow-auto p-4">
              <AdminUserVacationsTab userId={vacationModalUser._id} />
            </div>
          </div>
        </div>
      )}

      {/* Modal: Bajas por trabajador */}
      {sickLeavesModuleEnabled && sickModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">
                {t("pages.adminUsers.modals.sick.title", {
                  name: `${sickModalUser.lastName} ${sickModalUser.name}`,
                })}
              </h2>
              <button
                type="button"
                onClick={() => setSickModalUser(null)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {t("pages.adminUsers.modals.close", "Cerrar")}
              </button>
            </div>

            <div className="max-h-[65vh] overflow-auto p-4">
              {sickModalLoading ? (
                <p className="text-sm text-slate-600">
                  {t("pages.adminUsers.modals.loading", "Cargando...")}
                </p>
              ) : sickModalItems.length === 0 ? (
                <p className="text-sm text-slate-600">
                  {t(
                    "pages.adminUsers.modals.sick.empty",
                    "No hay bajas registradas para este trabajador.",
                  )}
                </p>
              ) : (
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">
                        {t("pages.adminUsers.modals.columns.from", "Desde")}
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">
                        {t("pages.adminUsers.modals.columns.to", "Hasta")}
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">
                        {t("pages.adminUsers.modals.columns.status", "Estado")}
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">
                        {t("pages.adminUsers.modals.columns.created", "Creada")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sickModalItems.map((item) => (
                      <tr key={item._id}>
                        <td className="px-3 py-2 text-slate-800">
                          {fmtDDMM(item.startDate)}
                        </td>
                        <td className="px-3 py-2 text-slate-800">
                          {fmtDDMM(item.endDate)}
                        </td>
                        <td className="px-3 py-2 text-slate-800">
                          {t(`pages.sick.status.${item.status}`, item.status)}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {new Date(item.createdAt).toLocaleDateString(i18n.language)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsersPage;
