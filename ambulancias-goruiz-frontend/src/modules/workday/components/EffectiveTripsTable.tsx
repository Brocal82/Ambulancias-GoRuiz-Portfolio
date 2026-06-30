/**
 * Phase 4.4 — Effective trips table for admin Trip Recovery.
 * Displays one row per effective trip with status badges and row actions.
 */
import { useTranslation } from "react-i18next";
import StatusBadge from "../../../components/common/StatusBadge";
import { APP_NAV_MATCH_TABLE_THEAD } from "../../../components/ui/appTableHeader";
import type { EffectiveTripDTO } from "../domain/tripRecoveryApi";

const MONGO_ID_RE = /^[a-f0-9]{24}$/i;

export function isPersistedTripKey(tripKey: string): boolean {
  return MONGO_ID_RE.test(tripKey);
}

function calcKmDiff(values: EffectiveTripDTO["values"]): number | null {
  if (values.kmStart == null || values.kmEnd == null) return null;
  return Math.max(0, values.kmEnd - values.kmStart);
}

function formatTripLabel(trip: EffectiveTripDTO, index: number): string {
  const time = trip.values.timeWarning?.trim();
  if (time) return time;
  return `#${index + 1}`;
}

export type TripRecoveryRowAction = "correct" | "void";

type Props = {
  trips: EffectiveTripDTO[];
  loading?: boolean;
  dense?: boolean;
  onRowAction?: (action: TripRecoveryRowAction, trip: EffectiveTripDTO) => void;
  onAddForgotten?: () => void;
  showRecoveryControls?: boolean;
};

const BADGE_TONE: Record<
  EffectiveTripDTO["type"],
  "slate" | "sky" | "rose" | "amber"
> = {
  original: "slate",
  corrected: "sky",
  voided: "rose",
  forgotten: "amber",
};

