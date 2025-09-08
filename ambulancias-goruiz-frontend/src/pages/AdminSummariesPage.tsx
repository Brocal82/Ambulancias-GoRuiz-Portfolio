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
      if (!groupedByDate[summary.date]) groupedByDate[summary.date] = [];
      groupedByDate[summary.date].push(summary);
    });

  if (loading) {
    return <p className="text-center mt-8">{t("pages.summaries.admin.loading")}</p>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">

      <h1 className="text-2xl font-bold text-center mb-6">
        {t("pages.summaries.admin.title")}
      </h1>

      {Object.entries(groupedByDate).map(([date, summariesForDate]) => (
        <section key={date} className="mb-8">
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-blue-700">
              {t("pages.summaries.admin.dateHeader", {
                date: formatYYYYMMDDToDDMMYYYY(date),
              })}
            </h2>
          </div>
<div className="overflow-x-auto rounded-2xl ring-1 ring-slate-200 bg-white w-full">
  <table className="min-w-full table-fixed text-sm">
    <thead className="bg-gray-100 text-xs uppercase text-gray-600">
      <tr className="text-center">
        <th className="p-2">{t("pages.summaries.admin.table.headers.dienstTime")}</th>
        <th className="p-2">{t("pages.summaries.admin.table.headers.ambulance")}</th>
        <th className="p-2">{t("pages.summaries.admin.table.headers.team")}</th>
        <th className="p-2">{t("pages.summaries.admin.table.headers.kmRange")}</th>
        <th className="p-2">{t("pages.summaries.admin.table.headers.kmTotal")}</th>
        <th className="p-2">{t("pages.summaries.admin.table.headers.trips")}</th>
        <th className="p-2">{t("pages.summaries.admin.table.headers.premie")}</th>
        <th className="p-2">{t("pages.summaries.admin.table.headers.noteReason")}</th>
        <th className="p-2">{t("pages.summaries.admin.table.headers.closure")}</th>
      </tr>
    </thead>

    <tbody className="text-center align-middle">
      {summariesForDate
        .sort((a, b) => {
          if (a.assignmentId !== b.assignmentId) {
            return a.assignmentId.localeCompare(b.assignmentId);
          }
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
                  isExpanded ? "bg-blue-100" : !s.isFinalClosure ? "bg-orange-50" : ""
                }`}
                onClick={() => setExpandedKey(isExpanded ? null : key)}
              >
                {/* Dienst / Horario */}
                <td className="p-2 font-semibold">
                  {t("pages.summaries.admin.row.dienstNumber", { num: s.dienstNumber ?? "-" })}
                  <div className="text-xs text-gray-500">
                    {s.startTime && s.endTime
                      ? `${s.startTime} → ${s.endTime}`
                      : t("pages.summaries.admin.row.noSchedule")}
                  </div>
                </td>

                {/* Ambulancia */}
                <td className="p-2">{s.ambulanceNumber ?? "—"}</td>

                {/* Team */}
                <td className="p-2 whitespace-pre-line leading-tight">
                  {typeof s.driver === "object" && s.driver !== null
                    ? `${s.driver.lastName}, ${s.driver.name}`
                    : "-"}
                  {"\n"}
                  {typeof s.medic === "object" && s.medic !== null
                    ? `${s.medic.lastName}, ${s.medic.name}`
                    : "-"}
                </td>

                {/* Km inicio / fin */}
                <td className="p-2 text-sm whitespace-pre-line leading-tight">
                  {t("pages.summaries.admin.row.start")} {s.initialKm}
                  {"\n"}
                  {t("pages.summaries.admin.row.end")} {s.finalKm}
                </td>

                {/* Km totales */}
                <td className="p-2">{s.totalDienstKm}</td>

                {/* Viajes */}
                <td className="p-2">{typeof s.totalRealTrips === "number" ? s.totalRealTrips : "-"}</td>

                {/* Prämie */}
                <td className="p-2">{s.totalEffectivePatients ?? "-"}</td>

                {/* Nota / Motivo */}
                <td className="p-2">
                  <span className="inline-block max-w-[16ch] truncate align-middle" title={s.extraNote || s.partialClosureReason || "-"}>
                    {s.extraNote || s.partialClosureReason || "-"}
                  </span>
                </td>

                {/* Cierre */}
                <td className="p-2">
                  {s.isFinalClosure
                    ? t("pages.summaries.admin.row.final")
                    : t("pages.summaries.admin.row.partial")}
                </td>
              </tr>

              {isExpanded && (
                <tr>
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
                      hideHeader
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

        </section>
      ))}
    </div>
  );
};

export default AdminSummariesPage;
