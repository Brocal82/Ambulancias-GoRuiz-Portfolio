//src/pages/AdminUserDienstsTab.tsx
// AdminUserDienstsTab.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getDienstByUser,
  getAssignedDaysForUser,
  getAllDiensts,
} from "../modules/diensts";
import AssignmentModal from "../components/AssignmentModal";
import { isPartialAssignment } from "../utils/assignmentUtils";
import type { AssignedDay, Dienst, UserRef } from "../modules/diensts";
import type { FlexibleAssignment } from "../types/assignment";
import { isPastDay } from "../utils/dates/isPastDay";
import { useAuth } from "../hooks/useAuth";
import { useTranslation } from "react-i18next";

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

  const [selectedAssignment, setSelectedAssignment] = useState<{
    date: string;
    assignment?: FlexibleAssignment;
    dienstId: string;
  } | null>(null);

  // ✅ Siempre usa T12:00:00 para evitar desfases por UTC
  const toNoonDate = (isoDay: string) => new Date(`${isoDay}T12:00:00`);

  const fmtDate = (d: Date) => d.toLocaleDateString(i18n.language);

  const fmtCellDate = (isoDay: string) =>
    toNoonDate(isoDay).toLocaleDateString(i18n.language, {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    });

  const addDaysISO = (isoDay: string, days: number) => {
    const d = toNoonDate(isoDay);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  // Lunes de la semana (en ISO "YYYY-MM-DD") para una fecha ISO
  const mondayOfISO = (isoDay: string) => {
    const d = toNoonDate(isoDay);
    const dow = d.getDay(); // 0..6 (dom..sab)
    const diff = (dow + 6) % 7; // lunes=0
    d.setDate(d.getDate() - diff);
    return d.toISOString().slice(0, 10);
  };

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
    if (aNum) return aNum;
    if (typeof aId === "string") return aId;
    if (aId && typeof aId === "object") {
      const obj = aId as any;
      return obj.ambulanceNumber ?? obj.licensePlate ?? obj._id ?? "—";
    }
    return "—";
  };

  // Etiqueta segura para usuario (UserRef o id suelto)
  const formatUserLabel = (u?: string | UserRef | null): string => {
    if (!u) return "—";
    if (typeof u === "string") return "—"; // solo id, sin datos
    const last = u.lastName ?? "";
    const name = u.name ?? "";
    const label = `${last}${last && name ? ", " : ""}${name}`.trim();
    return label || "—";
  };

  // Adaptador local: AssignedDay -> FlexibleAssignment (contrato del modal)
  const toFlexibleAssignment = (
    a?: AssignedDay,
  ): FlexibleAssignment | undefined => {
    if (!a) return undefined;

    const ambulanceId =
      typeof a.ambulanceId === "object"
        ? String((a.ambulanceId as any)?._id ?? "")
        : (a.ambulanceId ?? "");

    return {
      _id: a.assignmentId, // id estable para UI
      date: a.date,
      startTime: a.startTime,
      endTime: a.endTime,
      ambulanceId,
      ambulanceNumber: a.ambulanceNumber,
      driver: a.driver ?? "",
      medic: a.medic ?? "",
    };
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

  const getDienstIdForDate = (dateStr: string): string => {
    const mondayIso = mondayOfISO(dateStr);
    return dienstIdByWeekStart.get(mondayIso) ?? "";
  };

  if (loading) {
    return (
      <p className="text-sm text-slate-600 p-4">
        {t("pages.diensts.adminUserTab.loading")}
      </p>
    );
  }

  return (
    <div className="min-h-[400px]">
      <div className="mb-4">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">
          {t("pages.diensts.adminUserTab.title")}
        </h2>
      </div>

      {(() => {
        const todayISO = new Date().toISOString().slice(0, 10);
        const firstMondayISO = mondayOfISO(todayISO);

        const weeks = [0, 1]; // Dos semanas

        return (
          <div className="space-y-6">
            {weeks.map((weekOffset) => {
              const weekStartISO = addDaysISO(firstMondayISO, weekOffset * 7);
              const weekEndISO = addDaysISO(weekStartISO, 6);

              const weekDates = Array.from({ length: 7 }, (_, i) =>
                addDaysISO(weekStartISO, i),
              );

              return (
                <div
                  key={weekOffset}
                  className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-4"
                >
                  <p className="text-sm font-medium text-slate-700 mb-3">
                    {t("pages.diensts.adminPage.weekRange", {
                      from: fmtDate(toNoonDate(weekStartISO)),
                      to: fmtDate(toNoonDate(weekEndISO)),
                    })}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    {weekDates.map((dateStr) => {
                      const assignment = assignedDays.find(
                        (a) => a.date === dateStr,
                      );

                      const cls = assignment
                        ? isPartialAssignment(assignment)
                          ? "bg-amber-50 ring-amber-200"
                          : "bg-blue-50 ring-blue-200"
                        : "bg-emerald-50 ring-emerald-200";

                      const isPast = isPastDay(dateStr);

                      return (
                        <button
                          key={dateStr}
                          type="button"
                          disabled={isPast}
                          className={`
                            text-left rounded-xl p-3 ring-1 transition
                            ${cls}
                            ${isPast
                              ? "opacity-80 bg-slate-50 text-slate-400 cursor-not-allowed hover:shadow-none hover:translate-y-0"
                              : "hover:shadow-sm hover:-translate-y-0.5"
                            }
                          `}
                          onClick={() => {
                            if (isPast) return;

                            const foundDienstId = assignment?.dienstId
                              ? assignment.dienstId
                              : getDienstIdForDate(dateStr);

                            if (!foundDienstId) {
                              console.warn(
                                `ID del Dienst no encontrado para la fecha ${dateStr}`,
                              );
                              return;
                            }

                            setSelectedAssignment({
                              date: dateStr,
                              assignment: toFlexibleAssignment(assignment),
                              dienstId: foundDienstId,
                            });
                          }}
                        >
                          <p className="text-xs font-semibold text-slate-800 mb-1">
                            {fmtCellDate(dateStr)}
                          </p>

                          {assignment ? (
                            <div className="space-y-0.5 text-xs text-slate-700">
                              <p>
                                🕒 {assignment.startTime} - {assignment.endTime}
                              </p>
                              <p>
                                🚑{" "}
                                {ambulanceLabel(
                                  assignment.ambulanceNumber,
                                  assignment.ambulanceId,
                                )}
                              </p>
                              <p>👨‍✈️ {formatUserLabel(assignment.driver)}</p>
                              <p>🧑‍⚕️ {formatUserLabel(assignment.medic)}</p>
                            </div>
                          ) : (
                            <p className="text-xs text-emerald-800 mt-1">
                              🌴 {t("pages.diensts.adminPage.freeDay")}
                            </p>
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

