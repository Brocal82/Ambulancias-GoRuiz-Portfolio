/**
 * Phase 4.4 — Trip Recovery Dialog (correct / void / add forgotten).
 * Preview via POST /trip-corrections/preview; save via POST /trip-corrections.
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatYYYYMMDDToDDMMYYYY } from "../../../utils/timeUtils";
import { toastT } from "../../../utils/toast";
import type { ImpactLevel } from "../domain/workdayRecoveryApi";
import {
  previewTripCorrection,
  createTripCorrection,
  type TripCorrectionPreviewResponse,
  type TripOperationalValuesDTO,
  type TripCorrectionType,
} from "../domain/tripRecoveryApi";

export type TripRecoveryDialogMode = "correct" | "void" | "forgotten";

export interface TripRecoveryContext {
  workdayDate: string;
  dienstNumber?: number;
  ambulanceNumber: string;
  driverName: string;
  medicName: string;
  tripLabel?: string;
}

interface FormState {
  countsTrip: string;
  wasCancelled: boolean;
  cancelledAtPickup: boolean;
  kmStart: string;
  kmEnd: string;
  timeWarning: string;
  timeAtHome: string;
  timePickup: string;
  timeArrival: string;
  timeEnd: string;
  reason: string;
  note: string;
  praemienImpact: ImpactLevel;
}

const IMPACT_VALUES: ImpactLevel[] = ["none", "possible"];

function valuesToForm(values?: TripOperationalValuesDTO): FormState {
  return {
    countsTrip: values?.countsTrip != null ? String(values.countsTrip) : "1",
    wasCancelled: values?.wasCancelled ?? false,
    cancelledAtPickup: values?.cancelledAtPickup ?? false,
    kmStart: values?.kmStart != null ? String(values.kmStart) : "",
    kmEnd: values?.kmEnd != null ? String(values.kmEnd) : "",
    timeWarning: values?.timeWarning ?? "",
    timeAtHome: values?.timeAtHome ?? "",
    timePickup: values?.timePickup ?? "",
    timeArrival: values?.timeArrival ?? "",
    timeEnd: values?.timeEnd ?? "",
    reason: "",
    note: "",
    praemienImpact: "none",
  };
}

function parseOptionalNumber(v: string): number | undefined {
  const trimmed = v.trim();
  if (trimmed === "") return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function parseCountsTrip(v: string): 0 | 1 | undefined {
  const trimmed = v.trim();
  if (trimmed === "0") return 0;
  if (trimmed === "1") return 1;
  return undefined;
}

function buildEffectiveFields(form: FormState): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  const countsTrip = parseCountsTrip(form.countsTrip);
  if (countsTrip !== undefined) fields.effectiveCountsTrip = countsTrip;
  fields.effectiveWasCancelled = form.wasCancelled;
  fields.effectiveCancelledAtPickup = form.cancelledAtPickup;

  const kmStart = parseOptionalNumber(form.kmStart);
  const kmEnd = parseOptionalNumber(form.kmEnd);
  if (kmStart !== undefined) fields.effectiveKmStart = kmStart;
  if (kmEnd !== undefined) fields.effectiveKmEnd = kmEnd;

  const trimOrUndef = (s: string) => {
    const t = s.trim();
    return t === "" ? undefined : t;
  };

  const timeWarning = trimOrUndef(form.timeWarning);
  const timeAtHome = trimOrUndef(form.timeAtHome);
  const timePickup = trimOrUndef(form.timePickup);
  const timeArrival = trimOrUndef(form.timeArrival);
  const timeEnd = trimOrUndef(form.timeEnd);

  if (timeWarning !== undefined) fields.effectiveTimeWarning = timeWarning;
  if (timeAtHome !== undefined) fields.effectiveTimeAtHome = timeAtHome;
  if (timePickup !== undefined) fields.effectiveTimePickup = timePickup;
  if (timeArrival !== undefined) fields.effectiveTimeArrival = timeArrival;
  if (timeEnd !== undefined) fields.effectiveTimeEnd = timeEnd;

  return fields;
}

function modeToCorrectionType(mode: TripRecoveryDialogMode): TripCorrectionType {
  if (mode === "void") return "void";
  if (mode === "forgotten") return "add_forgotten";
  return "correct";
}

function diffLabel(
  before: number | undefined,
  after: number | undefined,
): string {
  if (before === undefined || after === undefined) return "—";
  const diff = after - before;
  if (diff === 0) return "0";
  return diff > 0 ? `+${diff}` : `${diff}`;
}

const labelBase =
  "text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-0.5 block";
const inputBase =
  "w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400 disabled:bg-slate-100 disabled:text-slate-500";
const selectBase =
  "w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400 bg-white";

interface Props {
  isOpen: boolean;
  mode: TripRecoveryDialogMode;
  workdaySummaryId: string;
  originalTripId?: string;
  context: TripRecoveryContext;
  initialValues?: TripOperationalValuesDTO;
  onClose: () => void;
  onSaved: (workdaySummaryId: string) => void;
  /** Incremented when external realtime refresh occurs while dialog is open. */
  externalStaleSignal?: number;
}

