import { useMemo, useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";

import StatusBadge from "../../../components/common/StatusBadge";
import { usePraemienWorkdayUiActive } from "../../../hooks/usePraemienWorkdayUiActive";
import type { AssignedDayFull } from "../../../modules/diensts";
import type { WorkdaySummary } from "../domain";
import {
  getEffectiveWorkdaySummary,
  type EffectiveWorkdaySummaryResponse,
} from "../domain/workdayRecoveryApi";
import { emitWorkdaySummariesChanged } from "../utils/workdayEvents";
import ReviewSummary from "./ReviewSummary";
import WorkdayCorrectionDialog from "./WorkdayCorrectionDialog";

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
  const praemienWorkdayUiActive = usePraemienWorkdayUiActive();

  const [effectiveMap, setEffectiveMap] = useState<
    Record<string, EffectiveWorkdaySummaryResponse>
  >({});
  const [openCorrectionForId, setOpenCorrectionForId] = useState<string | null>(
    null,
  );

  const sorted = useMemo(() => {
    return [...summaries].sort((a, b) => {
      const aIsPartial = !a.isFinalClosure;
      const bIsPartial = !b.isFinalClosure;
      if (aIsPartial === bIsPartial) return 0;
      return aIsPartial ? -1 : 1;
    });
  }, [summaries]);

  const finalSummaryIds = useMemo(
    () =>
      sorted
        .filter((s) => s.isFinalClosure && s._id)
        .map((s) => s._id!)
        .join(","),
    [sorted],
  );

  const fetchEffectiveForId = useCallback((id: string) => {
    getEffectiveWorkdaySummary(id)
      .then((data) =>
        setEffectiveMap((prev) => ({ ...prev, [id]: data })),
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!finalSummaryIds) return;
    let cancelled = false;
    for (const id of finalSummaryIds.split(",")) {
      if (!id) continue;
      getEffectiveWorkdaySummary(id)
        .then((data) => {
          if (!cancelled) setEffectiveMap((prev) => ({ ...prev, [id]: data }));
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [finalSummaryIds]);

  const handleCorrectionSaved = useCallback(
    (savedSummaryId: string) => {
      fetchEffectiveForId(savedSummaryId);
      emitWorkdaySummariesChanged();
    },
    [fetchEffectiveForId],
  );

  if (sorted.length === 0) return null;

  return (
    <>
      <div className={compact ? "space-y-3" : "space-y-6"}>
        {sorted.map((summary) => {
          const assignedDay = mapSummaryToAssignedDay(summary);
          const submittedAt = resolveSummarySubmittedAt(summary);
          const summaryId = summary._id;

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

          const effectiveData =
            summary.isFinalClosure && summaryId
              ? effectiveMap[summaryId]
              : undefined;
          const hasCorrectedValues =
            effectiveData?.effective?.hasCorrectedValues === true;
          const activeCorrection = effectiveData?.effective?.activeCorrection;

          return (
            <div
              key={
                summaryId ??
                `${summary.assignmentId}-${summary.isFinalClosure ? "final" : "partial"}`
              }
              className={`rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3 ${
                compact ? "p-3" : "p-4"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex items-center gap-2 flex-wrap">
                  {submittedAt ? (
                    <time
                      dateTime={submittedAt.toISOString()}
                      className="block text-[11px] text-slate-500"
                    >
                      {submittedAt.toLocaleString()}
                    </time>
                  ) : null}
                  {hasCorrectedValues ? (
                    <StatusBadge
                      label={t(
                        "pages.summaries.admin.detail.correction.badge",
                      )}
                      tone="sky"
                      className="text-[11px] font-semibold px-2.5 py-0.5"
                      data-testid="corrected-badge"
                    />
                  ) : null}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {summary.isFinalClosure && summaryId ? (
                    <button
                      type="button"
                      onClick={() => setOpenCorrectionForId(summaryId)}
                      className="rounded-lg border border-sky-300 bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-100 transition-colors"
                      data-testid="correct-workday-button"
                    >
                      {t("pages.summaries.admin.detail.correction.button")}
                    </button>
                  ) : null}
                  <StatusBadge
                    label={label}
                    tone={summary.isFinalClosure ? "emerald" : "amber"}
                    className="text-[11px] font-semibold px-2.5 py-0.5"
                  />
                </div>
              </div>

              {noteText ? (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] leading-snug text-slate-700">
                  {noteText}
                </div>
              ) : null}

              {/* Corrected values section — only for final summaries with an active correction */}
              {summary.isFinalClosure && hasCorrectedValues && activeCorrection ? (
                <div
                  className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-3 space-y-2 text-[12px]"
                  data-testid="corrected-section"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-700 mb-1">
                    {t(
                      "pages.summaries.admin.detail.correction.correctedSection.title",
                    )}
                  </div>

                  {/* Corrected values grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-700">
                    {activeCorrection.correctedFinalKm !== undefined ? (
                      <div>
                        <span className="text-slate-500 text-[11px]">
                          {t(
                            "pages.summaries.admin.detail.correction.preview.finalKm",
                          )}
                          {": "}
                        </span>
                        <span className="font-medium">
                          {activeCorrection.correctedFinalKm}
                        </span>
                      </div>
                    ) : null}
                    {activeCorrection.correctedTotalDienstKm !== undefined ? (
                      <div>
                        <span className="text-slate-500 text-[11px]">
                          {t(
                            "pages.summaries.admin.detail.correction.preview.totalDienstKm",
                          )}
                          {": "}
                        </span>
                        <span className="font-medium">
                          {activeCorrection.correctedTotalDienstKm}
                        </span>
                      </div>
                    ) : null}
                    {activeCorrection.correctedTotalEffectivePatients !==
                    undefined ? (
                      <div>
                        <span className="text-slate-500 text-[11px]">
                          {t(
                            "pages.summaries.admin.detail.correction.preview.effectivePatients",
                          )}
                          {": "}
                        </span>
                        <span className="font-medium">
                          {activeCorrection.correctedTotalEffectivePatients}
                        </span>
                      </div>
                    ) : null}
                    {activeCorrection.correctedTotalRealTrips !== undefined ? (
                      <div>
                        <span className="text-slate-500 text-[11px]">
                          {t(
                            "pages.summaries.admin.detail.correction.preview.realTrips",
                          )}
                          {": "}
                        </span>
                        <span className="font-medium">
                          {activeCorrection.correctedTotalRealTrips}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  {/* Reason */}
                  <div className="text-slate-700">
                    <span className="text-[11px] text-slate-500 font-medium">
                      {t(
                        "pages.summaries.admin.detail.correction.correctedSection.reason",
                      )}
                      {": "}
                    </span>
                    {activeCorrection.correctionReason}
                  </div>

                  {/* Note (if present) */}
                  {activeCorrection.correctionNote ? (
                    <div className="text-slate-600 italic">
                      <span className="text-[11px] text-slate-500 font-medium not-italic">
                        {t(
                          "pages.summaries.admin.detail.correction.correctedSection.note",
                        )}
                        {": "}
                      </span>
                      {activeCorrection.correctionNote}
                    </div>
                  ) : null}

                  {/* Date/time + impact */}
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                    <span>
                      {t(
                        "pages.summaries.admin.detail.correction.correctedSection.correctedAt",
                      )}
                      {": "}
                      {new Date(activeCorrection.correctedAt).toLocaleString()}
                    </span>
                    <span>
                      {t(
                        "pages.summaries.admin.detail.correction.correctedSection.praemienImpact",
                      )}
                      {": "}
                      {t(
                        `pages.summaries.admin.detail.correction.impact.${activeCorrection.praemienImpact}`,
                      )}
                    </span>
                    <span>
                      {t(
                        "pages.summaries.admin.detail.correction.correctedSection.payrollImpact",
                      )}
                      {": "}
                      {t(
                        `pages.summaries.admin.detail.correction.impact.${activeCorrection.payrollImpact}`,
                      )}
                    </span>
                  </div>
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
                  showPraemieColumn={praemienWorkdayUiActive}
                  totalEffectivePatients={
                    praemienWorkdayUiActive
                      ? summary.totalEffectivePatients
                      : null
                  }
                />
              </div>
            </div>
          );
        })}
      </div>

      {openCorrectionForId ? (
        <WorkdayCorrectionDialog
          summaryId={openCorrectionForId}
          isOpen={true}
          onClose={() => setOpenCorrectionForId(null)}
          onSaved={handleCorrectionSaved}
        />
      ) : null}
    </>
  );
}
