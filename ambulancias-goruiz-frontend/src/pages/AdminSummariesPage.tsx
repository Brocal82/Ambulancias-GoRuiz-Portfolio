import { useEffect, useState } from "react";
import { getAllSummaries } from "../api/workdaySummary";
import type { WorkdaySummary } from "../types/workdaySummary";
import ReviewSummary from "../components/workday/ReviewSummary";
import { useAuth } from "../hooks/useAuth";

const AdminSummariesPage = () => {
  const [summaries, setSummaries] = useState<WorkdaySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<WorkdaySummary | null>(null);

  const { token } = useAuth();

  useEffect(() => {
    if (!token) return;

    const fetchSummaries = async () => {
      try {
        const data = await getAllSummaries(token);
        setSummaries(data);
        console.log("✅ Summaries recibidos:", data);
      } catch (error) {
        console.error("❌ Error al obtener resúmenes:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSummaries();
  }, [token]);

  const groupedSummaries = summaries
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .reduce<Record<string, WorkdaySummary[]>>((acc, summary) => {
      const key = `${summary.date}__${summary.assignmentId}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(summary);
      return acc;
    }, {});

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
            {Object.entries(groupedSummaries).map(([key, summariesInGroup]) => {
              const isExpanded = expandedKey === key;

              return (
                <Fragment key={key}>
                  {summariesInGroup
                    .sort((a, b) => {
                      const aIsPartial = !a.isFinalClosure;
                      const bIsPartial = !b.isFinalClosure;
                      return aIsPartial === bIsPartial ? 0 : aIsPartial ? -1 : 1;
                    })
                    .map((s, i) => (
                      <tr
                        key={`${key}-${i}`}
                        className={`border-t hover:bg-blue-50 cursor-pointer ${isExpanded ? "bg-blue-100" : ""}`}
                        onClick={() => {
                          if (isExpanded) {
                            setExpandedKey(null);
                            setSelectedSummary(null);
                          } else {
                            setExpandedKey(key);
                            setSelectedSummary(s);
                          }
                        }}
                      >
                        <td className="p-2">{s.date}</td>
                        <td>{s.vehicleNumber}</td>
                        <td>{s.initialKm} → {s.finalKm}</td>
                        <td>{s.totalDienstKm}</td>
                        <td>
                          {typeof s.driver === "object" && s.driver !== null
                            ? `${s.driver.lastName}, ${s.driver.name}`
                            : "-"}
                        </td>
                        <td>
                          {typeof s.medic === "object" && s.medic !== null
                            ? `${s.medic.lastName}, ${s.medic.name}`
                            : "-"}
                        </td>
                        <td>{s.totalEffectivePatients ?? "-"}</td>
                        <td>{s.extraNote || s.partialClosureReason || "-"}</td>
                        <td>{s.isFinalClosure ? "✅ Final" : "🕗 Parcial"}</td>
                      </tr>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Panel de detalles fuera de la tabla */}
      {selectedSummary && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg shadow">
          <ReviewSummary
            assignedDay={{
              assignmentId: selectedSummary.assignmentId,
              dienstId: selectedSummary.assignmentId,
              dienstNumber: 0,
              date: selectedSummary.date,
              startTime: "",
              endTime: "",
              vehicleNumber: selectedSummary.vehicleNumber,
              driver:
                typeof selectedSummary.driver === "object"
                  ? selectedSummary.driver
                  : { name: "", lastName: selectedSummary.driver as string, _id: "" },
              medic:
                typeof selectedSummary.medic === "object"
                  ? selectedSummary.medic
                  : { name: "", lastName: selectedSummary.medic as string, _id: "" },
            }}
            vehicleNumber={selectedSummary.vehicleNumber}
            initialKm={selectedSummary.initialKm}
            finalKm={selectedSummary.finalKm}
            trips={[...selectedSummary.trips].sort((a, b) =>
              a.timeWarning.localeCompare(b.timeWarning)
            )}
          />
        </div>
      )}
    </div>
  );
};

import { Fragment } from "react";
export default AdminSummariesPage;
