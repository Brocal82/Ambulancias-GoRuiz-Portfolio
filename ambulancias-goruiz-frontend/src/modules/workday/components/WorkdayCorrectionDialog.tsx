/**
 * Phase 3.3 — Workday Correction Dialog.
 * Opens over AdminWorkdaySummaryGroupContent for final summaries only.
 * Fetches effective values on open, shows preview, and POSTs correction.
 */
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  getEffectiveWorkdaySummary,
  createWorkdayCorrection,
  type EffectiveWorkdaySummaryResponse,
  type ImpactLevel,
} from "../domain/workdayRecoveryApi";
import { toastT } from "../../../utils/toast";

const IMPACT_VALUES: ImpactLevel[] = ["none", "possible"];

interface FormState {
  correctedFinalKm: string;
  correctedTotalDienstKm: string;
  correctedTotalEffectivePatients: string;
  correctedTotalRealTrips: string;
  correctionReason: string;
  correctionNote: string;
  praemienImpact: ImpactLevel;
  payrollImpact: ImpactLevel;
}

const EMPTY_FORM: FormState = {
  correctedFinalKm: "",
  correctedTotalDienstKm: "",
  correctedTotalEffectivePatients: "",
  correctedTotalRealTrips: "",
  correctionReason: "",
  correctionNote: "",
  praemienImpact: "none",
  payrollImpact: "none",
};

interface Props {
  summaryId: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (summaryId: string) => void;
}

