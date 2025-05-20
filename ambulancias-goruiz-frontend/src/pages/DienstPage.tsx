import { useEffect, useState } from "react";
import { getDienstByUser } from "../api/diensts";
import type { Dienst } from "../types/dienst";

const DienstPage = () => {
  const [diensts, setDiensts] = useState<Dienst[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDiensts = async () => {
      try {
        const data = await getDienstByUser("681cd1ebe89a9eca109dbfac");
        setDiensts(data);
      } catch (error) {
        console.error("Error al obtener los diensts:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDiensts();
  }, []);

  if (loading) return <p>Cargando diensts...</p>;

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Tus Diensts</h2>
      <ul className="space-y-4">
        {diensts.map((dienst, index) => {
          const allWeekDates = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(dienst.weekStartDate);
            d.setDate(d.getDate() + i);
            return d.toISOString().split("T")[0];
          });

          return (
            <li key={index} className="p-4 border rounded bg-gray-100">
              <p className="font-semibold mb-1">
                Dienst #{dienst.dienstNumber}
              </p>
              <p className="mb-2 text-sm text-gray-600">
                Semana del{" "}
                {new Date(dienst.weekStartDate).toLocaleDateString()} al{" "}
                {new Date(dienst.weekEndDate).toLocaleDateString()}
              </p>

              {allWeekDates.map((day) => {
                const assignment = dienst.assignments.find(
                  (a) => a.date === day
                );

                return (
                  <div key={day} className="mb-2 border-t pt-2">
                    <p className="font-medium">📅 {day}</p>
                    {assignment ? (
                      <>
                        <p>
                          🕒 {assignment.startTime} - {assignment.endTime}
                        </p>
                        <p>🚑 Vehículo: {assignment.vehicleNumber}</p>
                        <p>👨‍✈️ Conductor: {assignment.driver?.name}</p>
                        <p>👩‍⚕️ Sanitario: {assignment.medic?.name}</p>
                      </>
                    ) : (
                      <p className="text-green-600">🌴 Día libre</p>
                    )}
                  </div>
                );
              })}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default DienstPage;
