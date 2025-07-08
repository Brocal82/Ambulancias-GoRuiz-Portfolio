import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { getMonthlyPraemienSummary } from '../api/praemien';
import type { MonthlyPraemienDay } from '../api/praemien';
import { saveMonthlyPraemie } from '../api/praemienHistory';
import { useAuth } from '../hooks/useAuth';

const PRAMIEN_LEVELS = [7, 8, 9, 10];

const WorkerPraemienPage = () => {
  const { token } = useAuth();

  const [summaries, setSummaries] = useState<MonthlyPraemienDay[]>([]);
  const [media, setMedia] = useState(0);
  const [premieLevel, setPremieLevel] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;

    setLoading(true);
    setError('');

    getMonthlyPraemienSummary(token)
      .then((data) => {
        setSummaries(data.monthlyData);
        setMedia(data.averagePatients);
      })
      .catch(() => {
        setError('Error al cargar los datos de premios.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

useEffect(() => {
  if (media >= 10) setPremieLevel('🏆 Prämie 10');
  else if (media >= 9) setPremieLevel('🎖 Prämie 9');
  else if (media >= 8) setPremieLevel('🥈 Prämie 8');
  else if (media >= 7) setPremieLevel('🥉 Prämie 7');
  else setPremieLevel('❌ No alcanza mínimo');
}, [media]);

useEffect(() => {
  if (!token) return;
  if (media === 0) return;

  console.log('Guardando resumen mensual...', { media, premieLevel });

  const now = new Date();
  const monthString = now.toISOString().slice(0, 7); // 'YYYY-MM'

  saveMonthlyPraemie(token, {
    month: monthString,
    averagePatients: media,
    premieLevel,
  })
    .then(() => console.log('Resumen mensual guardado correctamente'))
    .catch(() => console.warn('No se pudo guardar el resumen mensual.'));
}, [media, premieLevel, token]);



  // Calcula % cumplimiento para cada prämie y diferencia media diaria
  const calculatePraemieStats = (threshold: number) => {
    let totalDifference = 0;
    summaries.forEach((day) => {
      totalDifference += day.totalCountedPatients - threshold;
    });
    const totalDays = summaries.length || 1; // evitar división por cero
    const averageDiff = totalDifference / totalDays;

    const percentage = Math.min(
      100,
      Math.max(0, (media / threshold) * 100)
    );

    return {
      percentage,
      averageDiff: Math.round(averageDiff * 10) / 10, // redondeo decimal
    };
  };

  if (loading) return <p className="p-4 text-center">Cargando resumen de premios...</p>;
  if (error) return <p className="p-4 text-center text-red-500">{error}</p>;

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-extrabold mb-6 text-center text-blue-700">
        🎖 Resumen mensual de Prämien
      </h1>

      {/* Nivel global alcanzado */}
      {media > 0 && (
        <p className="text-center text-lg font-semibold mb-8">
          Nivel global alcanzado: <span className="text-blue-700">{premieLevel}</span>
        </p>
      )}

      {/* Barras de prämien */}
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow p-6 mb-8">
        {PRAMIEN_LEVELS.map((level) => {
          const { percentage, averageDiff } = calculatePraemieStats(level);
          const isPositive = averageDiff >= 0;

          return (
            <div key={level} className="mb-6">
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-lg">
                  {level} pacientes / día
                </span>
                <span
                  className={`font-mono text-xl ${isPositive ? "text-green-600" : "text-red-600"
                    }`}
                >
                  {isPositive ? "+" : ""}
                  {averageDiff}
                </span>
              </div>

              {/* Barra */}
              <div className="w-full h-6 rounded bg-gray-300 overflow-hidden">
                <div
                  className={`h-6 rounded bg-gradient-to-r ${isPositive
                      ? "from-green-400 to-green-600"
                      : "from-red-400 to-red-600"
                    }`}
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Historial diario */}
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Historial diario</h2>

        <div className="overflow-y-auto max-h-96 border rounded">
          <table className="w-full text-left table-auto border-collapse">
            <thead className="bg-blue-100 sticky top-0">
              <tr>
                <th className="px-4 py-2 border-b border-blue-300">Fecha</th>
                <th className="px-4 py-2 border-b border-blue-300">Pacientes</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map(({ date, totalCountedPatients }) => (
                <tr
                  key={date}
                  className="hover:bg-blue-50 transition-colors cursor-default"
                >
                  <td className="px-4 py-2 border-b border-gray-200">
                    {format(new Date(date), "dd/MM/yyyy")}
                  </td>
                  <td className="px-4 py-2 border-b border-gray-200 font-semibold">
                    {totalCountedPatients}
                  </td>
                </tr>
              ))}
              {summaries.length === 0 && (
                <tr>
                  <td colSpan={2} className="text-center py-6 text-gray-400">
                    No hay datos disponibles
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default WorkerPraemienPage;
