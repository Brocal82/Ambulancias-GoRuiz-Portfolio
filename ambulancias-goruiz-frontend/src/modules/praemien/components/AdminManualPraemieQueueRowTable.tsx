import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import EditIconButton from "../../../components/common/actions/EditIconButton";
import { fmtDDMM } from "../../../utils/timeUtils";
import type { AdminManualPraemieQueueRowData } from "../domain/manualDailyApi";
import {
  fmtPraemieEmployeeNoDisplay,
  PRAEMIE_QUEUE_bodyRow,
  PRAEMIE_QUEUE_btnApproveVacationStyle,
  PRAEMIE_QUEUE_btnRejectVacationStyle,
  PRAEMIE_QUEUE_headerRow,
  PRAEMIE_QUEUE_TABLE_SHELL_CLASS,
} from "./praemieManualQueueTableStyles";

export function AdminManualPraemieQueueColumnHeaders() {
  const { t } = useTranslation();
  return (
    <div className={PRAEMIE_QUEUE_headerRow} role="row">
      <div role="columnheader" className="min-w-0 break-words text-center">
        {t("pages.adminUsers.praemieListColEquipo")}
      </div>
      <div role="columnheader" className="min-w-0 break-words text-center">
        {t("pages.adminUsers.praemieListColEmployeeNumber")}
      </div>
      <div role="columnheader" className="min-w-0 whitespace-nowrap text-center">
        {t("pages.adminUsers.praemieListColDate")}
      </div>
      <div role="columnheader" className="min-w-0 break-words text-center">
        {t("pages.adminUsers.praemieListColDienst")}
      </div>
      <div role="columnheader" className="min-w-0 break-words text-center">
        {t("pages.adminUsers.praemieListColSchedule")}
      </div>
      <div role="columnheader" className="min-w-0 break-words text-center">
        {t("pages.adminUsers.praemieListColManualValue")}
      </div>
      <div role="columnheader" className="min-w-0 break-words text-center">
        {t("pages.adminUsers.praemieListColFinalValue")}
      </div>
      <div role="columnheader" className="min-w-0 w-full break-words text-center">
        {t("pages.adminUsers.praemieListColActions")}
      </div>
    </div>
  );
}

export interface AdminManualPraemieQueueRowBodyProps {
  row: AdminManualPraemieQueueRowData;
  rectifyInput: string;
  onRectifyChange: (value: string) => void;
  rejectReason: string;
  onRejectReasonChange: (value: string) => void;
  showRejectPanel: boolean;
  onToggleReject: () => void;
  onCancelReject: () => void;
  onConfirmReject: () => void;
  onApprove: () => void;
  busy: boolean;
  onReopen: () => void;
}

