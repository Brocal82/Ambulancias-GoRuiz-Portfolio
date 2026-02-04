// frontend/src/pages/AdminDienstsPage.tsx
import { useCallback, useEffect, useState } from "react";
import type { Dienst } from "../modules/diensts";
import {
  getAllDiensts,
  generateDienstsForWeek,
  deleteDienstsForWeek,
  assignTeamToWeek,
  assignUserToWeek,
  clearPeopleForWeek,
  swapWeekRoles,
} from "../modules/diensts";
import AssignmentModal from "../components/AssignmentModal";
import TeamAssignModal from "../components/diensts/TeamAssignModal";
import UserAssignModal from "../components/diensts/UserAssignModal";
import {
  formatAmbulanceLabel,
  formatPersonLabel,
  getWeekStartsBerlin,
  getWeekDays,
} from "../modules/diensts/utils";
import { dayKeyToLocalDate, toBerlinDayKey } from "../utils/dates/dayKey";
import { isPastDay } from "../utils/dates/isPastDay";
import { isTeamIncomplete } from "../utils/assignmentUtils";
import { useAuth } from "../hooks/useAuth";
import { useTranslation } from "react-i18next";
import { toastT } from "../utils/toast";
import { getPscheinInfo, getPscheinWarningTitle } from "../utils/pscheinUtils";
import { formatCellDateUnified } from "../utils/timeUtils";
import type { FlexibleAssignment } from "../types/assignment";
import { DienstDayCell, WeekBlock, WEEK_GRID_CLASS } from "../modules/diensts/components";
import { getAssignmentStatus, getStatusClass } from "../modules/diensts/utils";
import { toFlexibleFromDienstAssignment } from "../modules/diensts/assignments";