export default function EffectiveTripsTable({
  trips,
  loading = false,
  dense = true,
  onRowAction,
  onAddForgotten,
  showRecoveryControls = true,
}: Props) {
  const { t } = useTranslation();

  const tableText = dense ? "text-[11px]" : "text-xs";
  const headCell = dense ? "px-1 py-1" : "px-2 py-2";
  const cell = dense ? "px-1 py-1" : "px-2 py-2";
  const zebraLight = dense ? "bg-slate-50/70" : "bg-slate-50/50";
  const zebraAlt = dense ? "bg-white" : "bg-white";
  const tableScroll = dense
    ? "w-full overflow-x-auto overflow-y-auto max-h-64"
    : "w-full overflow-x-auto";

  const changedCellClass = "bg-sky-50/80 ring-1 ring-inset ring-sky-100";

  function cellClassFor(
    trip: EffectiveTripDTO,
    field: string,
    base: string,
  ): string {
    const changed = trip.changedFields?.includes(field);
    return changed ? `${base} ${changedCellClass}` : base;
  }

  function canActOnRow(trip: EffectiveTripDTO): boolean {
    if (!showRecoveryControls || !onRowAction) return false;
    if (!isPersistedTripKey(trip.tripKey)) return false;
    return trip.type === "original" || trip.type === "corrected";
  }

  return (
    <div data-testid="effective-trips-table">
      <div className={tableScroll}>
        <table className={`w-full table-auto ${tableText}`}>
          <thead
            className={`${APP_NAV_MATCH_TABLE_THEAD} uppercase tracking-wide text-slate-200`}
          >
            <tr>
              <th className={`${headCell} text-center`}>
                {t("pages.summaries.admin.detail.tripRecovery.table.status")}
              </th>
              <th className={`${headCell} text-center`}>
                {t("pages.summaries.admin.detail.tripRecovery.table.trip")}
              </th>
              <th className={`${headCell} text-center`}>
                {t("pages.summaries.admin.detail.tripRecovery.table.countsTrip")}
              </th>
              <th className={`${headCell} text-center`}>
                {t("pages.workday.reviewSummary.table.warning")}
              </th>
              <th className={`${headCell} text-center`}>
                {t("pages.workday.reviewSummary.table.homeArrival")}
              </th>
              <th className={`${headCell} text-center`}>
                {t("pages.workday.reviewSummary.table.kmStart")}
              </th>
              <th className={`${headCell} text-center`}>
                {t("pages.workday.reviewSummary.table.pickupTime")}
              </th>
              <th className={`${headCell} text-center`}>
                {t("pages.workday.reviewSummary.table.arrivalTime")}
              </th>
              <th className={`${headCell} text-center`}>
                {t("pages.workday.reviewSummary.table.kmEnd")}
              </th>
              <th className={`${headCell} text-center`}>
                {t("pages.workday.reviewSummary.table.timeEnd")}
              </th>
              <th className={`${headCell} text-center`}>
                {t("pages.workday.reviewSummary.table.kmDiff")}
              </th>
              {showRecoveryControls ? (
                <th className={`${headCell} text-center`}>
                  {t("pages.summaries.admin.detail.tripRecovery.table.actions")}
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={showRecoveryControls ? 12 : 11}
                  className={`${cell} text-center text-slate-500 py-4`}
                >
                  {t("common.loading")}
                </td>
              </tr>
            ) : trips.length === 0 ? (
              <tr>
                <td
                  colSpan={showRecoveryControls ? 12 : 11}
                  className={`${cell} text-center text-slate-500 py-4`}
                >
                  {t("pages.summaries.admin.detail.tripRecovery.table.empty")}
                </td>
              </tr>
            ) : (
              trips.map((trip, i) => {
                const diff = calcKmDiff(trip.values);
                const isVoided = trip.type === "voided";
                const rowMuted = isVoided ? "opacity-70" : "";
                const showActions = canActOnRow(trip);

                return (
                  <tr
                    key={trip.tripKey}
                    data-testid={`effective-trip-row-${i}`}
                    data-trip-type={trip.type}
                    className={`border-t border-slate-200 ${i % 2 === 1 ? zebraLight : zebraAlt} ${rowMuted}`}
                  >
                    <td className={`${cell} text-center`} data-testid={trip.type !== "original" ? `trip-badge-${trip.type}` : undefined}>
                      {trip.type === "original" ? null : (
                        <StatusBadge
                          label={t(
                            `pages.summaries.admin.detail.tripRecovery.badges.${trip.type}`,
                          )}
                          tone={BADGE_TONE[trip.type]}
                          className="text-[10px] font-semibold px-2 py-0.5"
                        />
                      )}
                    </td>
                    <td
                      className={`${cell} text-center font-medium text-slate-800`}
                    >
                      {formatTripLabel(trip, i)}
                    </td>
                    <td
                      className={cellClassFor(
                        trip,
                        "countsTrip",
                        `${cell} text-center text-slate-700`,
                      )}
                    >
                      {trip.values.countsTrip}
                    </td>
                    <td
                      className={cellClassFor(
                        trip,
                        "timeWarning",
                        `${cell} text-center text-slate-700`,
                      )}
                    >
                      {trip.values.timeWarning ?? "—"}
                    </td>
                    <td
                      className={cellClassFor(
                        trip,
                        "timeAtHome",
                        `${cell} text-center text-slate-700`,
                      )}
                    >
                      {trip.values.timeAtHome ?? "—"}
                    </td>
                    <td
                      className={cellClassFor(
                        trip,
                        "kmStart",
                        `${cell} text-center text-slate-700`,
                      )}
                    >
                      {trip.values.kmStart ?? "—"}
                    </td>
                    <td
                      className={cellClassFor(
                        trip,
                        "timePickup",
                        `${cell} text-center text-slate-700`,
                      )}
                    >
                      {trip.values.timePickup ?? "—"}
                    </td>
                    <td
                      className={cellClassFor(
                        trip,
                        "timeArrival",
                        `${cell} text-center text-slate-700`,
                      )}
                    >
                      {trip.values.timeArrival ?? "—"}
                    </td>
                    <td
                      className={cellClassFor(
                        trip,
                        "kmEnd",
                        `${cell} text-center text-slate-700`,
                      )}
                    >
                      {trip.values.kmEnd ?? "—"}
                    </td>
                    <td
                      className={cellClassFor(
                        trip,
                        "timeEnd",
                        `${cell} text-center text-slate-700`,
                      )}
                    >
                      {trip.values.timeEnd ?? "—"}
                    </td>
                    <td className={`${cell} text-center font-medium text-slate-800`}>
                      {diff ?? "—"}
                    </td>
                    {showRecoveryControls ? (
                      <td className={`${cell} text-center`}>
                        {showActions ? (
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            <button
                              type="button"
                              data-testid={`trip-correct-${i}`}
                              onClick={() => onRowAction?.("correct", trip)}
                              className="rounded border border-sky-300 bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 hover:bg-sky-100"
                            >
                              {t(
                                "pages.summaries.admin.detail.tripRecovery.actions.correct",
                              )}
                            </button>
                            <button
                              type="button"
                              data-testid={`trip-void-${i}`}
                              onClick={() => onRowAction?.("void", trip)}
                              className="rounded border border-rose-300 bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 hover:bg-rose-100"
                            >
                              {t(
                                "pages.summaries.admin.detail.tripRecovery.actions.void",
                              )}
                            </button>
                          </div>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showRecoveryControls && onAddForgotten ? (
        <div className="border-t border-slate-200 bg-slate-50/50 px-2 py-2 flex justify-end">
          <button
            type="button"
            data-testid="add-forgotten-trip-button"
            onClick={onAddForgotten}
            className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800 hover:bg-amber-100 transition-colors"
          >
            {t("pages.summaries.admin.detail.tripRecovery.actions.addForgotten")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export { formatTripLabel };
