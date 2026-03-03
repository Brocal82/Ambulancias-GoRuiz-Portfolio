// src/modules/diensts/pages/WorkerDienstsPage.tsx
import { useCallback, useEffect, useMemo, useState } from "react";

import { getAssignedDaysForUser } from "../index";
import type { AssignedDay } from "../index";

import AssignmentModal from "../../../components/assignmentModal/AssignmentModal";
import type { FlexibleAssignment } from "../../../types/assignment";

import { useAuth } from "../../../hooks/useAuth";
import { useTranslation } from "react-i18next";

import { isPastDay } from "../../../utils/dates/isPastDay";

import { DienstDayCell, WeekBlock } from "../components";

import {
  getAssignmentStatus,
  getStatusClass,
  getWeekDays,
  getWeekStartsBerlin,
  buildDienstDayCellLines,
} from "../utils";

import { toFlexibleFromAssignedDay } from "../assignments";

import PageShell from "../../../components/common/PageShell";

const WorkerDienstsPage = () => {
  const { userId, token } = useAuth();
  const { t, i18n } = useTranslation();

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

  const fmtDate = (d: Date) => d.toLocaleDateString(i18n.language);

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
    <PageShell title={t("pages.diensts.workerPage.title")} maxWidthClassName="max-w-6xl">

      {(() => {
        const weekStartKeys = getWeekStartsBerlin(2); // semana actual + siguiente

        return (
          <div className="space-y-6">
            {weekStartKeys.map((weekStartISO) => {
              const weekDates = getWeekDays(weekStartISO);

              const weekStart = new Date(`${weekStartISO}T12:00:00`);
              const weekEnd = new Date(`${weekStartISO}T12:00:00`);
              weekEnd.setDate(weekEnd.getDate() + 6);

              return (
                <WeekBlock
                  key={weekStartISO}
                  title={t("pages.diensts.workerPage.weekRange", {
                    from: fmtDate(weekStart),
                    to: fmtDate(weekEnd),
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
                        isDisabled={Boolean(
                          assignment &&
                          (
                            !assignment.startTime ||
                            !assignment.endTime ||
                            !assignment.driver ||
                            !assignment.medic
                          )
                        )}

                        lines={buildDienstDayCellLines({
                          isoDay: dateStr,
                          lang: i18n.language,
                          freeLabel: `🌴 ${t("pages.diensts.workerPage.freeDay")}`,
                          assignment: assignment
                            ? {
                              startTime: assignment.startTime,
                              endTime: assignment.endTime,
                              ambulanceNumber: assignment.ambulanceNumber,
                              driver: assignment.driver,
                              medic: assignment.medic,
                            }
                            : null,
                        })}


                        onOpen={() => {
                          if (!assignment) return;

                          setSelectedAssignment({
                            date: assignment.date,
                            assignment: toFlexibleFromAssignedDay(assignment),
                            dienstId: assignment.dienstId,
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
          onUpdate={fetchAssignedDays}
        />
      )}
    </PageShell>
  );
};

export default WorkerDienstsPage;
