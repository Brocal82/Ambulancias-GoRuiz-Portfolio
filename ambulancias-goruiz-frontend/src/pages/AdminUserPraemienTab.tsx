import { useEffect, useState } from "react";
import type { MonthlyPraemieHistoryEntry } from "../types/praemie";
import { getPraemienMonthlyHistory, getMonthlyPraemienSummary } from "../api/praemien";
import { useAuth } from "../hooks/useAuth";

interface Props {
  userId: string;
}

const AdminUserPraemienTab = ({ userId }: Props) => {
  const { token } = useAuth();

  const [history, setHistory] = useState<MonthlyPraemieHistoryEntry[]>([]);
  const [currentSummary, setCurrentSummary] = useState<{ averagePatients: number; premieLevel: string } | null>(null);
  const [loading, setLoading] = useState(true);

useEffect(() => {
  if (!token || !userId) return;

  setLoading(true);

  // Obtener historial mensual
  getPraemienMonthlyHistory(token, userId)
    .then((data) => setHistory(data))
    .catch(console.error);

  // Obtener resumen mensual actual
  getMonthlyPraemienSummary(token, userId)
    .then((data) => {
      let premieLevel = "❌ No alcanza mínimo";
      const avg = data.averagePatients;

      if (avg >= 10) premieLevel = "🏆 Prämie 10";
      else if (avg >= 9) premieLevel = "🎖 Prämie 9";
      else if (avg >= 8) premieLevel = "🥈 Prämie 8";
      else if (avg >= 7) premieLevel = "🥉 Prämie 7";

      setCurrentSummary({ averagePatients: avg, premieLevel });
    })
    .catch(console.error)
    .finally(() => setLoading(false));
}, [token, userId]);


  if (loading) return <p>Cargando datos de prämien...</p>;

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Prämie Actual</h2>
      {currentSummary ? (
        <p>
          Nivel: <strong>{currentSummary.premieLevel}</strong> (Media: {currentSummary.averagePatients.toFixed(2)} pacientes/día)
        </p>
      ) : (
        <p>No hay datos para la prämie actual.</p>
      )}

      <h2 className="text-xl font-semibold mt-8 mb-4">Historial Mensual</h2>
      {history.length === 0 ? (
        <p>No hay historial disponible.</p>
      ) : (
        <div className="max-w-4xl mx-auto p-4 bg-white rounded shadow">
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
            <td className="border border-gray-300 px-4 py-2">{month}</td>
            <td className="border border-gray-300 px-4 py-2 font-semibold">{averagePatients.toFixed(2)}</td>
            <td className="border border-gray-300 px-4 py-2">{premieLevel}</td>
          </tr>
        );
      })}
    </tbody>
  </table>
</div>

      )}
    </div>
  );
};

export default AdminUserPraemienTab;
