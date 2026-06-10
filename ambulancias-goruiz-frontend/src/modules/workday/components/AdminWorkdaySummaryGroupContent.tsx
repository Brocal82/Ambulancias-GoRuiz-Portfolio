import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import StatusBadge from "../../../components/common/StatusBadge";
import { useModules } from "../../../hooks/useModules";
import { MODULE_KEYS } from "../../../constants/modules";
import type { AssignedDayFull } from "../../../modules/diensts";
import type { WorkdaySummary } from "../domain";
import ReviewSummary from "./ReviewSummary";

function resolveSummarySubmittedAt(
  summary: WorkdaySummary & { createdAt?: string },
): Date | null {
  if (summary.createdAt) {
    const created = new Date(summary.createdAt);
    if (!Number.isNaN(created.getTime())) return created;
  }

  const id = summary._id;
  if (id && /^[a-f0-9]{24}$/i.test(id)) {
    return new Date(parseInt(id.slice(0, 8), 16) * 1000);
  }

  return null;
}

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
        const assignedDay = mapSummaryToAssignedDay(summary);
        const submittedAt = resolveSummarySubmittedAt(summary);

        const label = summary.isFinalClosure
          ? t("pages.summaries.admin.detail.badge.final")
          : t("pages.summaries.admin.detail.badge.partial");

        const noteText = (
          summary.extraNote ||
          summary.partialClosureReason ||
          ""
        ).trim();

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
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {submittedAt ? (
                  <time
                    dateTime={submittedAt.toISOString()}
                    className="block text-[11px] text-slate-500"
                  >
                    {submittedAt.toLocaleString()}
                  </time>
                ) : null}
              </div>
              <StatusBadge
                label={label}
                tone={summary.isFinalClosure ? "emerald" : "amber"}
                className="shrink-0 text-[11px] font-semibold px-2.5 py-0.5"
              />
            </div>

            {noteText ? (
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] leading-snug text-slate-700">
                {noteText}
              </div>
            ) : null}

            <div className="w-full min-w-0">
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
              totalEffectivePatients={
                praemienModuleEnabled ? summary.totalEffectivePatients : null
              }
            />
            </div>
          </div>
        );
      })}
    </div>
  );
}
