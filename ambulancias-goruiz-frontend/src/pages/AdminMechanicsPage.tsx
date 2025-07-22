// frontend/src/pages/AdminMechanicsPage.tsx

import { useEffect, useState } from "react";
import { getAllIssueReports } from "../api/workdaySummary";
import type { WorkdayIssue } from "../types/workdayIssue";
import { useAuth } from "../hooks/useAuth";
import { toast } from "react-toastify";
import { getAllAmbulances } from "../api/ambulances";
import type { Ambulance } from "../types/ambulance";

const AdminMechanicsPage = () => {
  const { token } = useAuth();
  const [issues, setIssues] = useState<WorkdayIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);


useEffect(() => {
  const fetchData = async () => {
    try {
      if (!token) return;

      // 🔧 Cargar reportes de avería
      const issuesData = await getAllIssueReports(token);
      const sortedIssues = [...issuesData].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setIssues(sortedIssues);

      // 🚑 Cargar ambulancias registradas
      const ambulancesData = await getAllAmbulances(token);
      setAmbulances(ambulancesData);

      // 👇 Agregado para debug
      console.log("🩺 Ambulancias cargadas:", ambulancesData);
    } catch (err) {
      console.error("❌ Error al cargar reportes o ambulancias:", err);
      toast.error("❌ Error al cargar reportes o ambulancias.");
    } finally {
      setLoading(false);
    }
  };

  fetchData();
}, [token]);



  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">🔧 Reportes técnicos de averías</h1>

      {loading ? (
        <p>Cargando averías...</p>
      ) : issues.length === 0 ? (
        <p className="text-gray-600">No hay reportes de avería aún.</p>
      ) : (
        <ul className="space-y-6">
          {issues.map((issue) => (
            <li key={issue._id} className="bg-white border border-gray-200 p-5 rounded-lg shadow hover:shadow-md transition">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Dienst #{issue.dienstNumber}</span>
                <span className="text-sm text-gray-600">{new Date(issue.timestamp).toLocaleString()}</span>
              </div>

              <p className="text-sm text-gray-700">
                <strong>📅 Fecha:</strong> {issue.date}
              </p>
              <p className="text-sm text-gray-700">
                <strong>⏱ Horario:</strong> {issue.startTime} – {issue.endTime}
              </p>
              <p className="text-sm text-gray-700">
                <strong>👥 Equipo:</strong> {issue.team}
              </p>
              <p className="text-sm text-gray-700">
  <strong>🚐 Ambulancia:</strong>{" "}
  {(() => {
    console.log("🔍 Buscando ID:", issue.ambulanceId); // 👈 AÑADIDO
    const amb = ambulances.find(a => a._id === issue.ambulanceId);
    return amb
      ? `${amb.ambulanceNumber} — ${amb.brand} ${amb.modelName} (Matrícula: ${amb.licensePlate})`
      : `${issue.vehicleNumber} (ID: ${issue.ambulanceId})`;
  })()}
</p>


              <p className="text-sm text-gray-700">
                <strong>📏 KM finales:</strong> {issue.finalKm}
              </p>
              <div className="mt-3 bg-red-50 border-l-4 border-red-400 p-3 rounded">
                <p className="text-red-800 text-sm whitespace-pre-line">
                  <strong>🛠️ Avería:</strong> {issue.issueText}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AdminMechanicsPage;
