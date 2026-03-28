// src/modules/diensts/pages/AdminDienstsPage.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";

import type { Dienst } from "../index";
import type { DienstAssignment, UpdateAssignment } from "../domain/types";
import {
  getAllDiensts,
  generateDienstsForWeek,
  deleteDienstsForWeek,
  assignTeamToWeek,
  assignUserToWeek,
  clearPeopleForWeek,
} from "../index";
import { moveDienstSlotSameWeek, updateDienstPartial } from "../domain/api";
import { buildUpdateAssignment } from "../components/assignmentModal/buildUpdateAssignment";

import AssignmentModal from "../components/assignmentModal/AssignmentModal";
import TeamAssignModal from "../components/TeamAssignModal";
import UserAssignModal from "../components/UserAssignModal";
import {
  formatPersonLabel,
  getWeekStartsBerlin,
  getWeekDays,
  buildDienstDayCellLines,
  getAssignmentStatus,
  getStatusClass,
} from "../utils";

import { dayKeyToLocalDate, toBerlinDayKey } from "../../../utils/dates/dayKey";
import { isPastDay } from "../../../utils/dates/isPastDay";
import { isTeamIncomplete } from "../utils/assignmentUtils";
import { useAuth } from "../../../hooks/useAuth";
import { useTranslation } from "react-i18next";
import { toastT } from "../../../utils/toast";
import { getPscheinInfoAsOfDate } from "../../../utils/pscheinUtils";
import { isDriverEligibleForAssignment } from "../utils/driverEligibility";
import { emitDienstsChanged } from "../utils/dienstEvents";
import { useDienstsChanged } from "../hooks/useDienstsChanged";

import type { FlexibleAssignment } from "../domain/types/flexibleAssignment";

import { DienstDayCell, WeekBlock, WEEK_GRID_CLASS } from "../components";
import {
  normalizeAmbulanceIdToString,
  toFlexibleFromDienstAssignment,
} from "../assignments";

import PageShell from "../../../components/common/PageShell";

const DND_MIME = "application/x-dienst-admin-dnd+json";

type DienstAdminDndPayload = {
  v: 1;
  dienstId: string;
  role: "driver" | "medic";
  userId: string;
  sourceDate: string;
};

function getUserIdFromAssignmentField(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") {
    const s = v.trim();
    return s.length ? s : null;
  }
  if (typeof v === "object" && v !== null && "_id" in v) {
    const id = (v as { _id?: string })._id;
    return typeof id === "string" && id.trim() ? id : null;
  }
  return null;
}

/** True iff that slot has an assigned user id (same rules as drag source). */
function slotHasPerson(v: unknown): boolean {
  return getUserIdFromAssignmentField(v) != null;
}

/** Compare assignment `date` strings that may be YYYY-MM-DD or ISO datetimes. */
function assignmentDayKey(date: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(date.trim());
  if (m) return m[1]!;
  return toBerlinDayKey(date);
}

/**
 * Browsers often merge default drag text into `text/plain`, breaking JSON.parse(raw).
 * Recover a JSON object substring when possible.
 */
function extractJsonObjectFromText(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (t.startsWith("{") && t.endsWith("}")) return t;
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) return t.slice(start, end + 1);
  return null;
}

function parseDndPayload(e: DragEvent): DienstAdminDndPayload | null {
  const raw =
    e.dataTransfer.getData(DND_MIME) || e.dataTransfer.getData("text/plain");
  if (!raw?.trim()) return null;

  let o: unknown;
  try {
    o = JSON.parse(raw);
  } catch {
    const extracted = extractJsonObjectFromText(raw);
    if (!extracted) return null;
    try {
      o = JSON.parse(extracted);
    } catch {
      return null;
    }
  }

  if (!o || typeof o !== "object") return null;
  const p = o as Record<string, unknown>;
  if (p.v !== 1) return null;
  if (p.role !== "driver" && p.role !== "medic") return null;

  const dienstId =
    typeof p.dienstId === "string" && p.dienstId.trim()
      ? p.dienstId.trim()
      : null;
  const userId =
    typeof p.userId === "string" && p.userId.trim()
      ? p.userId.trim()
      : null;
  const sourceDate =
    typeof p.sourceDate === "string" && p.sourceDate.trim()
      ? p.sourceDate.trim()
      : null;

  if (!dienstId || !userId || !sourceDate) return null;

  return {
    v: 1,
    dienstId,
    role: p.role as "driver" | "medic",
    userId,
    sourceDate,
  };
}

