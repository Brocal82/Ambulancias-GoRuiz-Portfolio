/**
 * Phase 3.4.3 — Praemien Impact Resolution review modal.
 *
 * Allows an admin to transition a PENDING PraemienImpactResolution to:
 *   ignored | adjusted | blocked
 *
 * Requires a non-empty note before saving.
 * Never exposes raw ObjectIds.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  resolveImpactResolution,
  type PraemienImpactResolutionDTO,
  type ResolvableStatus,
} from "../domain/impactResolutionApi";
import { toastT } from "../../../utils/toast";

const RESOLVABLE_STATUSES: ResolvableStatus[] = ["ignored", "adjusted", "blocked"];

interface Props {
  resolution: PraemienImpactResolutionDTO;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updated: PraemienImpactResolutionDTO) => void;
}

function formatMonth(year: number, month: number): string {
  const date = new Date(year, month - 1, 1);
  return date.toLocaleString("default", { month: "long", year: "numeric" });
}

function formatDelta(delta?: number): string {
  if (delta === undefined || delta === null) return "—";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta}`;
}

export function PraemienImpactResolutionModal({
  resolution,
  isOpen,
  onClose,
  onSaved,
}: Props) {
  const { t } = useTranslation("common");
  const p = "pages.praemien.impactResolution.modal";

  const [selectedStatus, setSelectedStatus] = useState<ResolvableStatus>("ignored");
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    const trimmedNote = note.trim();
    if (!trimmedNote) {
      setNoteError(true);
      return;
    }

    setSaving(true);
    try {
      const updated = await resolveImpactResolution(resolution.id, {
        newStatus: selectedStatus,
        note: trimmedNote,
      });
      toastT.success(
        t(`pages.praemien.impactResolution.toast.${selectedStatus}`),
      );
      onSaved(updated);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        toastT.error(t(`${p}.alreadyResolved`));
        onClose();
        return;
      }
      toastT.error(t(`${p}.saveError`));
    } finally {
      setSaving(false);
    }
  };

  const workerDisplay = resolution.workerName ?? "—";
  const monthDisplay = formatMonth(resolution.year, resolution.month);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label={t(`${p}.title`)}
      data-testid="impact-resolution-modal"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl ring-1 ring-slate-200 p-6 space-y-5">
        {/* Header */}
        <h2 className="text-base font-semibold text-slate-900">
          {t(`${p}.title`)}
        </h2>

        {/* Info rows */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <dt className="text-slate-500">{t(`${p}.worker`)}</dt>
          <dd className="font-medium text-slate-900" data-testid="modal-worker-name">
            {workerDisplay}
          </dd>

          <dt className="text-slate-500">{t(`${p}.month`)}</dt>
          <dd className="text-slate-800" data-testid="modal-month">
            {monthDisplay}
          </dd>

          <dt className="text-slate-500">{t(`${p}.original`)}</dt>
          <dd className="text-slate-800" data-testid="modal-original">
            {resolution.beforeValue ?? "—"}
          </dd>

          <dt className="text-slate-500">{t(`${p}.corrected`)}</dt>
          <dd className="text-slate-800" data-testid="modal-corrected">
            {resolution.afterValue ?? "—"}
          </dd>

          <dt className="text-slate-500">{t(`${p}.delta`)}</dt>
          <dd className="text-slate-800" data-testid="modal-delta">
            {formatDelta(resolution.delta)}
          </dd>

          <dt className="text-slate-500">{t(`${p}.reason`)}</dt>
          <dd className="text-slate-800 col-span-1" data-testid="modal-reason">
            {resolution.reason}
          </dd>

          <dt className="text-slate-500">{t(`${p}.currentStatus`)}</dt>
          <dd className="text-slate-800" data-testid="modal-current-status">
            {t(`pages.praemien.impactResolution.status.${resolution.status}`)}
          </dd>

          {resolution.note && (
            <>
              <dt className="text-slate-500">{t(`${p}.existingNote`)}</dt>
              <dd className="text-slate-800" data-testid="modal-existing-note">
                {resolution.note}
              </dd>
            </>
          )}
        </dl>

        {/* Status selector */}
        <div className="space-y-1">
          <label
            htmlFor="resolution-status"
            className="block text-sm font-medium text-slate-700"
          >
            {t(`${p}.newStatus`)}
          </label>
          <select
            id="resolution-status"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as ResolvableStatus)}
            disabled={saving}
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-8 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-60"
            data-testid="resolution-status-select"
          >
            {RESOLVABLE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`${p}.statusOptions.${s}`)}
              </option>
            ))}
          </select>
        </div>

        {/* Note field */}
        <div className="space-y-1">
          <label
            htmlFor="resolution-note"
            className="block text-sm font-medium text-slate-700"
          >
            {t(`${p}.note`)}
            <span className="ml-1 text-red-500">*</span>
          </label>
          <textarea
            id="resolution-note"
            rows={3}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              if (noteError && e.target.value.trim()) setNoteError(false);
            }}
            disabled={saving}
            placeholder={t(`${p}.notePlaceholder`)}
            className={`mt-1 block w-full rounded-lg border text-sm shadow-sm focus:outline-none focus:ring-1 px-3 py-2 resize-none disabled:opacity-60 ${
              noteError
                ? "border-red-400 focus:border-red-500 focus:ring-red-500"
                : "border-slate-300 focus:border-sky-500 focus:ring-sky-500"
            }`}
            data-testid="resolution-note-input"
          />
          {noteError && (
            <p className="text-xs text-red-600" data-testid="note-error">
              {t(`${p}.noteRequired`)}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            data-testid="modal-cancel-button"
          >
            {t(`${p}.cancel`)}
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60"
            data-testid="modal-save-button"
          >
            {saving ? t(`${p}.saving`) : t(`${p}.save`)}
          </button>
        </div>
      </div>
    </div>
  );
}
