import { useCallback, useEffect, useState } from 'react';
import type { Dienst, UserRef } from '../types/dienst';
import { getAllDiensts } from '../api/diensts';
import { useAuth } from '../context/AuthContext';
import AssignmentModal from '../components/AssignmentModal';
import { isPartialAssignment } from '../utils/assignmentUtils';

const AdminPage = () => {
  const [diensts, setDiensts] = useState<Dienst[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<{
    date: string;
    assignment?: Dienst["assignments"][0] & {
      driver: string | UserRef;
      medic: string | UserRef;
    };
    dienstId: string;
  } | null>(null);

  const { token } = useAuth();

  const fetchDiensts = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getAllDiensts(token);
      // Solo Dienst 1-10 (plantillas)
      const plantillas = data.filter((d) => d.dienstNumber >= 1 && d.dienstNumber <= 10);
      setDiensts(plantillas);
    } catch (error) {
      console.error("Error al obtener los diensts:", error);
    }
  }, [token]);

  useEffect(() => {
    fetchDiensts();
  }, [fetchDiensts]);

  // 🔁 Genera las 3 semanas a partir del lunes más cercano
  const getWeekStartDates = () => {
    const today = new Date();
    const monday = new Date(today);
    const day = monday.getDay();
    const diff = day === 0 ? -6 : 1 - day; // domingo => -6, lunes => 0, martes => -1, ...
    monday.setDate(monday.getDate() + diff);
    return [0, 1, 2].map((i) => {
      const copy = new Date(monday);
      copy.setDate(copy.getDate() + i * 7);
      return copy;
    });
  };

  const weekStartDates = getWeekStartDates();

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Página de Administrador</h1>

      {weekStartDates.map((weekStart, index) => {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        return (
          <div key={index} className="mb-10">
            <h2 className="text-lg font-semibold mb-2">
              Semana del {weekStart.toLocaleDateString()} al {weekEnd.toLocaleDateString()}
            </h2>

            {diensts.map((dienst) => {
              // Para esta semana, regeneramos las fechas
              const weekDates = Array.from({ length: 7 }, (_, i) => {
                const d = new Date(weekStart);
                d.setDate(d.getDate() + i);
                return d.toISOString().split("T")[0];
              });

              return (
                <div key={`${index}-${dienst.dienstNumber}`} className="mb-6">
                  <p className="font-semibold text-md mb-1">Dienst #{dienst.dienstNumber}</p>
                  <div className="grid grid-cols-7 gap-2">
                    {weekDates.map((day) => {
                      const assignment = dienst.assignments.find((a) => a.date === day);
                      const bgColor = assignment
                        ? isPartialAssignment(assignment)
                          ? "bg-yellow-100"
                          : "bg-blue-100"
                        : "bg-green-100";

                      return (
                        <div
                          key={day}
                          className={`border rounded p-2 text-sm cursor-pointer hover:shadow ${bgColor}`}
                          onClick={() =>
                            setSelectedAssignment({
                              date: day,
                              assignment,
                              dienstId: dienst._id,
                            })
                          }
                        >
                          <p className="font-semibold">
                            {new Date(day).toLocaleDateString("es-ES", {
                              weekday: "short",
                              day: "2-digit",
                              month: "2-digit",
                            })}
                          </p>
                          {assignment ? (
                            <>
                              <p className="text-xs">🕒 {assignment.startTime} - {assignment.endTime}</p>
                              <p className="text-xs">🚑 {assignment.vehicleNumber}</p>
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
      })}

      {selectedAssignment && (
        <AssignmentModal
          isOpen={true}
          date={selectedAssignment.date}
          assignment={selectedAssignment.assignment}
          dienstId={selectedAssignment.dienstId}
          onClose={() => setSelectedAssignment(null)}
          onUpdate={fetchDiensts}
        />
      )}
    </div>
  );
};

export default AdminPage;