export default function TripRecoveryDialog({
  isOpen,
  mode,
  workdaySummaryId,
  originalTripId,
  context,
  initialValues,
  onClose,
  onSaved,
  externalStaleSignal = 0,
}: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState<FormState>(() => valuesToForm(initialValues));
  const [preview, setPreview] = useState<TripCorrectionPreviewResponse | null>(
    null,
  );
  const [previewStale, setPreviewStale] = useState(false);
  const [externalStale, setExternalStale] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reasonError, setReasonError] = useState<string | null>(null);

  const fieldsReadOnly = mode === "void";
  const titleKey =
    mode === "correct"
      ? "pages.summaries.admin.detail.tripRecovery.dialog.titleCorrect"
      : mode === "void"
        ? "pages.summaries.admin.detail.tripRecovery.dialog.titleVoid"
        : "pages.summaries.admin.detail.tripRecovery.dialog.titleForgotten";

  useEffect(() => {
    if (!isOpen) return;
    setForm(valuesToForm(initialValues));
    setPreview(null);
    setPreviewStale(false);
    setExternalStale(false);
    setReasonError(null);
  }, [isOpen, mode, originalTripId, initialValues]);

  useEffect(() => {
    if (!isOpen || externalStaleSignal === 0) return;
    setExternalStale(true);
    setPreviewStale(true);
    setPreview(null);
  }, [externalStaleSignal, isOpen]);

  if (!isOpen) return null;

  function invalidatePreview() {
    if (preview) {
      setPreviewStale(true);
    }
  }

  function setField<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
    invalidatePreview();
    if (externalStale) setExternalStale(false);
  }

  function buildPayload() {
    const correctionType = modeToCorrectionType(mode);
    const base = {
      correctionType,
      reason: form.reason.trim(),
      note: form.note.trim() || undefined,
      praemienImpact: form.praemienImpact,
      ...(mode === "forgotten"
        ? { workdaySummaryId }
        : { originalTripId, workdaySummaryId }),
      ...(mode === "void" ? {} : buildEffectiveFields(form)),
    };
    return base;
  }

  async function handlePreview() {
    if (!form.reason.trim()) {
      setReasonError(
        t("pages.summaries.admin.detail.tripRecovery.dialog.reasonRequired"),
      );
      return;
    }
    setReasonError(null);
    setPreviewing(true);
    try {
      const result = await previewTripCorrection(buildPayload());
      setPreview(result);
      setPreviewStale(false);
      setExternalStale(false);
    } catch {
      toastT.apiError(
        t("pages.summaries.admin.detail.tripRecovery.dialog.previewError"),
      );
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSave() {
    if (!form.reason.trim()) {
      setReasonError(
        t("pages.summaries.admin.detail.tripRecovery.dialog.reasonRequired"),
      );
      return;
    }
    if (!preview || previewStale || externalStale) return;

    setSaving(true);
    try {
      await createTripCorrection(buildPayload());
      toastT.success(
        t("toasts.workday.tripCorrectionSaved"),
      );
      onSaved(workdaySummaryId);
      onClose();
    } catch {
      toastT.apiError(
        t("toasts.workday.tripCorrectionError"),
      );
    } finally {
      setSaving(false);
    }
  }

  const canSave =
    !!preview && !previewStale && !externalStale && !previewing && !saving;

  const workdayPreview = preview?.workday;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      data-testid="trip-recovery-dialog"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{t(titleKey)}</h2>
            <p className="text-[12px] text-slate-500 mt-0.5">
              {t("pages.summaries.admin.detail.tripRecovery.dialog.subtitle")}
            </p>
          </div>
          <button
            type="button"
            data-testid="trip-recovery-dialog-close"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            {t("pages.summaries.admin.detail.tripRecovery.dialog.cancel")}
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          {externalStale ? (
            <div
              className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-900"
              data-testid="trip-recovery-external-stale"
            >
              {t(
                "pages.summaries.admin.detail.tripRecovery.dialog.externalStale",
              )}
            </div>
          ) : null}

          {/* Read-only context */}
          <div
            className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-[12px]"
            data-testid="trip-recovery-context"
          >
            <div>
              <span className="text-slate-500">
                {t("pages.summaries.admin.detail.tripRecovery.dialog.context.date")}
                {": "}
              </span>
              {formatYYYYMMDDToDDMMYYYY(context.workdayDate)}
            </div>
            {context.dienstNumber != null ? (
              <div>
                <span className="text-slate-500">
                  {t("pages.summaries.admin.detail.tripRecovery.dialog.context.dienst")}
                  {": "}
                </span>
                {context.dienstNumber}
              </div>
            ) : null}
            <div>
              <span className="text-slate-500">
                {t("pages.summaries.admin.detail.tripRecovery.dialog.context.ambulance")}
                {": "}
              </span>
              {context.ambulanceNumber}
            </div>
            <div>
              <span className="text-slate-500">
                {t("pages.summaries.admin.detail.tripRecovery.dialog.context.workers")}
                {": "}
              </span>
              {context.driverName}, {context.medicName}
            </div>
            {context.tripLabel && mode !== "forgotten" ? (
              <div className="col-span-2">
                <span className="text-slate-500">
                  {t("pages.summaries.admin.detail.tripRecovery.dialog.context.trip")}
                  {": "}
                </span>
                {context.tripLabel}
              </div>
            ) : null}
          </div>

          {/* Editable operational fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelBase} htmlFor="tr-countsTrip">
                {t("pages.summaries.admin.detail.tripRecovery.fields.countsTrip")}
              </label>
              <select
                id="tr-countsTrip"
                data-testid="field-countsTrip"
                className={selectBase}
                value={form.countsTrip}
                disabled={fieldsReadOnly}
                onChange={(e) => setField("countsTrip", e.target.value)}
              >
                <option value="1">1</option>
                <option value="0">0</option>
              </select>
            </div>
            <div className="flex flex-col justify-end gap-2 pb-1">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  data-testid="field-wasCancelled"
                  checked={form.wasCancelled}
                  disabled={fieldsReadOnly}
                  onChange={(e) => setField("wasCancelled", e.target.checked)}
                />
                {t("pages.summaries.admin.detail.tripRecovery.fields.wasCancelled")}
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  data-testid="field-cancelledAtPickup"
                  checked={form.cancelledAtPickup}
                  disabled={fieldsReadOnly}
                  onChange={(e) =>
                    setField("cancelledAtPickup", e.target.checked)
                  }
                />
                {t(
                  "pages.summaries.admin.detail.tripRecovery.fields.cancelledAtPickup",
                )}
              </label>
            </div>
            {(
              [
                ["kmStart", "fields.kmStart"],
                ["kmEnd", "fields.kmEnd"],
                ["timeWarning", "fields.timeWarning"],
                ["timeAtHome", "fields.timeAtHome"],
                ["timePickup", "fields.timePickup"],
                ["timeArrival", "fields.timeArrival"],
                ["timeEnd", "fields.timeEnd"],
              ] as const
            ).map(([key, labelKey]) => (
              <div key={key}>
                <label className={labelBase} htmlFor={`tr-${key}`}>
                  {t(`pages.summaries.admin.detail.tripRecovery.${labelKey}`)}
                </label>
                <input
                  id={`tr-${key}`}
                  data-testid={`field-${key}`}
                  className={inputBase}
                  value={form[key]}
                  disabled={fieldsReadOnly}
                  onChange={(e) => setField(key, e.target.value)}
                />
              </div>
            ))}
          </div>

          {/* Reason / note / impact */}
          <div className="space-y-3 border-t border-slate-200 pt-3">
            <div>
              <label className={labelBase} htmlFor="tr-reason">
                {t("pages.summaries.admin.detail.tripRecovery.fields.reason")}
              </label>
              <input
                id="tr-reason"
                data-testid="field-reason"
                className={inputBase}
                value={form.reason}
                onChange={(e) => setField("reason", e.target.value)}
              />
              {reasonError ? (
                <p className="text-[11px] text-rose-600 mt-1">{reasonError}</p>
              ) : null}
            </div>
            <div>
              <label className={labelBase} htmlFor="tr-note">
                {t("pages.summaries.admin.detail.tripRecovery.fields.note")}
              </label>
              <input
                id="tr-note"
                data-testid="field-note"
                className={inputBase}
                value={form.note}
                onChange={(e) => setField("note", e.target.value)}
              />
            </div>
            <div>
              <label className={labelBase} htmlFor="tr-praemienImpact">
                {t("pages.summaries.admin.detail.tripRecovery.fields.praemienImpact")}
              </label>
              <select
                id="tr-praemienImpact"
                data-testid="field-praemienImpact"
                className={selectBase}
                value={form.praemienImpact}
                onChange={(e) =>
                  setField("praemienImpact", e.target.value as ImpactLevel)
                }
              >
                {IMPACT_VALUES.map((v) => (
                  <option key={v} value={v}>
                    {t(
                      `pages.summaries.admin.detail.correction.impact.${v}`,
                    )}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Preview section */}
          <div className="border-t border-slate-200 pt-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[12px] font-semibold uppercase tracking-wide text-slate-600">
                {t("pages.summaries.admin.detail.tripRecovery.preview.title")}
              </h3>
              <button
                type="button"
                data-testid="trip-recovery-preview"
                disabled={previewing}
                onClick={() => void handlePreview()}
                className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-[12px] font-medium text-sky-700 hover:bg-sky-100 disabled:opacity-50"
              >
                {previewing
                  ? t("common.loading")
                  : t("pages.summaries.admin.detail.tripRecovery.preview.button")}
              </button>
            </div>

            {previewStale && !externalStale ? (
              <p
                className="text-[12px] text-amber-700"
                data-testid="trip-recovery-preview-stale"
              >
                {t(
                  "pages.summaries.admin.detail.tripRecovery.preview.outOfDate",
                )}
              </p>
            ) : null}

            {preview ? (
              <div
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 space-y-3 text-[12px]"
                data-testid="trip-recovery-preview-panel"
              >
                <div>
                  <div className="font-semibold text-slate-700 mb-1">
                    {t(
                      "pages.summaries.admin.detail.tripRecovery.preview.tripTitle",
                    )}
                  </div>
                  <div className="text-slate-600">
                    {t(
                      `pages.summaries.admin.detail.tripRecovery.badges.${preview.trip.type}`,
                    )}
                    {" · "}
                    {t(
                      "pages.summaries.admin.detail.tripRecovery.preview.countsTrip",
                      { count: preview.trip.values.countsTrip },
                    )}
                    {preview.trip.values.kmEnd != null
                      ? ` · km ${preview.trip.values.kmStart ?? "?"} → ${preview.trip.values.kmEnd}`
                      : null}
                  </div>
                </div>

                {workdayPreview ? (
                  <div>
                    <div className="font-semibold text-slate-700 mb-1">
                      {t(
                        "pages.summaries.admin.detail.tripRecovery.preview.workdayTitle",
                      )}
                    </div>
                    {workdayPreview.projectionStatus === "skipped" ? (
                      <p className="text-slate-500 italic">
                        {t(
                          "pages.summaries.admin.detail.tripRecovery.preview.skipped",
                          { reason: workdayPreview.skipReason ?? "—" },
                        )}
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-700">
                        <div>
                          {t("pages.summaries.admin.detail.correction.preview.finalKm")}
                          {": "}
                          {workdayPreview.before.finalKm ?? "—"} →{" "}
                          {workdayPreview.after.finalKm ?? "—"} (
                          {diffLabel(
                            workdayPreview.before.finalKm,
                            workdayPreview.after.finalKm,
                          )}
                          )
                        </div>
                        <div>
                          {t(
                            "pages.summaries.admin.detail.correction.preview.totalDienstKm",
                          )}
                          {": "}
                          {workdayPreview.before.totalDienstKm} →{" "}
                          {workdayPreview.after.totalDienstKm} (
                          {diffLabel(
                            workdayPreview.before.totalDienstKm,
                            workdayPreview.after.totalDienstKm,
                          )}
                          )
                        </div>
                        <div>
                          {t(
                            "pages.summaries.admin.detail.correction.preview.effectivePatients",
                          )}
                          {": "}
                          {workdayPreview.before.totalEffectivePatients} →{" "}
                          {workdayPreview.after.totalEffectivePatients} (
                          {diffLabel(
                            workdayPreview.before.totalEffectivePatients,
                            workdayPreview.after.totalEffectivePatients,
                          )}
                          )
                        </div>
                        <div>
                          {t(
                            "pages.summaries.admin.detail.correction.preview.realTrips",
                          )}
                          {": "}
                          {workdayPreview.before.totalRealTrips} →{" "}
                          {workdayPreview.after.totalRealTrips} (
                          {diffLabel(
                            workdayPreview.before.totalRealTrips,
                            workdayPreview.after.totalRealTrips,
                          )}
                          )
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            {t("pages.summaries.admin.detail.tripRecovery.dialog.cancel")}
          </button>
          <button
            type="button"
            data-testid="trip-recovery-save"
            disabled={!canSave}
            onClick={() => void handleSave()}
            className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving
              ? t("common.saving")
              : t("pages.summaries.admin.detail.tripRecovery.dialog.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
