// src/modules/diensts/components/AdminUserDienstsTab.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getDienstByUser,
  getAssignedDaysForUser,
  getAllDiensts,
} from "../index";
import { useDienstsChanged } from "../hooks/useDienstsChanged";
import AssignmentModal from "./assignmentModal/AssignmentModal";
import type { AssignedDay, Dienst } from "../index";
import type { FlexibleAssignment } from "../domain/types/flexibleAssignment";
import { isPastDay } from "../../../utils/dates/isPastDay";
import { useAuth } from "../../../hooks/useAuth";
import { useModules } from "../../../hooks/useModules";
import { MODULE_KEYS } from "../../../constants/modules";
import { useTranslation } from "react-i18next";
import { DienstDayCell, WeekBlock } from "./index";
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

import { getVacationRequests } from "../../vacation/domain/api";
import type { IVacationRequest } from "../../vacation/domain/types";
import { adminListSickLeaves } from "../../sick/domain/api";
import type { SickLeave } from "../../sick/domain/types";

function vacationRequestForUser(
  v: IVacationRequest,
  targetUserId: string,
): boolean {
  const u = v.user as unknown;
  const id =
    typeof u === "string"
      ? u
      : u && typeof u === "object" && "_id" in (u as object)
        ? String((u as { _id?: string })._id ?? "")
        : "";
  return Boolean(id) && id === String(targetUserId);
}

interface Props {
  userId: string;
}

const AdminUserDienstsTab = ({ userId }: Props) => {
  const { token } = useAuth();
  const { hasModule } = useModules();
  const vacationModuleOn = hasModule(MODULE_KEYS.VACATION);
  const sickLeavesModuleOn = hasModule(MODULE_KEYS.SICK_LEAVES);
  const { t, i18n } = useTranslation();

  const [userDiensts, setUserDiensts] = useState<Dienst[]>([]);
  const [allDiensts, setAllDiensts] = useState<Dienst[]>([]);
  const [assignedDays, setAssignedDays] = useState<AssignedDay[]>([]);
  const [userVacations, setUserVacations] = useState<IVacationRequest[]>([]);
  const [userSickLeaves, setUserSickLeaves] = useState<SickLeave[]>([]);
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
      const [
        assignedDaysData,
        userDienstsData,
        allDienstsData,
        allVacationRequests,
        sickForUser,
      ] = await Promise.all([
        getAssignedDaysForUser(userId, token),
        getDienstByUser(userId, token),
        getAllDiensts(token),
        vacationModuleOn
          ? getVacationRequests()
          : Promise.resolve([] as IVacationRequest[]),
        sickLeavesModuleOn
          ? adminListSickLeaves({ userId })
          : Promise.resolve([] as SickLeave[]),
      ]);

      setAssignedDays(assignedDaysData);
      setUserDiensts(userDienstsData);
      setAllDiensts(allDienstsData);
      const vacs = Array.isArray(allVacationRequests) ? allVacationRequests : [];
      setUserVacations(vacs.filter((v) => vacationRequestForUser(v, userId)));
      setUserSickLeaves(Array.isArray(sickForUser) ? sickForUser : []);
    } catch (e) {
      console.error("Error al cargar datos de diensts:", e);
    } finally {
      setLoading(false);
    }
  }, [userId, token, vacationModuleOn, sickLeavesModuleOn]);

  const fetchDataRef = useRef(fetchData);
  fetchDataRef.current = fetchData;

  useDienstsChanged(() => void fetchDataRef.current?.());

  useEffect(() => {
    fetchData();
  }, [fetchData]);


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
    <div className="min-h-[400px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-7xl">

      <div className="mb-4 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
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
                    const absence = assignment
                      ? "none"
                      : resolveUserAbsenceForFreeDay(
                          dateStr,
                          userVacations,
                          userSickLeaves,
                        );
                    const cls = assignment
                      ? getStatusClass(status)
                      : getOffDayStatusClass(absence);

                    const freeLabel =
                      absence === "vacation"
                        ? `🏖️ ${t("pages.diensts.workerPage.vacationDay")}`
                        : absence === "sick"
                          ? `🤒 ${t("pages.diensts.workerPage.sickDay")}`
                          : `🌴 ${t("pages.diensts.adminPage.freeDay")}`;

                    const isPast = isPastDay(dateStr);

                    return (
                      <DienstDayCell
                        key={dateStr}
                        dayISO={dateStr}
                        statusClass={cls}
                        isPast={isPast}
                        isPartial={status === "partial"}
                        lines={buildDienstDayCellLines({
                          isoDay: dateStr,
                          lang: i18n.language,
                          freeLabel,
                          assignment: assignment
                            ? {
                              startTime: assignment.startTime,
                              endTime: assignment.endTime,

                              // ⚠️ mantenemos EXACTAMENTE tu política de ambulancia
                              ambulanceNumber: assignment.ambulanceNumber ?? undefined,
                              ambulanceId: assignment.ambulanceId,

                              driver: assignment.driver,
                              medic: assignment.medic,
                            }
                            : null,
                        })}


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
