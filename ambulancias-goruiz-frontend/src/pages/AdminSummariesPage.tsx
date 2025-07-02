// frontend/src/pages/AdminSummariesPage.tsx
import { useEffect, useState } from "react";
import { getAllSummaries } from "../api/workdaySummary";
import type { WorkdaySummary } from "../types/workdaySummary";
import { useAuth } from "../hooks/useAuth";

const AdminSummariesPage = () => {
  const [summaries, setSummaries] = useState<WorkdaySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();

useEffect(() => {
  if (!token) return;

  const fetchSummaries = async () => {
    try {
      const data = await getAllSummaries(token);
      setSummaries(data);
    } catch (error) {
      console.error("❌ Error al obtener resúmenes:", error);
    } finally {
      setLoading(false);
    }
  };

  fetchSummaries();
}, [token]);


  if (loading) return <p className="text-center mt-8">Cargando resúmenes...</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-center mb-6">📄 Reportes Finales de Jornada</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white rounded shadow">
          <thead className="bg-gray-100 text-xs uppercase text-gray-600">
            <tr>
              <th className="p-2">Fecha</th>
              <th>Ambulancia</th>
              <th>Km (inicio → fin)</th>
              <th>Km Totales</th>
              <th>Driver</th>
              <th>Medic</th>
              <th>Pacientes</th>
              <th>Nota / Motivo</th>
              <th>Cierre</th>
            </tr>
          </thead>
          <tbody className="text-sm text-center">
            {summaries.map((s, i) => (
              <tr key={i} className="border-t">
                <td className="p-2">{s.date}</td>
                <td>{s.vehicleNumber}</td>
                <td>{s.initialKm} → {s.finalKm}</td>
                <td>{s.totalDienstKm}</td>
                <td>{s.driver}</td>
                <td>{s.medic}</td>
                <td>{s.totalEffectivePatients ?? "-"}</td>
                <td>{s.extraNote || s.partialClosureReason || "-"}</td>
                <td>{s.isFinalClosure ? "✅ Final" : "🕗 Parcial"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminSummariesPage;
