// src/pages/AdminUserDienstsTab.tsx
// AdminUserDienstsTab.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getDienstByUser,
  getAssignedDaysForUser,
  getAllDiensts,
} from "../modules/diensts";
import AssignmentModal from "../components/AssignmentModal";
import type { AssignedDay, Dienst } from "../modules/diensts";
import type { FlexibleAssignment } from "../types/assignment";
import { isPastDay } from "../utils/dates/isPastDay";
import { useAuth } from "../hooks/useAuth";
import { useTranslation } from "react-i18next";
import { DienstDayCell, WeekBlock } from "../modules/diensts/components";
import {
  formatPersonLabel,
  formatAmbulanceLabel,
  getAssignmentStatus,
  getStatusClass,
  getWeekDays,
  getWeekStartsBerlin,
} from "../modules/diensts/utils";
import { formatCellDateUnified } from "../utils/timeUtils";
import { toFlexibleFromAssignedDay } from "../modules/diensts/assignments";

interface Props {
  userId: string;
}

const AdminUserDienstsTab = ({ userId }: Props) => {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();

  const [userDiensts, setUserDiensts] = useState<Dienst[]>([]);
  const [allDiensts, setAllDiensts] = useState<Dienst[]>([]);
  const [assignedDays, setAssignedDays] = useState<AssignedDay[]>([]);
  const [loading, setLoading] = useState(true);

  const assignedByDate = useMemo(() => {
    const map = new Map<string, AssignedDay>();
    for (const d of assignedDays) map.set(d.date, d);
    return map;
  }, [assignedDays]);

  const [selectedAssignment, setSelectedAssignment] = useState<{
    date: string;
    assignment?: FlexibleAssignment;
    dienstId: string;
  } | null>(null);

  // ✅ Siempre usa T12:00:00 para evitar desfases por UTC
  const toNoonDate = (isoDay: string) => new Date(`${isoDay}T12:00:00`);

  const fmtDate = (d: Date) => d.toLocaleDateString(i18n.language);

  const fetchData = useCallback(async () => {
    if (!userId || !token) return;
    setLoading(true);

    try {
      const [assignedDaysData, userDienstsData, allDienstsData] =
        await Promise.all([
          getAssignedDaysForUser(userId, token),
          getDienstByUser(userId, token),
          getAllDiensts(token),
        ]);

      setAssignedDays(assignedDaysData);
      setUserDiensts(userDienstsData);
      setAllDiensts(allDienstsData);
    } catch (e) {
      console.error("Error al cargar datos de diensts:", e);
    } finally {
      setLoading(false);
    }
  }, [userId, token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Etiqueta segura para ambulancia
  const ambulanceLabel = (aNum?: string, aId?: unknown): string => {
    // 1) Si viene número explícito, es lo más fiable (mantiene comportamiento actual)
    if (aNum) return aNum;

    // 2) Intento estándar del módulo (cubre string y objeto con ambulanceNumber)
    const base = formatAmbulanceLabel(aId);
    if (base && base !== "—") return base;

    // 3) Fallbacks legacy que tu vista ya soportaba (no perdemos info)
    if (aId && typeof aId === "object") {
      const obj = aId as any;
      const lp = obj?.licensePlate;
      if (typeof lp === "string" && lp.trim()) return lp;

      const id = obj?._id;
      if (typeof id === "string" && id.trim()) return id;
    }

    return "—";
  };



  // Índice rápido: weekStartISO -> dienstId
  const dienstIdByWeekStart = useMemo(() => {
    const map = new Map<string, string>();

    const addList = (list: Dienst[]) => {
      for (const d of list) {
        if (!d.weekStartDate) continue;
        const key = d.weekStartDate.slice(0, 10);
        if (!map.has(key)) map.set(key, d._id);
      }
    };

    addList(userDiensts);
    addList(allDiensts);

    return map;
  }, [userDiensts, allDiensts]);

  const getDienstIdForWeekStart = (weekStartISO: string): string => {
    return dienstIdByWeekStart.get(weekStartISO) ?? "";
  };

  if (loading) {
    return (
      <p className="text-sm text-slate-600 p-4">
        {t("pages.diensts.adminUserTab.loading")}
      </p>
    );
  }

  return (
    // ✅ QUITADO el contenedor “grande” con padding extra (p-6),
    // para que no reduzca el ancho útil dentro del card padre.
    <div className="min-h-[400px] w-full">
      <div className="mb-4">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">
          {t("pages.diensts.adminUserTab.title")}
        </h2>
      </div>

      {(() => {
        const weekStartKeys = getWeekStartsBerlin(2); // semana actual + siguiente

        return (
          <div className="space-y-6 w-full">
            {weekStartKeys.map((weekStartISO) => {
              const weekDates = getWeekDays(weekStartISO);
              const weekEndISO = weekDates[6];
              const dienstIdForThisWeek = getDienstIdForWeekStart(weekStartISO);

              return (
                <WeekBlock
                  key={weekStartISO}
                  title={t("pages.diensts.adminPage.weekRange", {
                    from: fmtDate(toNoonDate(weekStartISO)),
                    to: fmtDate(toNoonDate(weekEndISO)),
                  })}
                >
                  {weekDates.map((dateStr) => {
                    const assignment = assignedByDate.get(dateStr);

                    const status = getAssignmentStatus(assignment);
                    const cls = getStatusClass(status);

                    const isPast = isPastDay(dateStr);

                    return (
                      <DienstDayCell
                        key={dateStr}
                        dayISO={dateStr}
                        statusClass={cls}
                        isPast={isPast}
                        lines={{
                          dateLine: formatCellDateUnified(dateStr, i18n.language),

                          ...(assignment
                            ? {
                              timeLine: `🕒 ${assignment.startTime} - ${assignment.endTime}`,
                              ambulanceLine: `🚑 ${ambulanceLabel(
                                assignment.ambulanceNumber,
                                assignment.ambulanceId,
                              )}`,
                              driverLine: `👨‍✈️ ${typeof assignment.driver === "string" ? "—" : formatPersonLabel(assignment.driver)
                                }`,
                              medicLine: `🧑‍⚕️ ${typeof assignment.medic === "string" ? "—" : formatPersonLabel(assignment.medic)
                                }`,

                            }
                            : {
                              ambulanceLine: `🌴 ${t(
                                "pages.diensts.adminPage.freeDay",
                              )}`,
                            }),
                        }}
                        onOpen={() => {
                          const foundDienstId = assignment?.dienstId
                            ? assignment.dienstId
                            : dienstIdForThisWeek;

                          if (!foundDienstId) {
                            console.warn(
                              `ID del Dienst no encontrado para la semana ${weekStartISO} (fecha ${dateStr})`,
                            );
                            return;
                          }

                          setSelectedAssignment({
                            date: dateStr,
                            assignment: toFlexibleFromAssignedDay(assignment),
                            dienstId: foundDienstId,
                          });
                        }}
                      />
                    );
                  })}
                </WeekBlock>
              );
            })}
          </div>
        );
      })()}

      {selectedAssignment && (
        <AssignmentModal
          isOpen={true}
          date={selectedAssignment.date}
          assignment={selectedAssignment.assignment}
          dienstId={selectedAssignment.dienstId}
          onClose={() => setSelectedAssignment(null)}
          onUpdate={fetchData}
        />
      )}
    </div>
  );
};

export default AdminUserDienstsTab;