export function AdminManualPraemieQueueRowBody({
  row,
  rectifyInput,
  onRectifyChange,
  rejectReason,
  onRejectReasonChange,
  showRejectPanel,
  onToggleReject,
  onCancelReject,
  onConfirmReject,
  onApprove,
  busy,
  onReopen,
}: AdminManualPraemieQueueRowBodyProps) {
  const { t } = useTranslation();

  const horario =
    row.startTime && row.endTime
      ? `${row.startTime} – ${row.endTime}`
      : row.startTime || row.endTime
        ? [row.startTime, row.endTime].filter(Boolean).join(" – ")
        : "—";

  const driverLabel = row.equipoDriverUserId
    ? `${row.equipoDriverLastName}, ${row.equipoDriverName}`.trim()
    : "";
  const medicLabel = row.equipoMedicUserId
    ? `${row.equipoMedicLastName}, ${row.equipoMedicName}`.trim()
    : "";
  const equipoNamesDisplay =
    driverLabel && medicLabel
      ? `${driverLabel} / ${medicLabel}`
      : driverLabel || medicLabel || "—";

  const actionable =
    row.manualStatus === "submitted" || row.manualStatus === "reopened";
  const approved = row.manualStatus === "approved";
  const draft = row.manualStatus === "draft";
  const rejected = row.manualStatus === "rejected";

  const finalDisplay =
    approved && row.adminFinalValue != null ? String(row.adminFinalValue) : null;

  return (
    <div role="row" className={PRAEMIE_QUEUE_bodyRow}>
      <div role="cell" className="min-w-0 text-center text-slate-900">
        <div className="line-clamp-2 break-words font-medium leading-tight">
          {equipoNamesDisplay}
        </div>
        {row.equipoBothSlotsPending ? (
          <span className="mt-0.5 block text-[9px] font-medium text-amber-900/90">
            {t("pages.adminUsers.praemieListTeamBothPending")}
          </span>
        ) : null}
        {row.manualStatus === "reopened" && (
          <span className="mt-0.5 inline-block rounded bg-amber-100 px-1 py-0 text-[9px] font-medium text-amber-900">
            {t("pages.adminUsers.praemieListReopenedTag")}
          </span>
        )}
        {rejected && row.rejectionReason ? (
          <p className="mt-1 text-left text-xs leading-snug text-rose-700 whitespace-pre-wrap">
            {row.rejectionReason}
          </p>
        ) : null}
      </div>
      <div role="cell" className="min-w-0 text-center tabular-nums text-slate-800">
        <span className="whitespace-nowrap">
          {fmtPraemieEmployeeNoDisplay(row.equipoDriverEmployeeNumber)}
          <span className="mx-0.5 text-slate-400">/</span>
          {row.equipoMedicUserId
            ? fmtPraemieEmployeeNoDisplay(row.equipoMedicEmployeeNumber)
            : "—"}
        </span>
      </div>
      <div role="cell" className="min-w-0 whitespace-nowrap text-center text-slate-800">
        {fmtDDMM(row.date)}
      </div>
      <div role="cell" className="min-w-0 text-center tabular-nums text-slate-800">
        {row.dienstNumber != null ? row.dienstNumber : "—"}
      </div>
      <div role="cell" className="min-w-0 break-words text-center leading-tight text-slate-800">
        {horario}
      </div>
      <div role="cell" className="min-w-0 text-center tabular-nums text-slate-800">
        {row.workerSubmittedValue}
      </div>
      <div role="cell" className="min-w-0 text-center">
        {actionable ? (
          <input
            type="number"
            min={0}
            max={10_000}
            step="any"
            className="mx-auto box-border block h-7 w-[4.25rem] max-w-full rounded border border-slate-300 bg-white px-1 text-center text-xs tabular-nums"
            value={rectifyInput}
            onChange={(e) => onRectifyChange(e.target.value)}
            disabled={busy}
            placeholder={String(row.workerSubmittedValue)}
            title={t("pages.adminUsers.praemieListRectifyHint")}
            aria-label={t("pages.adminUsers.praemieListColFinalValue")}
          />
        ) : approved ? (
          <span className="tabular-nums text-slate-800">
            {finalDisplay ?? "—"}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </div>
      <div role="cell" className="min-w-0 w-full justify-self-stretch">
        <div className="flex min-w-0 w-full flex-col items-stretch justify-center gap-1">
          <div className="flex min-h-[2.75rem] w-full min-w-0 items-center justify-center">
            {actionable && showRejectPanel ? (
              <textarea
                value={rejectReason}
                onChange={(e) => onRejectReasonChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    onCancelReject();
                    return;
                  }
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    onConfirmReject();
                  }
                }}
                disabled={busy}
                placeholder={t("pages.adminUsers.praemieListRejectTextareaPlaceholder")}
                maxLength={2000}
                autoFocus
                rows={2}
                title={t("pages.adminUsers.praemieListRejectTextareaTitle")}
                aria-label={t("pages.praemien.adminManual.rejectReasonLabel")}
                className="box-border h-[2.75rem] w-full min-w-0 resize-none overflow-y-auto rounded-md border border-rose-300 bg-white px-2 py-1 text-xs leading-snug text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-rose-200 disabled:opacity-50"
              />
            ) : actionable ? (
              <div className="flex w-full min-w-0 flex-wrap items-center justify-center gap-1.5">
                <button
                  type="button"
                  onClick={onApprove}
                  disabled={busy}
                  className={`shrink-0 ${PRAEMIE_QUEUE_btnApproveVacationStyle}`}
                  title={
                    row.equipoBothSlotsPending
                      ? `${t("pages.praemien.adminManual.approve")} — ${t("pages.adminUsers.praemieListApproveAlsoTeammate")}`
                      : t("pages.praemien.adminManual.approve")
                  }
                  aria-label={t("pages.praemien.adminManual.approve")}
                >
                  ✅
                </button>
                <button
                  type="button"
                  onClick={onToggleReject}
                  disabled={busy}
                  className={`shrink-0 ${PRAEMIE_QUEUE_btnRejectVacationStyle}`}
                  title={t("pages.praemien.adminManual.reject")}
                  aria-label={t("pages.praemien.adminManual.reject")}
                >
                  ❌
                </button>
              </div>
            ) : approved ? (
              <div className="flex w-full min-w-0 items-center justify-center">
                <EditIconButton
                  disabled={busy}
                  onClick={onReopen}
                  title={t("pages.praemien.adminManual.reopen")}
                  aria-label={t("pages.praemien.adminManual.reopen")}
                  className="shrink-0 disabled:opacity-50"
                />
              </div>
            ) : draft ? (
              <p className="px-1 text-center text-xs text-slate-600">
                {t("pages.praemien.adminManual.draftHint")}
              </p>
            ) : rejected ? (
              <p className="px-1 text-center text-xs text-slate-500">
                {t("pages.praemien.adminManual.rejectedQueueHint")}
              </p>
            ) : (
              <span className="text-slate-400">—</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Contenedor con misma tarjeta que la cola (tabla compacta). */
export function AdminManualPraemieQueueTableShell({
  children,
  ariaLabel,
}: {
  children: ReactNode;
  ariaLabel: string;
}) {
  return (
    <div
      className={PRAEMIE_QUEUE_TABLE_SHELL_CLASS}
      role="table"
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}
