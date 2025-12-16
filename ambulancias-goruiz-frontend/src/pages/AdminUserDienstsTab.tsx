// AdminUserDienstsTab.tsx
import { useCallback, useEffect, useState } from "react";
import {
  getDienstByUser,
  getAssignedDaysForUser,
  getAllDiensts,
} from "../api/diensts";
import AssignmentModal from "../components/AssignmentModal";
import { isPartialAssignment } from "../utils/assignmentUtils";
import type { AssignedDayFull, Dienst } from "../types/dienst";
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
  const [assignedDays, setAssignedDays] = useState<AssignedDayFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState<{
    date: string;
    assignment?: AssignedDayFull;
    dienstId: string;
  } | null>(null);

  const fmtDate = (d: Date) => d.toLocaleDateString(i18n.language);
  const fmtCellDate = (isoDay: string) =>
    new Date(isoDay).toLocaleDateString(i18n.language, {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    });

  // UTC helpers para comparar por día (evita líos de TZ)
  const dayUTC = (d: Date) =>
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const toDate = (iso: string) => new Date(iso); // "YYYY-MM-DD" se interpreta como UTC
  const isoDate = (d: Date) => d.toISOString().slice(0, 10);

  const mondayOfISO = (iso: string) => {
    const d = toDate(iso);
    const dow = d.getUTCDay(); // 0..6
    const diff = (dow + 6) % 7; // días hacia atrás hasta lunes
    d.setUTCDate(d.getUTCDate() - diff);
    d.setUTCHours(0, 0, 0, 0);
    return isoDate(d);
  };

  const inSameWeek = (dateIso: string, startIso?: string, endIso?: string) => {
    if (!startIso) return false;
    const date = toDate(dateIso);
    const start = toDate(startIso);
    const end = endIso ? toDate(endIso) : new Date(start);
    if (!endIso) end.setUTCDate(start.getUTCDate() + 6);

    const dUTC = dayUTC(date);
    const sUTC = dayUTC(start);
    const eUTC = dayUTC(end);
    return dUTC >= sUTC && dUTC <= eUTC;
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

  // Normaliza para el modal (ambulanceId siempre string)
  const normalizeAssignmentForModal = (a?: AssignedDayFull) => {
    if (!a) return undefined;
    const id =
      typeof a.ambulanceId === "object"
        ? ((a.ambulanceId as any)?._id ?? "")
        : (a.ambulanceId ?? "");
    return { ...a, ambulanceId: id } as any;
  };

  // ✅ Encuentra el dienstId para un día (primero en los del usuario, luego en todos; por rango)
  const getDienstIdForDate = (dateStr: string): string => {
    // 1) Buscar por rango en los Diensts del usuario
    const fromUser = userDiensts.find((d) =>
      inSameWeek(dateStr, d.weekStartDate, (d as any).weekEndDate),
    );
    if (fromUser) return fromUser._id;

    // 2) Buscar por rango en TODAS las plantillas
    const candidatesByRange = allDiensts.filter((d) =>
      inSameWeek(dateStr, d.weekStartDate, (d as any).weekEndDate),
    );
    if (candidatesByRange.length > 0) {
      return candidatesByRange.sort(
        (a, b) => (a.dienstNumber ?? 999) - (b.dienstNumber ?? 999),
      )[0]._id;
    }

    // 3) Plan B: comparar por lunes ISO de la semana
    const mondayIso = mondayOfISO(dateStr);
    const byMonday = (list: Dienst[]) =>
      list.filter(
        (d) =>
          d.weekStartDate && isoDate(new Date(d.weekStartDate)) === mondayIso,
      );

    const fromUserMonday = byMonday(userDiensts)[0];
    if (fromUserMonday) return fromUserMonday._id;

    const allMonday = byMonday(allDiensts);
    if (allMonday.length > 0) {
      return allMonday.sort(
        (a, b) => (a.dienstNumber ?? 999) - (b.dienstNumber ?? 999),
      )[0]._id;
    }

    console.warn(`ID del Dienst no encontrado para la fecha ${dateStr}`);
    return "";
  };

  if (loading)
    return (
      <p className="text-sm text-slate-600 p-4">
        {t("pages.diensts.adminUserTab.loading")}
      </p>
    );

  return (
    <div className="min-h-[400px]">
      <div className="mb-4">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">
          {t("pages.diensts.adminUserTab.title")}
        </h2>
      </div>

      {(() => {
        const today = new Date();
        const dow = today.getDay();
        const back = (dow + 6) % 7;
        const firstMonday = new Date(
          Date.UTC(
            today.getUTCFullYear(),
            today.getUTCMonth(),
            today.getUTCDate(),
          ),
        );
        firstMonday.setUTCDate(firstMonday.getUTCDate() - back);

        const weeks = [0, 1]; // Dos semanas
        return (
          <div className="space-y-6">
            {weeks.map((weekOffset) => {
              const weekStart = new Date(firstMonday);
              weekStart.setUTCDate(firstMonday.getUTCDate() + weekOffset * 7);

              const weekDates = Array.from({ length: 7 }, (_, i) => {
                const d = new Date(weekStart);
                d.setUTCDate(weekStart.getUTCDate() + i);
                return isoDate(d);
              });

              const weekEnd = new Date(weekStart);
              weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

              return (
                <div
                  key={weekOffset}
                  className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-4"
                >
                  <p className="text-sm font-medium text-slate-700 mb-3">
                    {t("pages.diensts.adminPage.weekRange", {
                      from: fmtDate(new Date(weekStart)),
                      to: fmtDate(new Date(weekEnd)),
                    })}
                  </p>

                  {/* Grid de 7 días */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    {weekDates.map((dateStr) => {
                      const assignment = assignedDays.find(
                        (a) => a.date === dateStr,
                      );

                      // Colores suaves consistentes con el resto de la UI
                      const cls = assignment
                        ? isPartialAssignment(assignment)
                          ? "bg-amber-50 ring-amber-200"
                          : "bg-blue-50 ring-blue-200"
                        : "bg-emerald-50 ring-emerald-200";

                      return (
                        <button
                          key={dateStr}
                          type="button"
                          className={`text-left rounded-xl p-3 ring-1 ${cls} hover:shadow-sm hover:-translate-y-0.5 transition cursor-pointer`}
                          onClick={() => {
                            const foundDienstId = assignment
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
                              assignment: assignment || undefined,
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
                              <p>
                                👨‍✈️ {assignment.driver?.lastName},{" "}
                                {assignment.driver?.name}
                              </p>
                              <p>
                                🧑‍⚕️ {assignment.medic?.lastName},{" "}
                                {assignment.medic?.name}
                              </p>
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
          assignment={normalizeAssignmentForModal(
            selectedAssignment.assignment,
          )}
          dienstId={selectedAssignment.dienstId}
          onClose={() => setSelectedAssignment(null)}
          onUpdate={fetchData}
        />
      )}
    </div>
  );
};

export default AdminUserDienstsTab;
