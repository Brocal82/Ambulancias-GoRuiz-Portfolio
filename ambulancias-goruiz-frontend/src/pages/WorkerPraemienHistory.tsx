//src/pages/WorkerPraemienHistory.tsx
import { useEffect, useState } from "react";
import type { MonthlyPraemieHistoryItem } from "../api/praemien";
import { getPraemienMonthlyHistory } from "../api/praemien";
import { useAuth } from "../hooks/useAuth";

interface Props {
  userId?: string;
}

const monthNames = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const WorkerPraemienHistory = ({ userId }: Props) => {
  const { token } = useAuth();
  const [history, setHistory] = useState<MonthlyPraemieHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    getPraemienMonthlyHistory(token, userId)
      .then(setHistory)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, userId]);

  if (loading) return <p className="p-4 text-center">Cargando historial mensual...</p>;
  if (history.length === 0)
    return <p className="p-4 text-center text-gray-500">No hay historial mensual disponible.</p>;

  return (
    <div className="max-w-4xl mx-auto p-4 bg-white rounded shadow mt-6">
      <h2 className="text-xl font-semibold mb-4">Historial Mensual de Prämien</h2>
      <table className="table-auto border-collapse border border-gray-300 w-full text-center">
        <thead className="bg-blue-100 sticky top-0">
          <tr>
            <th className="border border-gray-300 px-4 py-2">Año</th>
            <th className="border border-gray-300 px-4 py-2">Mes</th>
            <th className="border border-gray-300 px-4 py-2">Media Pacientes</th>
            <th className="border border-gray-300 px-4 py-2">Nivel Prämie</th>
          </tr>
        </thead>
        <tbody>
          {history.map(({ year, month, averagePatients }) => {
            let premieLevel = "❌ No alcanza mínimo";
            if (averagePatients >= 10) premieLevel = "🏆 Prämie 10";
            else if (averagePatients >= 9) premieLevel = "🎖 Prämie 9";
            else if (averagePatients >= 8) premieLevel = "🥈 Prämie 8";
            else if (averagePatients >= 7) premieLevel = "🥉 Prämie 7";

            return (
              <tr key={`${year}-${month}`} className="hover:bg-blue-50">
                <td className="border border-gray-300 px-4 py-2">{year}</td>
                <td className="border border-gray-300 px-4 py-2">{monthNames[month - 1]}</td>
                <td className="border border-gray-300 px-4 py-2 font-semibold">{(Math.round(averagePatients * 2) / 2).toFixed(1)}</td>
                <td className="border border-gray-300 px-4 py-2">{premieLevel}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default WorkerPraemienHistory;
