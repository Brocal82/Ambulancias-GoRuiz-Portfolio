import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";

import StatusBadge from "../../../components/common/StatusBadge";
import { usePraemienWorkdayUiActive } from "../../../hooks/usePraemienWorkdayUiActive";
import type { AssignedDayFull } from "../../../modules/diensts";
import type { WorkdaySummary } from "../domain";
import {
  getEffectiveWorkdaySummary,
  type EffectiveWorkdaySummaryResponse,
} from "../domain/workdayRecoveryApi";
import {
  getEffectiveTripsForWorkdaySummary,
  type EffectiveTripsListResponse,
  type EffectiveTripDTO,
} from "../domain/tripRecoveryApi";
import { useWorkdaySummariesChanged } from "../hooks/useWorkdaySummariesChanged";
import { emitWorkdaySummariesChanged } from "../utils/workdayEvents";
import EffectiveTripsTable, {
  formatTripLabel,
  type TripRecoveryRowAction,
} from "./EffectiveTripsTable";
import ReviewSummary from "./ReviewSummary";
import TripRecoveryDialog, {
  type TripRecoveryDialogMode,
  type TripRecoveryContext,
} from "./TripRecoveryDialog";
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

function formatWorkerName(
  p: AssignedDayFull["driver"],
  fallback: string,
): string {
  if (!p) return fallback;
  if (typeof p === "string") return p;
  const last = p?.lastName ?? "";
  const first = p?.name ?? "";
  const full = [last, first].filter(Boolean).join(", ");
  return full || fallback;
}