function parseOptionalNumber(v: string): number | undefined {
  const trimmed = v.trim();
  if (trimmed === "") return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function diffLabel(
  original: number | undefined | null,
  corrected: number | undefined,
): string {
  if (corrected === undefined || original === undefined || original === null)
    return "—";
  const diff = corrected - original;
  if (diff === 0) return "0";
  return diff > 0 ? `+${diff}` : `${diff}`;
}

const labelBase =
  "text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-0.5 block";
const inputBase =
  "w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400";
const selectBase =
  "w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400 bg-white";

export default function WorkdayCorrectionDialog({
  summaryId,
  isOpen,
  onClose,
  onSaved,
}: Props) {
  const { t } = useTranslation();
  const [effective, setEffective] =
    useState<EffectiveWorkdaySummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !summaryId) return;
    setLoading(true);
    setReasonError(null);
    setFieldError(null);
    setForm(EMPTY_FORM);
    getEffectiveWorkdaySummary(summaryId)
      .then((data) => {
        setEffective(data);
        const eff = data.effective;
        setForm({
          correctedFinalKm: eff.finalKm != null ? String(eff.finalKm) : "",
          correctedTotalDienstKm: String(eff.totalDienstKm),
          correctedTotalEffectivePatients: String(eff.totalEffectivePatients),
          correctedTotalRealTrips: String(eff.totalRealTrips),
          correctionReason: "",
          correctionNote: "",
          praemienImpact: "none",
          payrollImpact: "none",
        });
      })
      .catch(() => {
        toastT.error(
          t("toasts.workday.correctionLoadError"),
        );
        onClose();
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, summaryId]);

  if (!isOpen) return null;

  const eff = effective?.effective;
  const orig = eff?.original;

  const cFinalKm = parseOptionalNumber(form.correctedFinalKm);
  const cDienstKm = parseOptionalNumber(form.correctedTotalDienstKm);
  const cPatients = parseOptionalNumber(form.correctedTotalEffectivePatients);
  const cTrips = parseOptionalNumber(form.correctedTotalRealTrips);

  function setField<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  function handleSave() {
    let valid = true;
    if (!form.correctionReason.trim()) {
      setReasonError(
        t("pages.summaries.admin.detail.correction.reasonRequired"),
      );
      valid = false;
    } else {
      setReasonError(null);
    }
    if (
      cFinalKm === undefined &&
      cDienstKm === undefined &&
      cPatients === undefined &&
      cTrips === undefined
    ) {
      setFieldError(
        t("pages.summaries.admin.detail.correction.atLeastOneField"),
      );
      valid = false;
    } else {
      setFieldError(null);
    }
    if (!valid) return;

    setSaving(true);
    createWorkdayCorrection(summaryId, {
      correctedFinalKm: cFinalKm,
      correctedTotalDienstKm: cDienstKm,
      correctedTotalEffectivePatients: cPatients,
      correctedTotalRealTrips: cTrips,
      correctionReason: form.correctionReason.trim(),
      correctionNote: form.correctionNote.trim() || undefined,
      praemienImpact: form.praemienImpact,
      payrollImpact: form.payrollImpact,
    })
      .then(() => {
        toastT.success(t("toasts.workday.correctionSaved"));
        onSaved(summaryId);
        onClose();
      })
      .catch((err: unknown) => {
        toastT.apiError(err, t("toasts.workday.correctionError"));
      })
      .finally(() => setSaving(false));
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      data-testid="correction-dialog"
    >
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 px-6 pt-5 pb-3 border-b border-slate-100">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3
                className="text-base font-semibold text-slate-900"
                data-testid="correction-dialog-title"
              >
                {t("pages.summaries.admin.detail.correction.dialogTitle")}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {t("pages.summaries.admin.detail.correction.dialogSubtitle")}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-slate-400 hover:text-slate-600"
              aria-label="Close"
              data-testid="correction-dialog-close"
            >
              ✕
            </button>
          </div>
        </div>

        {loading ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500">
            {t("common.loading")}
          </div>
        ) : (
          <div className="px-6 py-5 space-y-5">
            {/* Numeric fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelBase}>
                  {t(
                    "pages.summaries.admin.detail.correction.fields.correctedFinalKm",
                  )}
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  className={inputBase}
                  value={form.correctedFinalKm}
                  onChange={(e) => setField("correctedFinalKm", e.target.value)}
                  data-testid="field-correctedFinalKm"
                />
              </div>
              <div>
                <label className={labelBase}>
                  {t(
                    "pages.summaries.admin.detail.correction.fields.correctedTotalDienstKm",
                  )}
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  className={inputBase}
                  value={form.correctedTotalDienstKm}
                  onChange={(e) =>
                    setField("correctedTotalDienstKm", e.target.value)
                  }
                  data-testid="field-correctedTotalDienstKm"
                />
              </div>
              <div>
                <label className={labelBase}>
                  {t(
                    "pages.summaries.admin.detail.correction.fields.correctedTotalEffectivePatients",
                  )}
                </label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  className={inputBase}
                  value={form.correctedTotalEffectivePatients}
                  onChange={(e) =>
                    setField("correctedTotalEffectivePatients", e.target.value)
                  }
                  data-testid="field-correctedTotalEffectivePatients"
                />
              </div>
              <div>
                <label className={labelBase}>
                  {t(
                    "pages.summaries.admin.detail.correction.fields.correctedTotalRealTrips",
                  )}
                </label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  className={inputBase}
                  value={form.correctedTotalRealTrips}
                  onChange={(e) =>
                    setField("correctedTotalRealTrips", e.target.value)
                  }
                  data-testid="field-correctedTotalRealTrips"
                />
              </div>
            </div>

            {fieldError ? (
              <p
                className="text-xs text-rose-600"
                data-testid="field-error-at-least-one"
              >
                {fieldError}
              </p>
            ) : null}

            {/* Preview */}
            {eff && orig ? (
              <div
                className="rounded-lg border border-slate-200 overflow-hidden"
                data-testid="correction-preview"
              >
                <div className="px-3 py-2 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {t("pages.summaries.admin.detail.correction.preview.title")}
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="px-3 py-1.5 text-left font-medium text-slate-600">
                        {" "}
                      </th>
                      <th className="px-3 py-1.5 text-right font-medium text-slate-600">
                        {t(
                          "pages.summaries.admin.detail.correction.preview.original",
                        )}
                      </th>
                      <th className="px-3 py-1.5 text-right font-medium text-slate-600">
                        {t(
                          "pages.summaries.admin.detail.correction.preview.corrected",
                        )}
                      </th>
                      <th className="px-3 py-1.5 text-right font-medium text-slate-600">
                        {t(
                          "pages.summaries.admin.detail.correction.preview.difference",
                        )}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    <tr>
                      <td className="px-3 py-1.5 text-slate-600">
                        {t(
                          "pages.summaries.admin.detail.correction.preview.finalKm",
                        )}
                      </td>
                      <td
                        className="px-3 py-1.5 text-right text-slate-700"
                        data-testid="preview-orig-finalKm"
                      >
                        {orig.finalKm ?? "—"}
                      </td>
                      <td
                        className="px-3 py-1.5 text-right text-sky-700 font-medium"
                        data-testid="preview-corr-finalKm"
                      >
                        {cFinalKm ?? "—"}
                      </td>
                      <td
                        className="px-3 py-1.5 text-right text-slate-500"
                        data-testid="preview-diff-finalKm"
                      >
                        {diffLabel(orig.finalKm, cFinalKm)}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 text-slate-600">
                        {t(
                          "pages.summaries.admin.detail.correction.preview.totalDienstKm",
                        )}
                      </td>
                      <td
                        className="px-3 py-1.5 text-right text-slate-700"
                        data-testid="preview-orig-dienstKm"
                      >
                        {orig.totalDienstKm}
                      </td>
                      <td
                        className="px-3 py-1.5 text-right text-sky-700 font-medium"
                        data-testid="preview-corr-dienstKm"
                      >
                        {cDienstKm ?? "—"}
                      </td>
                      <td
                        className="px-3 py-1.5 text-right text-slate-500"
                        data-testid="preview-diff-dienstKm"
                      >
                        {diffLabel(orig.totalDienstKm, cDienstKm)}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 text-slate-600">
                        {t(
                          "pages.summaries.admin.detail.correction.preview.effectivePatients",
                        )}
                      </td>
                      <td
                        className="px-3 py-1.5 text-right text-slate-700"
                        data-testid="preview-orig-patients"
                      >
                        {orig.totalEffectivePatients}
                      </td>
                      <td
                        className="px-3 py-1.5 text-right text-sky-700 font-medium"
                        data-testid="preview-corr-patients"
                      >
                        {cPatients ?? "—"}
                      </td>
                      <td
                        className="px-3 py-1.5 text-right text-slate-500"
                        data-testid="preview-diff-patients"
                      >
                        {diffLabel(orig.totalEffectivePatients, cPatients)}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 text-slate-600">
                        {t(
                          "pages.summaries.admin.detail.correction.preview.realTrips",
                        )}
                      </td>
                      <td
                        className="px-3 py-1.5 text-right text-slate-700"
                        data-testid="preview-orig-trips"
                      >
                        {orig.totalRealTrips}
                      </td>
                      <td
                        className="px-3 py-1.5 text-right text-sky-700 font-medium"
                        data-testid="preview-corr-trips"
                      >
                        {cTrips ?? "—"}
                      </td>
                      <td
                        className="px-3 py-1.5 text-right text-slate-500"
                        data-testid="preview-diff-trips"
                      >
                        {diffLabel(orig.totalRealTrips, cTrips)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : null}

            {/* Reason */}
            <div>
              <label className={labelBase}>
                {t(
                  "pages.summaries.admin.detail.correction.fields.correctionReason",
                )}{" "}
                *
              </label>
              <textarea
                rows={2}
                className={`${inputBase} resize-none`}
                value={form.correctionReason}
                onChange={(e) => setField("correctionReason", e.target.value)}
                data-testid="field-correctionReason"
              />
              {reasonError ? (
                <p
                  className="text-xs text-rose-600 mt-0.5"
                  data-testid="reason-error"
                >
                  {reasonError}
                </p>
              ) : null}
            </div>

            {/* Note */}
            <div>
              <label className={labelBase}>
                {t(
                  "pages.summaries.admin.detail.correction.fields.correctionNote",
                )}
              </label>
              <textarea
                rows={2}
                className={`${inputBase} resize-none`}
                value={form.correctionNote}
                onChange={(e) => setField("correctionNote", e.target.value)}
                data-testid="field-correctionNote"
              />
            </div>

            {/* Impact fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelBase}>
                  {t(
                    "pages.summaries.admin.detail.correction.fields.praemienImpact",
                  )}
                </label>
                <select
                  className={selectBase}
                  value={form.praemienImpact}
                  onChange={(e) =>
                    setField("praemienImpact", e.target.value as ImpactLevel)
                  }
                  data-testid="field-praemienImpact"
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
              <div>
                <label className={labelBase}>
                  {t(
                    "pages.summaries.admin.detail.correction.fields.payrollImpact",
                  )}
                </label>
                <select
                  className={selectBase}
                  value={form.payrollImpact}
                  onChange={(e) =>
                    setField("payrollImpact", e.target.value as ImpactLevel)
                  }
                  data-testid="field-payrollImpact"
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

            {/* Footer */}
            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
                data-testid="correction-cancel"
              >
                {t("pages.summaries.admin.detail.correction.cancel")}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || loading}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50"
                data-testid="correction-save"
              >
                {saving
                  ? t("common.saving")
                  : t("pages.summaries.admin.detail.correction.save")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