function buildRowFromSlotIds(params: {
  assignment: DienstAssignment;
  driverId: string;
  medicId: string;
}): UpdateAssignment {
  const { assignment, driverId, medicId } = params;
  return buildUpdateAssignment({
    date: assignment.date,
    startTime: assignment.startTime,
    endTime: assignment.endTime,
    selectedDriverId: driverId,
    selectedMedicId: medicId,
    ambulanceId: normalizeAmbulanceIdToString(assignment.ambulanceId),
    assignment: toFlexibleFromDienstAssignment(assignment),
  });
}

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

  const fetchDienstsRef = useRef(fetchDiensts);
  fetchDienstsRef.current = fetchDiensts;

  useDienstsChanged(() => void fetchDienstsRef.current?.());

  useEffect(() => {
    fetchDiensts();
  }, [fetchDiensts]);

  const weekStartKeys = getWeekStartsBerlin(3);

  return (
    <PageShell
      title={t("pages.diensts.adminPage.title")}
      maxWidthClassName="max-w-7xl"
    >

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

                              const driverUserId = assignment
                                ? getUserIdFromAssignmentField(assignment.driver)
                                : null;
                              const medicUserId = assignment
                                ? getUserIdFromAssignmentField(assignment.medic)
                                : null;
                              const canDndCell = !isPast && Boolean(assignment);
                              const driverDraggable = canDndCell && Boolean(driverUserId);
                              const medicDraggable = canDndCell && Boolean(medicUserId);
                              const driverDropTarget =
                                canDndCell && !slotHasPerson(assignment?.driver);
                              const medicDropTarget =
                                canDndCell && !slotHasPerson(assignment?.medic);

                              const handleDropOnRole = async (
                                targetRole: "driver" | "medic",
                                e: DragEvent,
                              ) => {
                                const payload = parseDndPayload(e);
                                const targetAssignment = assignment;
                                if (!payload || !targetAssignment || !token) return;

                                const sourceDienst = diensts.find(
                                  (d) => String(d._id) === String(payload.dienstId),
                                );
                                if (!sourceDienst) return;

                                if (
                                  toBerlinDayKey(sourceDienst.weekStartDate) !==
                                  toBerlinDayKey(dienst.weekStartDate)
                                ) {
                                  toastT.error(
                                    "Solo se pueden mover asignaciones dentro de la misma semana.",
                                  );
                                  return;
                                }

                                if (payload.role !== targetRole) return;

                                if (
                                  String(payload.dienstId) === String(dienst._id) &&
                                  assignmentDayKey(payload.sourceDate) ===
                                    assignmentDayKey(day)
                                ) {
                                  return;
                                }

                                const sourceAssignment = sourceDienst.assignments.find(
                                  (a) =>
                                    assignmentDayKey(a.date) ===
                                    assignmentDayKey(payload.sourceDate),
                                );
                                if (!sourceAssignment) return;
                                if (
                                  !sourceAssignment.startTime?.trim() ||
                                  !sourceAssignment.endTime?.trim()
                                ) {
                                  return;
                                }
                                if (
                                  !targetAssignment.startTime?.trim() ||
                                  !targetAssignment.endTime?.trim()
                                ) {
                                  return;
                                }

                                const sourceSlotId =
                                  payload.role === "driver"
                                    ? getUserIdFromAssignmentField(sourceAssignment.driver)
                                    : getUserIdFromAssignmentField(sourceAssignment.medic);
                                if (!sourceSlotId || sourceSlotId !== payload.userId) return;

                                if (targetRole === "driver" && slotHasPerson(targetAssignment.driver)) {
                                  return;
                                }
                                if (targetRole === "medic" && slotHasPerson(targetAssignment.medic)) {
                                  return;
                                }

                                const sd = getUserIdFromAssignmentField(sourceAssignment.driver) ?? "";
                                const sm = getUserIdFromAssignmentField(sourceAssignment.medic) ?? "";
                                const td = getUserIdFromAssignmentField(targetAssignment.driver) ?? "";
                                const tm = getUserIdFromAssignmentField(targetAssignment.medic) ?? "";

                                let sourceRow: UpdateAssignment;
                                let targetRow: UpdateAssignment;

                                if (payload.role === "driver") {
                                  sourceRow = buildRowFromSlotIds({
                                    assignment: sourceAssignment,
                                    driverId: "",
                                    medicId: sm,
                                  });
                                  targetRow = buildRowFromSlotIds({
                                    assignment: targetAssignment,
                                    driverId: payload.userId,
                                    medicId: tm,
                                  });
                                } else {
                                  sourceRow = buildRowFromSlotIds({
                                    assignment: sourceAssignment,
                                    driverId: sd,
                                    medicId: "",
                                  });
                                  targetRow = buildRowFromSlotIds({
                                    assignment: targetAssignment,
                                    driverId: td,
                                    medicId: payload.userId,
                                  });
                                }

                                const crossDienst =
                                  String(payload.dienstId) !== String(dienst._id);

                                try {
                                  if (crossDienst) {
                                    await moveDienstSlotSameWeek(
                                      {
                                        sourceDienstId: String(payload.dienstId),
                                        sourceDate: assignmentDayKey(
                                          payload.sourceDate,
                                        ),
                                        targetDienstId: String(dienst._id),
                                        targetDate: day,
                                        role: payload.role,
                                        userId: payload.userId,
                                      },
                                      token,
                                    );
                                  } else {
                                    await updateDienstPartial(
                                      dienst._id,
                                      { assignments: [sourceRow, targetRow] },
                                      token,
                                    );
                                  }
                                  emitDienstsChanged();
                                  toastT.success(["toasts.assignments.saveSuccess"]);
                                  await fetchDiensts();
                                } catch (error) {
                                  console.error("Dienst DnD move:", error);
                                  toastT.apiError(error, ["toasts.assignments.saveError"]);
                                }
                              };

                              const makeDragStartHandler = (
                                role: "driver" | "medic",
                                userId: string,
                              ) => {
                                return (e: DragEvent) => {
                                  const payload: DienstAdminDndPayload = {
                                    v: 1,
                                    dienstId: String(dienst._id),
                                    role,
                                    userId,
                                    sourceDate: day,
                                  };
                                  const json = JSON.stringify(payload);
                                  e.dataTransfer.setData(DND_MIME, json);
                                  e.dataTransfer.setData("text/plain", json);
                                  e.dataTransfer.effectAllowed = "move";
                                };
                              };

                              const driverLine = assignment ? (
                                <>
                                  👨‍✈️{" "}
                                  {(() => {
                                    let drvClass = "";
                                    let drvTitle: string | undefined;

                                    if (typeof assignment.driver === "object" && assignment.driver) {
                                      const drv = assignment.driver as {
                                        ambulanceRole?: string;
                                        pscheinExpiry?: string | null;
                                        pscheinConfirmedAt?: string | Date | null;
                                      };
                                      const eligible = isDriverEligibleForAssignment(
                                        {
                                          ambulanceRole: drv.ambulanceRole as any,
                                          pscheinExpiry: drv.pscheinExpiry,
                                          pscheinConfirmedAt: drv.pscheinConfirmedAt,
                                        },
                                        day,
                                      );

                                      if (!eligible) {
                                        drvClass = "text-red-600 font-medium";
                                        drvTitle = t(
                                          "pages.diensts.adminPage.driverPscheinExpired",
                                          "P-Schein caducado",
                                        );
                                      } else {
                                        const info = getPscheinInfoAsOfDate(
                                          drv.pscheinExpiry ?? undefined,
                                          day,
                                        );
                                        if (info.status === "warning") {
                                          drvClass = "text-amber-600 font-medium";
                                          drvTitle = t(
                                            "pages.diensts.adminPage.driverPscheinWarning",
                                            {
                                              count: info.monthsLeft ?? 0,
                                            },
                                          );
                                        }
                                      }
                                    }

                                    return (
                                      <span className={drvClass} title={drvTitle}>
                                        {formatPersonLabel(assignment.driver)}
                                      </span>
                                    );
                                  })()}
                                </>
                              ) : undefined;

                              return (
                                <DienstDayCell
                                  key={day}
                                  dayISO={day}
                                  statusClass={cls}
                                  incompleteBorderClass={incompleteBorderClass}
                                  isPast={isPast}
                                  isPartial={status === "partial"}
                                  onOpen={() => {
                                    setSelectedAssignment({
                                      date: day,
                                      assignment: toFlexibleFromDienstAssignment(assignment),

                                      dienstId: dienst._id,
                                    });
                                  }}
                                  adminDnd={{
                                    driverDraggable,
                                    medicDraggable,
                                    driverDropTarget,
                                    medicDropTarget,
                                    onDragStartDriver:
                                      driverUserId != null
                                        ? makeDragStartHandler("driver", driverUserId)
                                        : undefined,
                                    onDragStartMedic:
                                      medicUserId != null
                                        ? makeDragStartHandler("medic", medicUserId)
                                        : undefined,
                                    onDropDriver: (e) => handleDropOnRole("driver", e),
                                    onDropMedic: (e) => handleDropOnRole("medic", e),
                                  }}
                                  lines={{
                                    ...buildDienstDayCellLines({
                                      isoDay: day,
                                      lang: i18n.language,
                                      freeLabel: `🌴 ${t("pages.diensts.adminPage.freeDay")}`,
                                      assignment: assignment
                                        ? {
                                          startTime: assignment.startTime,
                                          endTime: assignment.endTime,
                                          ambulanceId: assignment.ambulanceId,
                                          driver: assignment.driver,
                                          medic: assignment.medic,
                                        }
                                        : null,
                                    }),

                                    // ✅ mantenemos tu lógica especial del driver (P-Schein)
                                    ...(assignment ? { driverLine } : {}),
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
          onClose={() => {
            setSelectedAssignment(null);
          }}
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
              emitDienstsChanged();
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
              emitDienstsChanged();
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
    </PageShell>
  );
};

export default AdminPage;
