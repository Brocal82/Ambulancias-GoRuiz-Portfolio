// frontend/src/pages/AdminSummariesPage.tsx
import { useEffect, useState, Fragment } from "react";
import { getAllSummaries } from "../api/workdaySummary";
import type { WorkdaySummary } from "../types/workdaySummary";
import ReviewSummary from "../components/workday/ReviewSummary";
import { useAuth } from "../hooks/useAuth";
import { formatYYYYMMDDToDDMMYYYY } from "../utils/timeUtils";
import { useTranslation } from "react-i18next";

const AdminSummariesPage = () => {
  const [summaries, setSummaries] = useState<WorkdaySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const { token } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    if (!token) return;

    const fetchSummaries = async () => {
      try {
        const data = await getAllSummaries(token);
        setSummaries(data);
        console.log("✅ Summaries recibidos:", data);
        console.log("🧾 totalRealTrips:", data.map((s) => s.totalRealTrips));
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

  if (loading) {
    return (
      <p className="text-center mt-8">
        {t("pages.summaries.admin.loading")}
      </p>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-center mb-6">
        {t("pages.summaries.admin.title")}
      </h1>

      {Object.entries(groupedByDate).map(([date, summariesForDate]) => (
        <div key={date} className="mb-10">
          <h2 className="text-lg font-semibold mb-2 pl-2 text-blue-700">
            {t("pages.summaries.admin.dateHeader", {
              date: formatYYYYMMDDToDDMMYYYY(date),
            })}
          </h2>

          <div className="overflow-x-auto">
            <table className="min-w-full bg-white rounded shadow">
              <thead className="bg-gray-100 text-xs uppercase text-gray-600">
                <tr>
                  <th className="p-2">
                    {t("pages.summaries.admin.table.headers.dienstTime")}
                  </th>
                  <th>{t("pages.summaries.admin.table.headers.ambulance")}</th>
                  <th>{t("pages.summaries.admin.table.headers.team")}</th>
                  <th>{t("pages.summaries.admin.table.headers.kmRange")}</th>
                  <th>{t("pages.summaries.admin.table.headers.kmTotal")}</th>
                  <th>{t("pages.summaries.admin.table.headers.trips")}</th>
                  <th>{t("pages.summaries.admin.table.headers.premie")}</th>
                  <th>{t("pages.summaries.admin.table.headers.noteReason")}</th>
                  <th>{t("pages.summaries.admin.table.headers.closure")}</th>
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
                          className={`border-t hover:bg-blue-50 cursor-pointer ${
                            isExpanded
                              ? "bg-blue-100"
                              : !s.isFinalClosure
                              ? "bg-orange-50"
                              : ""
                          }`}
                          onClick={() =>
                            setExpandedKey(isExpanded ? null : key)
                          }
                        >
                          {/* Dienst / Horario */}
                          <td className="p-2 font-semibold">
                            {t("pages.summaries.admin.row.dienstNumber", {
                              num: s.dienstNumber ?? "-",
                            })}
                            <br />
                            <span className="text-xs text-gray-500">
                              {s.startTime && s.endTime
                                ? `${s.startTime} → ${s.endTime}`
                                : t("pages.summaries.admin.row.noSchedule")}
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
                            <span className="text-gray-500">
                              {t("pages.summaries.admin.row.start")}
                            </span>{" "}
                            {s.initialKm}
                            <br />
                            <span className="text-gray-500">
                              {t("pages.summaries.admin.row.end")}
                            </span>{" "}
                            {s.finalKm}
                          </td>

                          {/* Km totales */}
                          <td>{s.totalDienstKm}</td>

                          {/* 🧾 Viajes */}
                          <td>
                            {typeof s.totalRealTrips === "number"
                              ? s.totalRealTrips
                              : "-"}
                          </td>

                          {/* 💰 Prämie */}
                          <td>{s.totalEffectivePatients ?? "-"}</td>

                          {/* Nota / Motivo */}
                          <td>{s.extraNote || s.partialClosureReason || "-"}</td>

                          {/* Cierre */}
                          <td>
                            {s.isFinalClosure
                              ? t("pages.summaries.admin.row.final")
                              : t("pages.summaries.admin.row.partial")}
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr key={`${key}-details`}>
                            <td
                              colSpan={9}
                              className="p-4 bg-green-50 border border-green-400 rounded-lg shadow-sm"
                            >
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
                                      : {
                                          name: "",
                                          lastName: s.driver as string,
                                          _id: "",
                                        },
                                  medic:
                                    typeof s.medic === "object"
                                      ? s.medic
                                      : {
                                          name: "",
                                          lastName: s.medic as string,
                                          _id: "",
                                        },
                                }}
                                ambulanceNumber={s.ambulanceNumber ?? ""}
                                initialKm={s.initialKm}
                                finalKm={s.finalKm}
                                trips={[...s.trips].sort((a, b) =>
                                  a.timeWarning.localeCompare(b.timeWarning)
                                )}
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
