import { useEffect, useState } from 'react';
import type { Dienst } from '../types/dienst';
import { getDienstByUser } from '../api/diensts';
import { useAuth } from '../context/AuthContext';

const WorkerPage = () => {
  const [diensts, setDiensts] = useState<Dienst[]>([]);
  const { userId, token } = useAuth();

  useEffect(() => {
    const fetchDiensts = async () => {
      if (!userId || !token) return;
      try {
        const response = await getDienstByUser(userId, token);
        setDiensts(response); // ✅ ahora está tipado correctamente
      } catch (error) {
        console.error("Error al obtener los diensts:", error);
      }
    };

    fetchDiensts();
  }, [userId, token]);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Tus Diensts</h1>

      {diensts.map((dienst) => (
        <div key={dienst.dienstNumber} className="mb-6 border rounded p-4">
          <h2 className="text-xl font-semibold mb-2">
            Semana {dienst.dienstNumber}: {dienst.weekStartDate} - {dienst.weekEndDate}
          </h2>

          <ul className="space-y-2">
            {dienst.assignments.map(({ date, vehicleNumber, startTime, endTime, driver, medic }, index) => (
              <li key={index} className="border p-2 rounded">
                <strong>Fecha:</strong> {date} <br />
                <strong>Vehículo:</strong> {vehicleNumber} <br />
                <strong>Horario:</strong> {startTime} - {endTime} <br />
                <strong>Conductor:</strong> {driver?.name || 'No asignado'} <br />
                <strong>Sanitario:</strong> {medic?.name || 'No asignado'}

              </li>
            ))}

          </ul>
        </div>
      ))}
    </div>
  );
};

export default WorkerPage;
