//frontend/src/pages/AdminSummariesPage
import { useEffect, useState, Fragment } from "react";
import { getAllSummaries } from "../api/workdaySummary";
import type { WorkdaySummary } from "../types/workdaySummary";
import ReviewSummary from "../components/workday/ReviewSummary";
import { useAuth } from "../hooks/useAuth";

const AdminSummariesPage = () => {
  const [summaries, setSummaries] = useState<WorkdaySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const { token } = useAuth();

  useEffect(() => {
    if (!token) return;

    const fetchSummaries = async () => {
      try {
        const data = await getAllSummaries(token);
        setSummaries(data);
        console.log("✅ Summaries recibidos:", data);
        console.log("🧾 totalRealTrips:", data.map(s => s.totalRealTrips));

      } catch (error) {
        console.error("❌ Error al obtener resúmenes:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSummaries();
  }, [token]);

  const groupedByDate: Record<string, WorkdaySummary[]> = {};

  summaries
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .forEach((summary) => {
      if (!groupedByDate[summary.date]) {
        groupedByDate[summary.date] = [];
      }
      groupedByDate[summary.date].push(summary);
    });

  if (loading) return <p className="text-center mt-8">Cargando resúmenes...</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-center mb-6">📄 Reportes Finales de Jornada</h1>

      {Object.entries(groupedByDate).map(([date, summariesForDate]) => (
        <div key={date} className="mb-10">
          <h2 className="text-lg font-semibold mb-2 pl-2 text-blue-700">📅 {date}</h2>

          <div className="overflow-x-auto">
            <table className="min-w-full bg-white rounded shadow">
              <thead className="bg-gray-100 text-xs uppercase text-gray-600">
                <tr>
                  <th className="p-2">Dienst / Horario</th>
                  <th>Ambulancia</th>
                  <th>👥 Team</th>
                  <th>Km (inicio → fin)</th>
                  <th>Km Totales</th>
                  <th>🧾 Viajes</th>
                  <th>💰 Prämie</th>
                  <th>Nota / Motivo</th>
                  <th>Cierre</th>
                </tr>
              </thead>

              <tbody className="text-sm text-center">
                {summariesForDate
                  .sort((a, b) => {
                    // Agrupa primero por assignmentId para que parcial y final estén juntos
                    if (a.assignmentId !== b.assignmentId) {
                      return a.assignmentId.localeCompare(b.assignmentId);
                    }
                    // Dentro del mismo assignmentId, muestra primero el parcial
                    const aIsPartial = !a.isFinalClosure;
                    const bIsPartial = !b.isFinalClosure;
                    return aIsPartial === bIsPartial ? 0 : aIsPartial ? -1 : 1;
                  })
                  .map((s, i) => {
                    const key = `${s.assignmentId}-${i}`;
                    const isExpanded = expandedKey === key;

                    return (
                      <Fragment key={key}>
                        <tr
                          className={`border-t hover:bg-blue-50 cursor-pointer ${isExpanded
                              ? "bg-blue-100"
                              : !s.isFinalClosure
                                ? "bg-orange-50"
                                : ""
                            }`}
                          onClick={() => setExpandedKey(isExpanded ? null : key)}
                        >
                          {/* Dienst / Horario */}
                          <td className="p-2 font-semibold">
                            Dienst #{s.dienstNumber ?? "-"}
                            <br />
                            <span className="text-xs text-gray-500">
                              {s.startTime && s.endTime ? `${s.startTime} → ${s.endTime}` : "Sin horario"}
                            </span>
                          </td>

                          {/* Ambulancia */}
                          <td>{s.ambulanceNumber ?? "—"}</td>


                          {/* 👥 Team */}
                          <td className="whitespace-nowrap leading-tight">
                            {typeof s.driver === "object" && s.driver !== null
                              ? `${s.driver.lastName}, ${s.driver.name}`
                              : "-"}
                            <br />
                            {typeof s.medic === "object" && s.medic !== null
                              ? `${s.medic.lastName}, ${s.medic.name}`
                              : "-"}
                          </td>

                          {/* Km inicio / fin */}
                          <td className="whitespace-nowrap leading-tight text-sm">
                            <span className="text-gray-500">Inicio:</span> {s.initialKm}
                            <br />
                            <span className="text-gray-500">Final:</span> {s.finalKm}
                          </td>

                          {/* Km totales */}
                          <td>{s.totalDienstKm}</td>

                          {/* 🧾 Viajes */}
                          <td>{typeof s.totalRealTrips === "number" ? s.totalRealTrips : "-"}</td>


                          {/* 💰 Prämie */}
                          <td>{s.totalEffectivePatients ?? "-"}</td>

                          {/* Nota / Motivo */}
                          <td>{s.extraNote || s.partialClosureReason || "-"}</td>

                          {/* Cierre */}
                          <td>{s.isFinalClosure ? "✅ Final" : "🕗 Parcial"}</td>
                        </tr>

                        {isExpanded && (
                          <tr key={`${key}-details`}>
                            <td colSpan={9} className="p-4 bg-green-50 border border-green-400 rounded-lg shadow-sm">
                              <ReviewSummary
                                assignedDay={{
                                  assignmentId: s.assignmentId,
                                  dienstId: s.dienstId || s.assignmentId,
                                  dienstNumber: s.dienstNumber ?? 0,
                                  date: s.date,
                                  startTime: s.startTime || "",
                                  endTime: s.endTime || "",
                                  ambulanceId: s.ambulanceId,
                                  driver:
                                    typeof s.driver === "object"
                                      ? s.driver
                                      : { name: "", lastName: s.driver as string, _id: "" },
                                  medic:
                                    typeof s.medic === "object"
                                      ? s.medic
                                      : { name: "", lastName: s.medic as string, _id: "" },
                                }}
                                ambulanceNumber={s.ambulanceNumber ?? ""}
                                initialKm={s.initialKm}
                                finalKm={s.finalKm}
                                trips={[...s.trips].sort((a, b) => a.timeWarning.localeCompare(b.timeWarning))}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>


                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AdminSummariesPage;
