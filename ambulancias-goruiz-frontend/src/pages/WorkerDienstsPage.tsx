// src/pages/WorkerDienstsPage.tsx
import { useCallback, useEffect, useState } from "react";
import { getAssignedDaysForUser } from "../modules/diensts";
import AssignmentModal from "../components/AssignmentModal";
import { isPartialAssignment } from "../utils/assignmentUtils";
import type { AssignedDay } from "../modules/diensts";
import type { FlexibleAssignment } from "../types/assignment";
import { useAuth } from "../hooks/useAuth";
import { formatAmbulanceLabel, formatPersonLabel } from "../modules/diensts/utils";
import { useTranslation } from "react-i18next";
import { isPastDay } from "../utils/dates/isPastDay";
import { DienstDayCell } from "../modules/diensts/components";

const WorkerDienstsPage = () => {
  const { userId, token } = useAuth();
  const { t, i18n } = useTranslation();

  const [assignedDays, setAssignedDays] = useState<AssignedDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState<{
    date: string;
    assignment?: FlexibleAssignment;
    dienstId: string;
  } | null>(null);

  const fmtDate = (d: Date) => d.toLocaleDateString(i18n.language);

  const fmtCellDate = (isoDay: string) =>
    new Date(`${isoDay}T12:00:00`).toLocaleDateString(i18n.language, {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    });


  const fetchAssignedDays = useCallback(async () => {
    if (!userId || !token) return;

    try {
      const data = await getAssignedDaysForUser(userId, token);
      setAssignedDays(data);
    } catch (error) {
      console.error("Error al obtener los días asignados:", error);
    } finally {
      setLoading(false);
    }
  }, [userId, token]);

  useEffect(() => {
    fetchAssignedDays();
  }, [fetchAssignedDays]);

  if (loading) {
    return (
      <p className="text-sm text-slate-600 p-4">
        {t("pages.diensts.workerPage.loading")}
      </p>
    );
  }

  return (
    <div className="min-h-[400px]">
      <div className="mb-4">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">
          {t("pages.diensts.workerPage.title")}
        </h2>
      </div>

      {(() => {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const daysToSubtract = (dayOfWeek + 6) % 7; // lunes = 0
        const firstMonday = new Date(today);
        firstMonday.setDate(today.getDate() - daysToSubtract);

        const weeks = [0, 1]; // Dos semanas

        return (
          <div className="space-y-6">
            {weeks.map((weekOffset) => {
              const weekStart = new Date(firstMonday);
              weekStart.setDate(firstMonday.getDate() + weekOffset * 7);

              const weekDates = Array.from({ length: 7 }, (_, i) => {
                const d = new Date(`${weekStart.toISOString().slice(0, 10)}T12:00:00`);
                d.setDate(d.getDate() + i);
                return d.toISOString().slice(0, 10);
              });

              const weekEnd = new Date(weekStart);
              weekEnd.setDate(weekStart.getDate() + 6);

              return (
                <div
                  key={weekOffset}
                  className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-4"
                >
                  <p className="text-sm font-medium text-slate-700 mb-3">
                    {t("pages.diensts.workerPage.weekRange", {
                      from: fmtDate(weekStart),
                      to: fmtDate(weekEnd),
                    })}
                  </p>

                  {/* Grid de 7 días */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    {weekDates.map((dateStr) => {
                      const assignment = assignedDays.find((a) => a.date === dateStr);

                      const cls = assignment
                        ? isPartialAssignment(assignment)
                          ? "bg-amber-50 ring-amber-200"
                          : "bg-blue-100 ring-blue-300"
                        : "bg-emerald-50 ring-emerald-200";

                      const isPast = isPastDay(dateStr);

                      return (
                        <DienstDayCell
                          dayISO={dateStr}
                          statusClass={cls}
                          isPast={isPast}
                          isDisabled={
                            !assignment?.startTime ||
                            !assignment?.endTime ||
                            !assignment?.driver ||
                            !assignment?.medic
                          }
                          lines={{
                            dateLine: fmtCellDate(dateStr),
                            ...(assignment
                              ? {
                                timeLine: `🕒 ${assignment.startTime} - ${assignment.endTime}`,
                                ambulanceLine: `🚑 ${formatAmbulanceLabel(
                                  assignment.ambulanceNumber,
                                )}`,
                                driverLine: `👨‍✈️ ${formatPersonLabel(assignment.driver)}`,
                                medicLine: `🧑‍⚕️ ${formatPersonLabel(assignment.medic)}`,
                              }
                              : {
                                ambulanceLine: `🌴 ${t("pages.diensts.workerPage.freeDay")}`,
                              }),
                          }}
                          onOpen={() => {
                            setSelectedAssignment({
                              date: assignment!.date,
                              assignment: assignment as FlexibleAssignment,
                              dienstId: assignment!.dienstId,
                            });
                          }}
                        />

                      );
                    })}
                  </div>
                </div>
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
          onUpdate={fetchAssignedDays}
        />
      )}
    </div>
  );
};

export default WorkerDienstsPage;
