import { useEffect, useState } from 'react';
import type { Dienst } from '../types/dienst';
import { getAllDiensts } from '../api/diensts';
import { useAuth } from '../context/AuthContext';

const AdminPage = () => {
  const [diensts, setDiensts] = useState<Dienst[]>([]);

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
      <ul>
        {diensts.map((dienst, index) => (
          <li key={index} className="mb-2 p-2 border rounded bg-gray-100">
            <p className="font-semibold">
              Semana: {dienst.weekStartDate} - {dienst.weekEndDate}
            </p>
            {dienst.assignments.map((assign, idx) => (
              <div key={idx} className="ml-4 mt-1">
                🚑 Vehículo {assign.vehicleNumber} | {assign.date} | {assign.startTime} - {assign.endTime}
                <br />
                👨‍✈️ Conductor: {assign.driver?.name ?? 'No asignado'} | 🧑‍⚕️ Sanitario: {assign.medic?.name ?? 'No asignado'}
              </div>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AdminPage;
