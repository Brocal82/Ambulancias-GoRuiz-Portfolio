import { useCallback, useEffect, useState } from "react";
import { getAssignedDaysForUser } from "../api/diensts";
import { useAuth } from "../context/AuthContext";
import AssignmentModal from "../components/AssignmentModal";
import { isPartialAssignment } from "../utils/assignmentUtils";
import type { AssignedDay } from "../types/assignedDay";
import type { UserRef } from "../types/dienst";


const WorkerPage = () => {
  const { userId, token } = useAuth();
  const [assignedDays, setAssignedDays] = useState<AssignedDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState<{
    date: string;
    assignment?: AssignedDay;
    dienstId: string;
  } | null>(null);

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

  if (loading) return <p>Cargando días asignados...</p>;

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Tus días asignados</h2>
      <>
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
                            onClick={() =>
                              assignment &&
                              setSelectedAssignment({
                                date: assignment.date,
                                assignment,
                                dienstId: assignment.dienstId,
                              })
                            }
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
                                <p className="text-xs">🚑 {assignment.vehicleNumber}</p>
                                <p className="text-xs">
                                  👨‍✈️ {typeof assignment.driver === 'object' && assignment.driver !== null && 'name' in assignment.driver
                                    ? (assignment.driver as UserRef).name
                                    : ''}
                                </p>
                                <p className="text-xs">
                                  🧑‍⚕️ {typeof assignment.medic === 'object' && assignment.medic !== null && 'name' in assignment.medic
                                    ? (assignment.medic as UserRef).name
                                    : ''}
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
}

export default WorkerPage;









