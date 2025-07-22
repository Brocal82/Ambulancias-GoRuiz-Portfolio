// frontend/src/components/admin/AdminUserDienstsTab.tsx
import { useCallback, useEffect, useState } from "react";
import { getDienstByUser, getAssignedDaysForUser } from "../api/diensts";
import AssignmentModal from "../components/AssignmentModal";
import { isPartialAssignment } from "../utils/assignmentUtils";
import type { AssignedDayFull } from "../types/dienst";
import { useAuth } from "../hooks/useAuth";
import type { Dienst } from '../types/dienst';

interface Props {
  userId: string;
}

const AdminUserDienstsTab = ({ userId }: Props) => {
  const { token } = useAuth();
  const [diensts, setDiensts] = useState<Dienst[]>([]);
  const [assignedDays, setAssignedDays] = useState<AssignedDayFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState<{
    date: string;
    assignment?: AssignedDayFull;
    dienstId: string;
  } | null>(null);

  const fetchAssignedDays = useCallback(async () => {
    if (!userId || !token) return;

    setLoading(true);
    try {
      // Carga ambas APIs paralelamente
      const [assignedDaysData, dienstsData] = await Promise.all([
        getAssignedDaysForUser(userId, token),
        getDienstByUser(userId, token),
      ]);
      setAssignedDays(assignedDaysData);
      setDiensts(dienstsData);
    } catch (error) {
      console.error("Error al obtener los días asignados y diensts:", error);
    } finally {
      setLoading(false);
    }
  }, [userId, token]);

 useEffect(() => {
  fetchAssignedDays();
}, [fetchAssignedDays]);


const getDienstIdForDate = (dateStr: string): string => {
  const targetDate = new Date(dateStr);

  for (const dienst of diensts) {
    if (!dienst.weekStartDate || !dienst.weekEndDate) continue;

    const start = new Date(dienst.weekStartDate);
    const end = new Date(dienst.weekEndDate);

    // Si dateStr está dentro de la semana del dienst
    if (targetDate >= start && targetDate <= end) {
      return dienst._id;
    }
  }

  console.warn(`ID del Dienst no encontrado para la fecha ${dateStr}`);
  return '';
};




  if (loading) return <p>Cargando días asignados...</p>;

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Diensts asignados</h2>

      {(() => {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const daysToSubtract = (dayOfWeek + 6) % 7;
        const firstMonday = new Date(today);
        firstMonday.setDate(today.getDate() - daysToSubtract);

        const weeks = [0, 1]; // Dos semanas
        return (
          <div className="space-y-8">
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
                <div key={weekOffset}>
                  <p className="text-lg font-semibold text-gray-700 mb-2">
                    Semana del {weekStart.toLocaleDateString("es-ES")} al {weekEnd.toLocaleDateString("es-ES")}
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
                            }
                            setSelectedAssignment({
                              date: dateStr,
                              assignment: assignment || undefined,
                              dienstId: foundDienstId,
                            });
                          }}


                        >
                          <p className="font-semibold">
                            {new Date(dateStr).toLocaleDateString("es-ES", {
                              weekday: "short",
                              day: "2-digit",
                              month: "2-digit",
                            })}
                          </p>
                          {assignment ? (
                            <>
                              <p className="text-xs">
                                🕒 {assignment.startTime} - {assignment.endTime}
                              </p>
                              <p className="text-xs">
                                  🚑 {assignment.ambulanceNumber ?? assignment.ambulanceId ?? "—"}
                              </p>

                              <p className="text-xs">
                                👨‍✈️ {assignment.driver?.lastName}, {assignment.driver?.name}
                              </p>
                              <p className="text-xs">
                                🧑‍⚕️ {assignment.medic?.lastName}, {assignment.medic?.name}
                              </p>
                            </>
                          ) : (
                            <p className="text-xs text-green-800 mt-2">🌴 Libre</p>
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
    assignment={
      selectedAssignment.assignment
        ? {
            ...selectedAssignment.assignment,
            ambulanceId: selectedAssignment.assignment.ambulanceId ?? "",
          }
        : undefined
    }
    dienstId={selectedAssignment.dienstId}
    onClose={() => setSelectedAssignment(null)}
    onUpdate={fetchAssignedDays}
  />
)}
    </div>
  );
};

export default AdminUserDienstsTab;
