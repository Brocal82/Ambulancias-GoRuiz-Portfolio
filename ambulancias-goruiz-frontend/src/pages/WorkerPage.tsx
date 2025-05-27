import { useEffect, useState } from "react";
import { getDienstByUser } from "../api/diensts";
import type { Dienst, UserRef } from "../types/dienst";
import { useAuth } from "../context/AuthContext";
import AssignmentModal from "../components/AssignmentModal";

const WorkerPage = () => {
  const { userId, token } = useAuth();
  const [diensts, setDiensts] = useState<Dienst[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState<{
  date: string;
  assignment?: Dienst["assignments"][0] & {
    driver: string | UserRef;
    medic: string | UserRef;
  };
  dienstId: string;
} | null>(null);


  useEffect(() => {
    const fetchDiensts = async () => {
      if (!userId || !token) return;
      try {
        const data = await getDienstByUser(userId, token);
        setDiensts(data);
      } catch (error) {
        console.error("Error al obtener los diensts:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDiensts();
  }, [userId, token]);

  if (loading) return <p>Cargando diensts...</p>;

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Tus Diensts</h2>
      <ul className="space-y-8">
        {diensts.map((dienst) => {
          const allWeekDates = Array.from({ length: 14 }, (_, i) => {
            const d = new Date(dienst.weekStartDate);
            d.setDate(d.getDate() + i);
            return d.toISOString().split("T")[0];
          });

          return (
            <li key={dienst.dienstNumber}>
              <div className="mb-2">
                <p className="text-lg font-semibold">Dienst #{dienst.dienstNumber}</p>
                <p className="mb-2 text-sm text-gray-600">
                  Desde el {new Date(dienst.weekStartDate).toLocaleDateString()} hasta el{" "}
                  {new Date(new Date(dienst.weekStartDate).setDate(new Date(dienst.weekStartDate).getDate() + 13)).toLocaleDateString()}
                </p>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {allWeekDates.map((day) => {
                  const assignment = dienst.assignments.find((a) => a.date === day);
                  const bgColor = assignment ? "bg-blue-100" : "bg-green-100";

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
                        <p className="text-xs text-green-800 font-medium mt-2">🌴 Libre</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>

      {/* ✅ Modal reutilizable */}
      {selectedAssignment && (
        <AssignmentModal
          isOpen={true}
          date={selectedAssignment.date}
          assignment={selectedAssignment.assignment}
          dienstId={selectedAssignment.dienstId}
          onClose={() => setSelectedAssignment(null)}
        />
      )}
    </div>
  );
};

export default WorkerPage;
