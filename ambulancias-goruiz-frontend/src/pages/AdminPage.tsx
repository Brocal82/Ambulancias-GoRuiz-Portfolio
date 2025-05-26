import { useEffect, useState } from 'react';
import type { Dienst } from '../types/dienst';
import { getAllDiensts } from '../api/diensts';
import { useAuth } from '../context/AuthContext';

const AdminPage = () => {
  const [diensts, setDiensts] = useState<Dienst[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<{
    date: string;
    assignment?: Dienst["assignments"][0];
  } | null>(null);

  const { token } = useAuth();

  useEffect(() => {
    const fetchDiensts = async () => {
      if (!token) return;
      try {
        const data = await getAllDiensts(token);
        setDiensts(data);
      } catch (error) {
        console.error("Error al obtener los diensts:", error);
      }
    };

    fetchDiensts();
  }, [token]);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Página de Administrador</h1>

      <ul className="space-y-8">
        {diensts.map((dienst, index) => {
          const allWeekDates = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(dienst.weekStartDate);
            d.setDate(d.getDate() + i);
            return d.toISOString().split("T")[0];
          });

          return (
            <li key={index}>
              <div className="mb-2">
                <p className="text-lg font-semibold">Dienst #{dienst.dienstNumber}</p>
                <p className="mb-2 text-sm text-gray-600">
                  Desde el{" "}
                  {new Date(dienst.weekStartDate).toLocaleDateString()} hasta el{" "}
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
                          assignment: assignment,
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

      {selectedAssignment && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded shadow-md max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">
              Detalle del día: {selectedAssignment.date}
            </h3>

            {selectedAssignment.assignment ? (
              <>
                <p>🕒 {selectedAssignment.assignment.startTime} - {selectedAssignment.assignment.endTime}</p>
                <p>🚑 Vehículo: {selectedAssignment.assignment.vehicleNumber}</p>
                <p>👨‍✈️ Conductor: {selectedAssignment.assignment.driver?.name || 'No asignado'}</p>
                <p>👩‍⚕️ Sanitario: {selectedAssignment.assignment.medic?.name || 'No asignado'}</p>
              </>
            ) : (
              <p className="text-green-700 font-semibold text-center text-xl">
                🌴 Día libre
              </p>
            )}

            <button
              onClick={() => setSelectedAssignment(null)}
              className="mt-6 w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;
