import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import StatusBadge from "../../../components/common/StatusBadge";
import { useModules } from "../../../hooks/useModules";
import { MODULE_KEYS } from "../../../constants/modules";
import type { AssignedDayFull } from "../../../modules/diensts";
import type { WorkdaySummary } from "../domain";
import ReviewSummary from "./ReviewSummary";

function mapSummaryToAssignedDay(summary: WorkdaySummary): AssignedDayFull {
  const s = summary as WorkdaySummary & {
    dienstId?: string;
    driver?: WorkdaySummary["driver"];
    medic?: WorkdaySummary["medic"];
  };

  return {
    assignmentId: summary.assignmentId,
    dienstId: s.dienstId || summary.assignmentId,
    dienstNumber: s.dienstNumber ?? 0,
    date: summary.date,
    startTime: summary.startTime || "",
    endTime: summary.endTime || "",
    ambulanceId: summary.ambulanceId,
    driver:
      typeof s.driver === "object" && s.driver !== null
        ? s.driver
        : { name: "", lastName: String(s.driver ?? ""), _id: "" },
    medic:
      typeof s.medic === "object" && s.medic !== null
        ? s.medic
        : { name: "", lastName: String(s.medic ?? ""), _id: "" },
  };
}

type Props = {
  summaries: WorkdaySummary[];
  compact?: boolean;
};

/** Bloques de reportes de jornada (parcial + final) reutilizable en modal e inline. */
export default function AdminWorkdaySummaryGroupContent({
  summaries,
  compact = false,
}: Props) {
  const { t } = useTranslation();
  const { hasModule } = useModules();
  const praemienModuleEnabled = hasModule(MODULE_KEYS.PRAEMIEN);

  const sorted = useMemo(() => {
    return [...summaries].sort((a, b) => {
      const aIsPartial = !a.isFinalClosure;
      const bIsPartial = !b.isFinalClosure;
      if (aIsPartial === bIsPartial) return 0;
      return aIsPartial ? -1 : 1;
    });
  }, [summaries]);

  if (sorted.length === 0) return null;

  return (
    <div className={compact ? "space-y-3" : "space-y-6"}>
      {sorted.map((summary) => {
        const s = summary as WorkdaySummary & { reviewedAt?: string };
        const assignedDay = mapSummaryToAssignedDay(summary);
        const reviewedAt = s.reviewedAt;

        const label = summary.isFinalClosure
          ? t("pages.summaries.admin.detail.badge.final", "Final")
          : t("pages.summaries.admin.detail.badge.partial", "Parcial");

        const note =
          summary.extraNote ||
          summary.partialClosureReason ||
          t("pages.summaries.admin.detail.noNote", "Sin nota adicional");

        const ambulanceNumber =
          summary.ambulanceNumber ??
          t("pages.workday.common.unknownAmbulance", "Ambulancia desconocida");

        const initialKm = summary.initialKm;
        const finalKm = summary.finalKm ?? summary.initialKm;

        return (
          <div
            key={
              summary._id ??
              `${summary.assignmentId}-${summary.isFinalClosure ? "final" : "partial"}`
            }
            className={`rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3 ${
              compact ? "p-3" : "p-4"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                <StatusBadge
                  label={label}
                  tone={summary.isFinalClosure ? "emerald" : "amber"}
                  className="text-[11px] font-semibold px-2.5 py-0.5"
                />
                {praemienModuleEnabled && summary.totalEffectivePatients != null ? (
                  <span className="text-[11px] text-slate-700">
                    {t("pages.summaries.admin.detail.effectivePatients", {
                      count: summary.totalEffectivePatients,
                    })}
                  </span>
                ) : null}
              </div>
              {reviewedAt ? (
                <div className="text-[11px] text-slate-500">
                  {new Date(reviewedAt).toLocaleString()}
                </div>
              ) : null}
            </div>

            <p className="text-[12px] text-slate-700 italic">{note}</p>

            <ReviewSummary
              assignedDay={assignedDay}
              ambulanceNumber={ambulanceNumber}
              initialKm={initialKm}
              finalKm={finalKm}
              trips={[...summary.trips].sort((a, b) =>
                a.timeWarning.localeCompare(b.timeWarning),
              )}
              dense
              showPraemieColumn={praemienModuleEnabled}
            />
          </div>
        );
      })}
    </div>
  );
}
