import { useEffect, useState } from 'react';
import { format } from 'date-fns';

interface Summary {
  date: string;
  totalCountedPatients: number;
}

const WorkerPrämienPage = () => {
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [media, setMedia] = useState(0);
  const [premieLevel, setPremieLevel] = useState('');

  // Simulación de resúmenes del mes
  const fakeSummaries: Summary[] = [
    { date: '2025-07-01', totalCountedPatients: 8 },
    { date: '2025-07-02', totalCountedPatients: 6.5 },
    { date: '2025-07-03', totalCountedPatients: 9 },
    { date: '2025-07-04', totalCountedPatients: 7 },
  ];

  useEffect(() => {
    // En la versión real esto vendrá del backend
    setSummaries(fakeSummaries);
  }, []);

  useEffect(() => {
    if (summaries.length > 0) {
      const total = summaries.reduce((acc, s) => acc + s.totalCountedPatients, 0);
      const avg = total / summaries.length;
      setMedia(Number(avg.toFixed(2)));

      if (avg >= 9) setPremieLevel('🎖 Prämie superior');
      else if (avg >= 8) setPremieLevel('🥈 Prämie mayor');
      else if (avg >= 7) setPremieLevel('🥉 Prämie pequeña');
      else setPremieLevel('❌ No alcanza mínimo');
    }
  }, [summaries]);

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-2xl font-bold mb-4 text-center">Resumen mensual de Prämien</h1>

      <div className="max-w-2xl mx-auto bg-white rounded shadow p-4 mb-6">
        <p className="text-lg">
          Media diaria de pacientes: <strong>{media}</strong>
        </p>
        <p className="text-lg mt-2">
          Nivel alcanzado: <strong>{premieLevel}</strong>
        </p>
      </div>

      <div className="max-w-2xl mx-auto">
        <h2 className="text-xl font-semibold mb-2">Detalles por día:</h2>
        <ul className="bg-white rounded shadow divide-y divide-gray-200">
          {summaries.map((s) => (
            <li key={s.date} className="p-4 flex justify-between">
              <span>{format(new Date(s.date), 'dd/MM/yyyy')}</span>
              <span>{s.totalCountedPatients} pacientes</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default WorkerPrämienPage;
