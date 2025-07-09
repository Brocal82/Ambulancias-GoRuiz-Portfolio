import { useEffect, useState } from "react";
import { getMonthlyPraemienSummary } from "../api/praemien";
import { useAuth } from "../hooks/useAuth";
import WorkerPraemienHistory from "./WorkerPraemienHistory"; // Importa el componente reutilizable

interface Props {
  userId: string;
}

const AdminUserPraemienTab = ({ userId }: Props) => {
  const { token } = useAuth();

  const [currentSummary, setCurrentSummary] = useState<{ averagePatients: number; premieLevel: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !userId) return;

    setLoading(true);

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
      {/* Reutilizamos el componente que muestra el historial, pasando userId */}
      <WorkerPraemienHistory userId={userId} />
    </div>
  );
};

export default AdminUserPraemienTab;