const AdminPage = () => {
  const [diensts, setDiensts] = useState<Dienst[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState<{
    date: string;
    assignment?: FlexibleAssignment;
    dienstId: string;
  } | null>(null);

  // ⬇️ estado local para el modal de asignar Team a la semana
  const [weekTeamModal, setWeekTeamModal] = useState<{
    open: boolean;
    dienstNumber: number;
    weekStartISO: string;
  } | null>(null);

  const [weekUserModal, setWeekUserModal] = useState<{
    open: boolean;
    weekStartISO: string;
    dienstNumber: number;
  } | null>(null);

  // Estado para colapsar/desplegar semanas (key = weekStartISO)
  const [collapsedWeeks, setCollapsedWeeks] = useState<Record<string, boolean>>(
    {},
  );

  const { token } = useAuth();
  const { t, i18n } = useTranslation();

  const fmtDate = (d: Date) => d.toLocaleDateString(i18n.language);

  const toggleWeekCollapsed = (weekKey: string) => {
    setCollapsedWeeks((prev) => ({
      ...prev,
      [weekKey]: !prev[weekKey],
    }));
  };

  const fetchDiensts = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getAllDiensts(token);

      // ✅ Nos quedamos con todos los Diensts con número >= 1
      //    y los ordenamos por número ascendente.
      const normalized = data
        .filter(
          (d) => typeof d.dienstNumber === "number" && d.dienstNumber >= 1,
        )
        .sort((a, b) => a.dienstNumber - b.dienstNumber);

      setDiensts(normalized);
    } catch (error) {
      console.error("Error al obtener los diensts:", error);
    } finally {
      setIsInitialLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchDiensts();
  }, [fetchDiensts]);

  const weekStartKeys = getWeekStartsBerlin(3);

  return (
    <div className="min-h-[400px]">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {t("pages.diensts.adminPage.title")}
        </h1>
      </div>

      {isInitialLoading ? (
        <div className="mb-6 rounded-xl bg-white ring-1 ring-slate-200 p-4 text-sm text-slate-600">
          Cargando diensts...
        </div>
      ) : (
        weekStartKeys.map((weekStartISO) => {
          const weekStart = dayKeyToLocalDate(weekStartISO);

          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);

          const isCollapsed = collapsedWeeks[weekStartISO] ?? false;
          const hasWeekDiensts = diensts.some((d) => {
            if (!d.weekStartDate) return false;
            return toBerlinDayKey(d.weekStartDate) === weekStartISO;
          });

          const title = t("pages.diensts.adminPage.weekRange", {
            from: fmtDate(weekStart),
            to: fmtDate(weekEnd),
          });

          return (
            <WeekBlock
              key={weekStartISO}

              title={title}
              withGrid={false}
              showTitle={false}
              className="mb-8"
            >

              {/* Header de semana */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
                {hasWeekDiensts ? (
                  // Si hay Diensts: header clicable con flecha 🔼 / 🔽
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900 focus:outline-none"
                    onClick={() => toggleWeekCollapsed(weekStartISO)}
                    aria-expanded={!isCollapsed}
                  >
                    <span>{title}</span>
                    <span className="text-xs">{isCollapsed ? "🔽" : "🔼"}</span>
                  </button>
                ) : (
                  // Si NO hay Diensts: solo texto, sin flecha y sin onClick
                  <h2 className="text-sm font-medium text-slate-700">{title}</h2>
                )}

                <div className="flex flex-wrap gap-2">
                  {/* Mostrar botón Crear solo si NO existen Diensts esa semana */}
                  {!hasWeekDiensts && (
                    <button
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
                      onClick={async () => {
                        const confirmCreate = confirm(
                          t("pages.diensts.adminPage.confirmCreate", {
                            date: fmtDate(weekStart),
                          }),
                        );
                        if (!confirmCreate || !token) return;

                        try {
                          await generateDienstsForWeek(weekStartISO, token);
                          toastT.success([
                            "pages.diensts.adminPage.alerts.createOk",
                          ]);
                          fetchDiensts();
                        } catch (err) {
                          console.error("Error al crear plantillas:", err);
                          toastT.error([
                            "pages.diensts.adminPage.alerts.createErr",
                          ]);
                        }
                      }}
                    >
                      {t("pages.diensts.adminPage.actions.create")}
                    </button>
                  )}

                  {/* Mostrar botón Borrar solo si EXISTEN Diensts esa semana */}
                  {hasWeekDiensts && (
                    <button
                      className="inline-flex items-center gap-2 rounded-lg bg-rose-500/90 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-200 transition-colors"
                      onClick={async () => {
                        const confirmDelete = confirm(
                          t("pages.diensts.adminPage.confirmDelete", {
                            date: fmtDate(weekStart),
                          }),
                        );
                        if (!confirmDelete || !token) return;

                        try {
                          await deleteDienstsForWeek(weekStartISO, token);
                          toastT.success([
                            "pages.diensts.adminPage.alerts.deleteOk",
                          ]);
                          fetchDiensts();
                        } catch (err) {
                          console.error("Error al eliminar diensts:", err);
                          toastT.error([
                            "pages.diensts.adminPage.alerts.deleteErr",
                          ]);
                        }
                      }}
                    >
                      {t("pages.diensts.adminPage.actions.delete")}
                    </button>
                  )}
                </div>
              </div>

              {/* Listado de diensts de esa semana */}
              {!isCollapsed && (
                <>
                  {diensts
                    .filter((dienst) => {
                      if (!dienst.weekStartDate) return false;
                      return (
                        toBerlinDayKey(dienst.weekStartDate) === weekStartISO
                      );
                    })
                    .map((dienst) => {
                      const weekDates = getWeekDays(weekStartISO);

                      // ✅ Mostrar swap/clear solo si hay alguien asignado en la semana
                      const hasAnyPersonAssigned =
                        Array.isArray(dienst.assignments) &&
                        dienst.assignments.some(
                          (a) =>
                            a?.date &&
                            a?.startTime &&
                            a?.endTime &&
                            (a.driver || a.medic),
                        );

                      return (
                        <div
                          key={`${weekStart.toISOString()}-${dienst.dienstNumber}`}
                          className="mb-6"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-medium text-slate-800">
                              {t("pages.diensts.adminPage.dienstLabel", {
                                num: dienst.dienstNumber,
                              })}
                            </p>

                            {/* Grupo de iconos de acciones */}
                            <div className="flex items-center gap-3">
                              {/* 👤 Asignar un trabajador (siempre visible) */}
                              <button
                                className="flex items-center justify-center w-6 h-6 text-slate-600 hover:text-slate-900 transition-transform transform hover:scale-110 focus:outline-none"
                                title={t(
                                  "pages.diensts.adminPage.assignUserToWeek",
                                )}
                                onClick={() =>
                                  setWeekUserModal({
                                    open: true,
                                    dienstNumber: dienst.dienstNumber,
                                    weekStartISO,
                                  })
                                }
                              >
                                <span
                                  aria-hidden
                                  className="block text-[16px] leading-none translate-y-[1px] scale-[0.95]"
                                >
                                  👤
                                </span>
                                <span className="sr-only">
                                  {t("pages.diensts.adminPage.assignUserToWeek")}
                                </span>
                              </button>

                              {/* 👥 Asignar pareja (siempre visible) */}
                              <button
                                className="flex items-center justify-center w-6 h-6 text-slate-600 hover:text-slate-900 transition-transform transform hover:scale-110 focus:outline-none"
                                title={t(
                                  "pages.diensts.adminPage.assignTeamToWeek",
                                )}
                                onClick={() =>
                                  setWeekTeamModal({
                                    open: true,
                                    dienstNumber: dienst.dienstNumber,
                                    weekStartISO,
                                  })
                                }
                              >
                                <span
                                  aria-hidden
                                  className="block text-[18px] leading-none -translate-y-[1px] scale-[1.12]"
                                >
                                  👥
                                </span>
                                <span className="sr-only">
                                  {t("pages.diensts.adminPage.assignTeamToWeek")}
                                </span>
                              </button>

                              {/* ⇅ Intercambiar roles (solo si hay alguien asignado) */}
                              {hasAnyPersonAssigned && (
                                <button
                                  className="flex items-center justify-center w-6 h-6 text-slate-600 hover:text-slate-900 transition-transform transform hover:scale-110 focus:outline-none"
                                  title={t(
                                    "pages.diensts.adminPage.swapRolesWeek",
                                  )}
                                  onClick={async () => {
                                    if (!token) return;
                                    const ok = confirm(
                                      t("pages.diensts.adminPage.confirmSwap", {
                                        num: dienst.dienstNumber,
                                        date: fmtDate(weekStart),
                                      }) as string,
                                    );
                                    if (!ok) return;

                                    try {
                                      await swapWeekRoles(
                                        {
                                          dienstNumber: dienst.dienstNumber,
                                          weekStartDate: weekStartISO,
                                        },
                                        token,
                                      );
                                      toastT.success([
                                        "pages.diensts.adminPage.swapWeekOk",
                                      ]);
                                      fetchDiensts();
                                    } catch (err: any) {
                                      const code = err?.response?.data?.code as
                                        | string
                                        | undefined;

                                      if (code === "swap_not_permitted") {
                                        toastT.error([
                                          "pages.diensts.adminPage.swapWeekNotPermitted",
                                        ]);
                                        console.warn(
                                          "⚠️ swap_not_permitted details:",
                                          err?.response?.data?.details,
                                        );
                                      } else {
                                        console.error(
                                          "❌ Error en swapWeekRoles:",
                                          err,
                                        );
                                        toastT.error([
                                          "pages.diensts.adminPage.swapWeekErr",
                                        ]);
                                      }
                                    }
                                  }}
                                >
                                  <span
                                    aria-hidden
                                    className="block text-[16px] leading-none translate-y-[1px]"
                                  >
                                    ⇅
                                  </span>
                                  <span className="sr-only">
                                    {t("pages.diensts.adminPage.swapRolesWeek")}
                                  </span>
                                </button>
                              )}

                              {/* 🧽 Limpiar asignaciones (solo si hay alguien asignado) */}
                              {hasAnyPersonAssigned && (
                                <button
                                  className="flex items-center justify-center w-6 h-6 text-slate-600 hover:text-rose-700 transition-transform transform hover:scale-110 focus:outline-none"
                                  title={t(
                                    "pages.diensts.adminPage.clearWeekPeople",
                                  )}
                                  onClick={async () => {
                                    if (!token) return;
                                    const ok = confirm(
                                      t("pages.diensts.adminPage.confirmClear", {
                                        num: dienst.dienstNumber,
                                        date: fmtDate(weekStart),
                                      }) as string,
                                    );
                                    if (!ok) return;

                                    try {
                                      await clearPeopleForWeek(
                                        {
                                          dienstNumber: dienst.dienstNumber,
                                          weekStartDate: weekStartISO,
                                        },
                                        token,
                                      );
                                      toastT.success([
                                        "pages.diensts.adminPage.clearOk",
                                      ]);
                                      fetchDiensts();
                                    } catch (err) {
                                      console.error(err);
                                      toastT.error([
                                        "pages.diensts.adminPage.clearErr",
                                      ]);
                                    }
                                  }}
                                >
                                  <span
                                    aria-hidden
                                    className="block text-[17px] leading-none translate-y-[0.5px]"
                                  >
                                    🧽
                                  </span>
                                  <span className="sr-only">
                                    {t("pages.diensts.adminPage.clearWeekPeople")}
                                  </span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Grid de 7 días */}
                          <div className={WEEK_GRID_CLASS}>
                            {weekDates.map((day) => {
                              const assignment = dienst.assignments.find(
                                (a) => a.date === day,
                              );
                              const status = getAssignmentStatus(assignment);
                              const cls = getStatusClass(status);

                              const incompleteBorderClass =
                                assignment && isTeamIncomplete(assignment)
                                  ? "border-2 border-red-500"
                                  : "border border-transparent";

                              const isPast = isPastDay(day);

                              const dateLine = formatCellDateUnified(day, i18n.language);
                              const freeLine = `🌴 ${t("pages.diensts.adminPage.freeDay")}`;


                              return (
                                <DienstDayCell
                                  key={day}
                                  dayISO={day}
                                  statusClass={cls}
                                  incompleteBorderClass={incompleteBorderClass}
                                  isPast={isPast}
                                  onOpen={() => {
                                    setSelectedAssignment({
                                      date: day,
                                      assignment: toFlexibleFromDienstAssignment(assignment as any),

                                      dienstId: dienst._id,
                                    });
                                  }}
                                  lines={{
                                    dateLine,

                                    ...(assignment
                                      ? {
                                        timeLine: `🕒 ${assignment.startTime} - ${assignment.endTime}`,
                                        ambulanceLine: `🚑 ${formatAmbulanceLabel(
                                          assignment?.ambulanceId,
                                        )}`,
                                        driverLine: (
                                          <>
                                            👨‍✈️{" "}
                                            {(() => {
                                              let drvClass = "";
                                              let drvTitle:
                                                | string
                                                | undefined;

                                              if (
                                                typeof assignment.driver ===
                                                "object" &&
                                                assignment.driver
                                              ) {
                                                const info = getPscheinInfo(
                                                  (assignment.driver as any)
                                                    .pscheinExpiry,
                                                );
                                                if (info.status === "expired") {
                                                  drvClass =
                                                    "text-red-600 font-medium";
                                                } else if (
                                                  info.status === "warning"
                                                ) {
                                                  drvClass =
                                                    "text-amber-600 font-medium";
                                                }
                                                drvTitle =
                                                  getPscheinWarningTitle(
                                                    (assignment.driver as any)
                                                      .pscheinExpiry,
                                                    t as any,
                                                  ) || undefined;
                                              }

                                              return (
                                                <span
                                                  className={drvClass}
                                                  title={drvTitle}
                                                >
                                                  {formatPersonLabel(
                                                    assignment?.driver,
                                                  )}
                                                </span>
                                              );
                                            })()}
                                          </>
                                        ),
                                        medicLine: `🧑‍⚕️ ${formatPersonLabel(
                                          assignment?.medic,
                                        )}`,
                                      }
                                      : {
                                        ambulanceLine: freeLine,
                                      }
                                    ),
                                  }}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                </>
              )}
            </WeekBlock>
          );
        })
      )}

      {selectedAssignment && (
        <AssignmentModal
          isOpen={true}
          date={selectedAssignment.date}
          assignment={selectedAssignment.assignment}
          dienstId={selectedAssignment.dienstId}
          onClose={() => setSelectedAssignment(null)}
          onUpdate={fetchDiensts}
        />
      )}

      {/* Modal Team semana */}
      {weekTeamModal?.open && (
        <TeamAssignModal
          isOpen={true}
          onClose={() => setWeekTeamModal(null)}
          onConfirm={async (teamId: string, resolvedRoles) => {
            if (!token || !weekTeamModal) return;
            try {
              const resp = await assignTeamToWeek(
                {
                  dienstNumber: weekTeamModal.dienstNumber,
                  weekStartDate: weekTeamModal.weekStartISO,
                  teamId,
                  resolvedRoles,
                },
                token,
              );

              toastT.success(["pages.diensts.adminPage.assignWeekOk"]);

              if (resp?.hints?.driverExpiredButBoth) {
                toastT.info(["pages.diensts.adminPage.considerSwap"]);
              }

              setWeekTeamModal(null);
              fetchDiensts();
            } catch (err: any) {
              const code = err?.response?.data?.code as string | undefined;
              const details = err?.response?.data?.details;

              if (code === "pschein_expired") {
                toastT.error(["pages.diensts.adminPage.errors.pscheinExpired"]);
              } else if (code === "weekly_conflict") {
                let driverDates = "";
                let medicDates = "";

                if (Array.isArray(details)) {
                  driverDates = details
                    .filter((d: any) => d?.role === "driver")
                    .map((d: any) => d?.date)
                    .filter(Boolean)
                    .join(", ");
                  medicDates = details
                    .filter((d: any) => d?.role === "medic")
                    .map((d: any) => d?.date)
                    .filter(Boolean)
                    .join(", ");
                } else if (details && typeof details === "object") {
                  const drv = Array.isArray(details.driverConf)
                    ? details.driverConf
                    : [];
                  const med = Array.isArray(details.medicConf)
                    ? details.medicConf
                    : [];
                  driverDates = drv
                    .map((d: any) => d?.date)
                    .filter(Boolean)
                    .join(", ");
                  medicDates = med
                    .map((d: any) => d?.date)
                    .filter(Boolean)
                    .join(", ");
                }

                if (driverDates || medicDates) {
                  toastT.error([
                    "pages.diensts.adminPage.teamWeeklyConflictWithDates",
                    { driverDates, medicDates },
                  ]);
                } else {
                  toastT.error(["pages.diensts.adminPage.teamWeeklyConflict"]);
                }
              } else {
                toastT.error(["pages.diensts.adminPage.assignWeekErr"]);
              }

              console.error(
                "assignTeamToWeek error:",
                err?.response?.data || err,
              );
            }
          }}
          weekStartISO={weekTeamModal.weekStartISO}
          dienstNumber={weekTeamModal.dienstNumber}
        />
      )}

      {/* Modal Usuario semana */}
      {weekUserModal?.open && (
        <UserAssignModal
          isOpen={true}
          onClose={() => setWeekUserModal(null)}
          onConfirm={async ({ role, userId }) => {
            if (!token || !weekUserModal) return;

            try {
              await assignUserToWeek(
                {
                  dienstNumber: weekUserModal.dienstNumber,
                  weekStartDate: weekUserModal.weekStartISO,
                  role,
                  userId,
                },
                token,
              );

              toastT.success(["pages.diensts.adminPage.assignUserWeekOk"]);
              setWeekUserModal(null);
              fetchDiensts();
            } catch (err: any) {
              console.error("❌ Error al asignar usuario a la semana:", err);

              if (err?.response?.data?.code === "weekly_conflict") {
                toastT.error([
                  "pages.diensts.adminPage.assignUserWeekConflict",
                ]);
              } else if (err?.response?.data?.code === "pschein_expired") {
                toastT.error([
                  "pages.diensts.adminPage.assignUserWeekPscheinExpired",
                ]);
              } else if (err?.response?.data?.code === "no_assignable_days") {
                toastT.error([
                  "pages.diensts.adminPage.assignUserNoAssignableDays",
                ]);
              } else {
                toastT.error(["pages.diensts.adminPage.assignUserWeekErr"]);
              }
            }
          }}
          weekStartISO={weekUserModal.weekStartISO}
        />
      )}
    </div>
  );
};

export default AdminPage;
