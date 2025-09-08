// src/pages/WorkerDienstsPage.tsx
import { useCallback, useEffect, useState } from "react";
import { getAssignedDaysForUser } from "../api/diensts";
import AssignmentModal from "../components/AssignmentModal";
import { isPartialAssignment } from "../utils/assignmentUtils";
import type { AssignedDayFull } from "../types/dienst";
import type { FlexibleAssignment } from "../types/assignment";
import { useAuth } from "../hooks/useAuth";
import { useTranslation } from "react-i18next";

const WorkerDienstsPage = () => {
  const { userId, token } = useAuth();
  const { t, i18n } = useTranslation();

  const [assignedDays, setAssignedDays] = useState<AssignedDayFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState<{
    date: string;
    assignment?: FlexibleAssignment;
    dienstId: string;
  } | null>(null);

  const fmtDate = (d: Date) => d.toLocaleDateString(i18n.language);
  const fmtCellDate = (isoDay: string) =>
    new Date(isoDay).toLocaleDateString(i18n.language, {
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

  if (loading) return <p className="text-sm text-slate-600 p-4">{t("pages.diensts.workerPage.loading")}</p>;

  return (
    <div className="min-h-[400px]">
      <div className="mb-4">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">{t("pages.diensts.workerPage.title")}</h2>
      </div>

      <>
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
                  const d = new Date(weekStart);
                  d.setDate(weekStart.getDate() + i);
                  return d.toISOString().split("T")[0];
                });

                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 6);

                return (
                  <div key={weekOffset} className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-4">
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
                            ? 'bg-amber-50 ring-amber-200'
                            : 'bg-blue-50 ring-blue-200'
                          : 'bg-emerald-50 ring-emerald-200';

                        return (
                          <button
                            key={dateStr}
                            type="button"
                            className={`text-left rounded-xl p-3 ring-1 ${cls} hover:shadow-sm hover:-translate-y-0.5 transition`}
                            onClick={() => {
                              if (
                                !assignment?.startTime ||
                                !assignment?.endTime ||
                                !assignment?.driver ||
                                !assignment?.medic
                              ) {
                                return;
                              }

                              setSelectedAssignment({
                                date: assignment.date,
                                assignment: assignment as FlexibleAssignment,
                                dienstId: assignment.dienstId,
                              });
                            }}
                          >
                            <p className="text-xs font-semibold text-slate-800 mb-1">{fmtCellDate(dateStr)}</p>

                            {assignment ? (
                              <div className="space-y-0.5 text-xs text-slate-700">
                                <p>🕒 {assignment.startTime} - {assignment.endTime}</p>
                                <p>🚑 {typeof assignment.ambulanceNumber === 'string' ? assignment.ambulanceNumber : '—'}</p>
                                <p>👨‍✈️ {typeof assignment.driver === 'object' && assignment.driver ? `${assignment.driver.lastName}, ${assignment.driver.name}` : ''}</p>
                                <p>🧑‍⚕️ {typeof assignment.medic === 'object' && assignment.medic ? `${assignment.medic.lastName}, ${assignment.medic.name}` : ''}</p>
                              </div>
                            ) : (
                              <p className="text-xs text-emerald-800 mt-1">🌴 {t("pages.diensts.workerPage.freeDay")}</p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </>

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
