// src/modules/diensts/pages/WorkerDienstsPage.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getAssignedDaysForUser } from "../index";
import { useDienstsChanged } from "../hooks/useDienstsChanged";
import type { AssignedDay } from "../index";

import AssignmentModal from "../components/assignmentModal/AssignmentModal";
import type { FlexibleAssignment } from "../domain/types/flexibleAssignment";

import { useAuth } from "../../../hooks/useAuth";
import { useModules } from "../../../hooks/useModules";
import { MODULE_KEYS } from "../../../constants/modules";
import { useTranslation } from "react-i18next";

import { getUserVacationRequests } from "../../vacation/domain/api";
import type { IVacationRequest } from "../../vacation/domain/types";
import { listMySickLeaves } from "../../sick/domain/api";
import type { SickLeave } from "../../sick/domain/types";

import { isPastDay } from "../../../utils/dates/isPastDay";

import { DienstDayCell, WeekBlock } from "../components";

import {
  getAssignmentStatus,
  getOffDayStatusClass,
  getStatusClass,
  getWeekDays,
  getWeekStartsBerlin,
  buildDienstDayCellLines,
  resolveUserAbsenceForFreeDay,
} from "../utils";

import { toFlexibleFromAssignedDay } from "../assignments";

import PageShell from "../../../components/common/PageShell";

const WorkerDienstsPage = () => {
  const { userId, token } = useAuth();
  const { hasModule } = useModules();
  const vacationModuleOn = hasModule(MODULE_KEYS.VACATION);
  const sickLeavesModuleOn = hasModule(MODULE_KEYS.SICK_LEAVES);
  const { t, i18n } = useTranslation();

  const [assignedDays, setAssignedDays] = useState<AssignedDay[]>([]);
  const [vacationRequests, setVacationRequests] = useState<IVacationRequest[]>(
    [],
  );
  const [sickLeaves, setSickLeaves] = useState<SickLeave[]>([]);
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
      const [days, vacs, sick] = await Promise.all([
        getAssignedDaysForUser(userId, token),
        vacationModuleOn
          ? getUserVacationRequests()
          : Promise.resolve([] as IVacationRequest[]),
        sickLeavesModuleOn
          ? listMySickLeaves()
          : Promise.resolve([] as SickLeave[]),
      ]);
      setAssignedDays(days);
      setVacationRequests(Array.isArray(vacs) ? vacs : []);
      setSickLeaves(Array.isArray(sick) ? sick : []);
    } catch (error) {
      console.error("Error al obtener los días asignados:", error);
    } finally {
      setLoading(false);
    }
  }, [userId, token, vacationModuleOn, sickLeavesModuleOn]);

  const fetchAssignedDaysRef = useRef(fetchAssignedDays);
  fetchAssignedDaysRef.current = fetchAssignedDays;

  useDienstsChanged(() => void fetchAssignedDaysRef.current?.());

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
    <PageShell title={t("pages.diensts.workerPage.title")} maxWidthClassName="max-w-5xl">

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
                    const absence = assignment
                      ? "none"
                      : resolveUserAbsenceForFreeDay(
                          dateStr,
                          vacationRequests,
                          sickLeaves,
                        );
                    const cls = assignment
                      ? getStatusClass(status)
                      : getOffDayStatusClass(absence);

                    const freeLabel =
                      absence === "vacation"
                        ? `🏖️ ${t("pages.diensts.workerPage.vacationDay")}`
                        : absence === "sick"
                          ? `🤒 ${t("pages.diensts.workerPage.sickDay")}`
                          : `🌴 ${t("pages.diensts.workerPage.freeDay")}`;

                    const isPast = isPastDay(dateStr);

                    return (
                      <DienstDayCell
                        key={dateStr}
                        dayISO={dateStr}
                        statusClass={cls}
                        isPast={isPast}
                        isPartial={status === "partial"}
                        preferLineWrap
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
                          freeLabel,
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
