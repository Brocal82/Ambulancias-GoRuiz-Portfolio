/**
 * Phase 3.4.3 — Praemien Impact Resolution panel.
 *
 * Compact admin panel showing PENDING PraemienImpactResolution items for
 * closed monthly snapshots (where MonthlyPraemie exists).
 *
 * - Hidden completely when no pending items exist.
 * - Refreshes on praemien_changed / admin_counts_changed WS events via
 *   the existing PRAEMIEN_MANUAL_PENDING_CHANGED window event bridge.
 * - "View corrected Workday" navigates to /admin/summaries.
 * - "Review" opens PraemienImpactResolutionModal.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  listImpactResolutions,
  type PraemienImpactResolutionDTO,
} from "../domain/impactResolutionApi";
import { PRAEMIEN_MANUAL_PENDING_CHANGED } from "../utils/praemienManualPendingEvents";
import { PraemienImpactResolutionModal } from "./PraemienImpactResolutionModal";

function formatMonth(year: number, month: number): string {
  const date = new Date(year, month - 1, 1);
  return date.toLocaleString("default", { month: "short", year: "numeric" });
}

function formatDelta(delta?: number): string {
  if (delta === undefined || delta === null) return "—";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta}`;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "pending":
      return "bg-amber-100 text-amber-800";
    case "ignored":
      return "bg-slate-100 text-slate-600";
    case "adjusted":
      return "bg-sky-100 text-sky-800";
    case "blocked":
      return "bg-red-100 text-red-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

export function PraemienImpactResolutionPanel() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const p = "pages.praemien.impactResolution";

  const [items, setItems] = useState<PraemienImpactResolutionDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reviewItem, setReviewItem] = useState<PraemienImpactResolutionDTO | null>(null);
  const initialLoadDone = useRef(false);

  const load = useCallback(async () => {
    const blocking = !initialLoadDone.current;
    if (blocking) setLoading(true);
    setLoadError(false);
    try {
      const data = await listImpactResolutions({ status: "pending" });
      setItems(data);
    } catch {
      setLoadError(true);
    } finally {
      initialLoadDone.current = true;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Refresh when praemien_changed or admin_counts_changed WS events arrive
  useEffect(() => {
    const onChanged = () => void load();
    window.addEventListener(PRAEMIEN_MANUAL_PENDING_CHANGED, onChanged);
    return () => window.removeEventListener(PRAEMIEN_MANUAL_PENDING_CHANGED, onChanged);
  }, [load]);

  const handleSaved = useCallback(
    (updated: PraemienImpactResolutionDTO) => {
      // Remove the resolved item from the pending list immediately
      setItems((prev) => prev.filter((r) => r.id !== updated.id));
      setReviewItem(null);
    },
    [],
  );

  // Hide completely when there are no pending items and loading is done
  if (!loading && !loadError && items.length === 0) {
    return null;
  }

  return (
    <section
      aria-label={t(`${p}.panelTitle`)}
      data-testid="impact-resolution-panel"
      className="mx-auto min-w-0 w-full max-w-7xl px-4 sm:px-6 lg:px-8"
    >
      <div className="rounded-2xl bg-white shadow-md ring-1 ring-slate-200 overflow-hidden">
        {/* Panel header */}
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">
            {t(`${p}.panelTitle`)}
          </h2>
        </div>

        {/* Loading */}
        {loading && items.length === 0 && (
          <p
            className="px-5 py-4 text-sm text-slate-500"
            data-testid="impact-resolution-loading"
          >
            {t(`${p}.loading`)}
          </p>
        )}

        {/* Load error */}
        {loadError && (
          <p
            className="px-5 py-4 text-sm text-red-600"
            data-testid="impact-resolution-load-error"
          >
            {t(`${p}.loadError`)}
          </p>
        )}

        {/* Table */}
        {items.length > 0 && (
          <div
            className="w-full overflow-x-auto"
            role="region"
            aria-label={t(`${p}.panelTitle`)}
          >
            <table
              className="w-full text-xs"
              data-testid="impact-resolution-table"
            >
              <thead>
                <tr className="bg-slate-50 text-left text-slate-500 font-medium">
                  <th className="px-4 py-2">{t(`${p}.th.worker`)}</th>
                  <th className="px-4 py-2">{t(`${p}.th.month`)}</th>
                  <th className="px-4 py-2 text-right">{t(`${p}.th.original`)}</th>
                  <th className="px-4 py-2 text-right">{t(`${p}.th.corrected`)}</th>
                  <th className="px-4 py-2 text-right">{t(`${p}.th.delta`)}</th>
                  <th className="px-4 py-2">{t(`${p}.th.reason`)}</th>
                  <th className="px-4 py-2">{t(`${p}.th.status`)}</th>
                  <th className="px-4 py-2">{t(`${p}.th.actions`)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50"
                    data-testid="impact-resolution-row"
                  >
                    <td
                      className="px-4 py-3 font-medium text-slate-800"
                      data-testid="row-worker-name"
                    >
                      {item.workerName ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatMonth(item.year, item.month)}
                    </td>
                    <td
                      className="px-4 py-3 text-right text-slate-700"
                      data-testid="row-before-value"
                    >
                      {item.beforeValue ?? "—"}
                    </td>
                    <td
                      className="px-4 py-3 text-right text-slate-700"
                      data-testid="row-after-value"
                    >
                      {item.afterValue ?? "—"}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        (item.delta ?? 0) > 0
                          ? "text-emerald-700"
                          : (item.delta ?? 0) < 0
                          ? "text-red-600"
                          : "text-slate-500"
                      }`}
                      data-testid="row-delta"
                    >
                      {formatDelta(item.delta)}
                    </td>
                    <td
                      className="px-4 py-3 text-slate-600 max-w-[160px] truncate"
                      title={item.reason}
                      data-testid="row-reason"
                    >
                      {item.reason}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(item.status)}`}
                        data-testid="row-status-badge"
                      >
                        {t(`${p}.status.${item.status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setReviewItem(item)}
                          className="rounded-md bg-sky-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-sky-700"
                          data-testid="review-button"
                        >
                          {t(`${p}.reviewButton`)}
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate("/admin/summaries")}
                          className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          data-testid="view-workday-button"
                        >
                          {t(`${p}.viewWorkday`)}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {reviewItem && (
        <PraemienImpactResolutionModal
          resolution={reviewItem}
          isOpen={Boolean(reviewItem)}
          onClose={() => setReviewItem(null)}
          onSaved={handleSaved}
        />
      )}
    </section>
  );
}
