// AdminUserDienstsTab.tsx
import { useCallback, useEffect, useState } from "react";
import { getDienstByUser, getAssignedDaysForUser, getAllDiensts } from "../api/diensts";
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
  const dayUTC = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
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
      const [assignedDaysData, userDienstsData, allDienstsData] = await Promise.all([
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
    const fromUser = userDiensts.find(d =>
      inSameWeek(dateStr, d.weekStartDate, (d as any).weekEndDate)
    );
    if (fromUser) return fromUser._id;

    // 2) Buscar por rango en TODAS las plantillas
    const candidatesByRange = allDiensts.filter(d =>
      inSameWeek(dateStr, d.weekStartDate, (d as any).weekEndDate)
    );
    if (candidatesByRange.length > 0) {
      return candidatesByRange.sort((a, b) => (a.dienstNumber ?? 999) - (b.dienstNumber ?? 999))[0]._id;
    }

    // 3) Plan B: comparar por lunes ISO de la semana
    const mondayIso = mondayOfISO(dateStr);
    const byMonday = (list: Dienst[]) =>
      list.filter(d => d.weekStartDate && isoDate(new Date(d.weekStartDate)) === mondayIso);

    const fromUserMonday = byMonday(userDiensts)[0];
    if (fromUserMonday) return fromUserMonday._id;

    const allMonday = byMonday(allDiensts);
    if (allMonday.length > 0) {
      return allMonday.sort((a, b) => (a.dienstNumber ?? 999) - (b.dienstNumber ?? 999))[0]._id;
    }

    console.warn(`ID del Dienst no encontrado para la fecha ${dateStr}`);
    return "";
  };

  if (loading) return <p>{t("pages.diensts.adminUserTab.loading")}</p>;

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">{t("pages.diensts.adminUserTab.title")}</h2>

      {(() => {
        const today = new Date();
        const dow = today.getDay();
        const back = (dow + 6) % 7;
        const firstMonday = new Date(Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          today.getUTCDate()
        ));
        firstMonday.setUTCDate(firstMonday.getUTCDate() - back);

        const weeks = [0, 1]; // Dos semanas
        return (
          <div className="space-y-8">
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
                <div key={weekOffset}>
                  <p className="text-lg font-semibold text-gray-700 mb-2">
                    {t("pages.diensts.adminPage.weekRange", {
                      from: fmtDate(new Date(weekStart)),
                      to: fmtDate(new Date(weekEnd)),
                    })}
                  </p>
                  <div className="grid grid-cols-7 gap-2">
                    {weekDates.map((dateStr) => {
                      const assignment = assignedDays.find((a) => a.date === dateStr);
                      const bgColor = assignment
                        ? isPartialAssignment(assignment)
                          ? "bg-yellow-100"
                          : "bg-blue-100"
                        : "bg-green-100";

                      return (
                        <div
                          key={dateStr}
                          className={`border rounded p-2 text-sm cursor-pointer hover:shadow ${bgColor}`}
                          onClick={() => {
                            const foundDienstId = assignment ? assignment.dienstId : getDienstIdForDate(dateStr);
                            if (!foundDienstId) {
                              console.warn(`ID del Dienst no encontrado para la fecha ${dateStr}`);
                              return;
                            }
                            setSelectedAssignment({
                              date: dateStr,
                              assignment: assignment || undefined,
                              dienstId: foundDienstId,
                            });
                          }}
                        >
                          <p className="font-semibold">{fmtCellDate(dateStr)}</p>

                          {assignment ? (
                            <>
                              <p className="text-xs">🕒 {assignment.startTime} - {assignment.endTime}</p>
                              <p className="text-xs">🚑 {ambulanceLabel(assignment.ambulanceNumber, assignment.ambulanceId)}</p>
                              <p className="text-xs">👨‍✈️ {assignment.driver?.lastName}, {assignment.driver?.name}</p>
                              <p className="text-xs">🧑‍⚕️ {assignment.medic?.lastName}, {assignment.medic?.name}</p>
                            </>
                          ) : (
                            <p className="text-xs text-green-800 mt-2">🌴 {t("pages.diensts.adminPage.freeDay")}</p>
                          )}
                        </div>
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
          assignment={normalizeAssignmentForModal(selectedAssignment.assignment)}
          dienstId={selectedAssignment.dienstId}
          onClose={() => setSelectedAssignment(null)}
          onUpdate={fetchData}
        />
      )}
    </div>
  );
};

export default AdminUserDienstsTab;