type OpenTripRecovery = {
  summaryId: string;
  mode: TripRecoveryDialogMode;
  originalTripId?: string;
  initialValues?: EffectiveTripDTO["values"];
  tripLabel?: string;
};

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
  const [effectiveTripsMap, setEffectiveTripsMap] = useState<
    Record<string, EffectiveTripsListResponse>
  >({});
  const [effectiveTripsLoading, setEffectiveTripsLoading] = useState<
    Record<string, boolean>
  >({});
  const [openCorrectionForId, setOpenCorrectionForId] = useState<string | null>(
    null,
  );
  const [openTripRecovery, setOpenTripRecovery] =
    useState<OpenTripRecovery | null>(null);
  const [externalStaleSignal, setExternalStaleSignal] = useState(0);

  const openTripRecoveryRef = useRef(openTripRecovery);
  openTripRecoveryRef.current = openTripRecovery;

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

  const fetchEffectiveTripsForId = useCallback((id: string) => {
    setEffectiveTripsLoading((prev) => ({ ...prev, [id]: true }));
    getEffectiveTripsForWorkdaySummary(id)
      .then((data) =>
        setEffectiveTripsMap((prev) => ({ ...prev, [id]: data })),
      )
      .catch(() => {})
      .finally(() =>
        setEffectiveTripsLoading((prev) => ({ ...prev, [id]: false })),
      );
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
      setEffectiveTripsLoading((prev) => ({ ...prev, [id]: true }));
      getEffectiveTripsForWorkdaySummary(id)
        .then((data) => {
          if (!cancelled)
            setEffectiveTripsMap((prev) => ({ ...prev, [id]: data }));
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled)
            setEffectiveTripsLoading((prev) => ({ ...prev, [id]: false }));
        });
    }
    return () => {
      cancelled = true;
    };
  }, [finalSummaryIds]);

  const refreshFinalSummaryData = useCallback(
    (summaryId: string) => {
      fetchEffectiveForId(summaryId);
      fetchEffectiveTripsForId(summaryId);
    },
    [fetchEffectiveForId, fetchEffectiveTripsForId],
  );

  const handleWorkdaySummariesChanged = useCallback(() => {
    if (!finalSummaryIds) return;
    for (const id of finalSummaryIds.split(",")) {
      if (!id) continue;
      refreshFinalSummaryData(id);
    }
    if (openTripRecoveryRef.current) {
      setExternalStaleSignal((n) => n + 1);
    }
  }, [finalSummaryIds, refreshFinalSummaryData]);

  useWorkdaySummariesChanged(handleWorkdaySummariesChanged);

  const handleCorrectionSaved = useCallback(
    (savedSummaryId: string) => {
      refreshFinalSummaryData(savedSummaryId);
      emitWorkdaySummariesChanged();
    },
    [refreshFinalSummaryData],
  );

  const handleTripRecoverySaved = useCallback(
    (savedSummaryId: string) => {
      refreshFinalSummaryData(savedSummaryId);
      emitWorkdaySummariesChanged();
    },
    [refreshFinalSummaryData],
  );

  const buildRecoveryContext = useCallback(
    (
      summary: WorkdaySummary,
      assignedDay: AssignedDayFull,
      ambulanceNumber: string,
    ): TripRecoveryContext => ({
      workdayDate: summary.date,
      dienstNumber: assignedDay.dienstNumber,
      ambulanceNumber,
      driverName: formatWorkerName(
        assignedDay.driver,
        t("pages.workday.reviewSummary.labels.deletedUser"),
      ),
      medicName: formatWorkerName(
        assignedDay.medic,
        t("pages.workday.reviewSummary.labels.deletedUser"),
      ),
    }),
    [t],
  );

  if (sorted.length === 0) return null;

  const openRecoverySummary = openTripRecovery
    ? sorted.find((s) => s._id === openTripRecovery.summaryId)
    : undefined;
  const openRecoveryAssignedDay = openRecoverySummary
    ? mapSummaryToAssignedDay(openRecoverySummary)
    : undefined;
  const openRecoveryAmbulance =
    openRecoverySummary?.ambulanceNumber ??
    t("pages.workday.common.unknownAmbulance", "Ambulancia desconocida");

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

          const effectiveData =
            summary.isFinalClosure && summaryId
              ? effectiveMap[summaryId]
              : undefined;

          const displayInitialKm = summary.initialKm;
          const displayFinalKm =
            effectiveData?.effective?.finalKm ??
            summary.finalKm ??
            summary.initialKm;
          const displayTotalEffectivePatients =
            effectiveData?.effective?.totalEffectivePatients ??
            summary.totalEffectivePatients;

          const hasCorrectedValues =
            effectiveData?.effective?.hasCorrectedValues === true;
          const activeCorrection = effectiveData?.effective?.activeCorrection;

          const effectiveTrips =
            summary.isFinalClosure && summaryId
              ? effectiveTripsMap[summaryId]?.trips ?? []
              : [];
          const tripsLoading =
            summary.isFinalClosure && summaryId
              ? effectiveTripsLoading[summaryId] === true
              : false;

          function openRowRecovery(
            action: TripRecoveryRowAction,
            trip: EffectiveTripDTO,
            index: number,
          ) {
            if (!summaryId) return;
            setOpenTripRecovery({
              summaryId,
              mode: action,
              originalTripId: trip.tripKey,
              initialValues: trip.values,
              tripLabel: formatTripLabel(trip, index),
            });
          }

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

                  <div className="text-slate-700">
                    <span className="text-[11px] text-slate-500 font-medium">
                      {t(
                        "pages.summaries.admin.detail.correction.correctedSection.reason",
                      )}
                      {": "}
                    </span>
                    {activeCorrection.correctionReason}
                  </div>

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
                  initialKm={displayInitialKm}
                  finalKm={displayFinalKm ?? displayInitialKm}
                  trips={
                    summary.isFinalClosure
                      ? []
                      : [...summary.trips].sort((a, b) =>
                          a.timeWarning.localeCompare(b.timeWarning),
                        )
                  }
                  dense
                  showPraemieColumn={praemienWorkdayUiActive}
                  totalEffectivePatients={
                    praemienWorkdayUiActive
                      ? displayTotalEffectivePatients
                      : null
                  }
                  hideTripTable={summary.isFinalClosure}
                  tripTableReplacement={
                    summary.isFinalClosure && summaryId ? (
                      <EffectiveTripsTable
                        trips={effectiveTrips}
                        loading={tripsLoading}
                        dense
                        showRecoveryControls
                        onRowAction={(action, trip) => {
                          const index = effectiveTrips.findIndex(
                            (t) => t.tripKey === trip.tripKey,
                          );
                          openRowRecovery(action, trip, index >= 0 ? index : 0);
                        }}
                        onAddForgotten={() => {
                          if (!summaryId) return;
                          setOpenTripRecovery({
                            summaryId,
                            mode: "forgotten",
                          });
                        }}
                      />
                    ) : undefined
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

      {openTripRecovery && openRecoverySummary && openRecoveryAssignedDay ? (
        <TripRecoveryDialog
          isOpen={true}
          mode={openTripRecovery.mode}
          workdaySummaryId={openTripRecovery.summaryId}
          originalTripId={openTripRecovery.originalTripId}
          initialValues={openTripRecovery.initialValues}
          context={{
            ...buildRecoveryContext(
              openRecoverySummary,
              openRecoveryAssignedDay,
              openRecoveryAmbulance,
            ),
            tripLabel: openTripRecovery.tripLabel,
          }}
          externalStaleSignal={externalStaleSignal}
          onClose={() => setOpenTripRecovery(null)}
          onSaved={handleTripRecoverySaved}
        />
      ) : null}
    </>
  );
}
