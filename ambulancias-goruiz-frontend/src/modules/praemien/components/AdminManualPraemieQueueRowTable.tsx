import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import EditIconButton from "../../../components/common/actions/EditIconButton";
import { fmtDDMM } from "../../../utils/timeUtils";
import type { AdminManualPraemieQueueRowData } from "../domain/manualDailyApi";
import { AdminManualPraemieDayWorkdayReports } from "./AdminManualPraemieDayWorkdayReports";
import {
  fmtPraemieEmployeeNoDisplay,
  PRAEMIE_MANUAL_DAY_DETAIL_SHELL_CLASS,
  PRAEMIE_QUEUE_bodyRow,
  PRAEMIE_QUEUE_btnApproveVacationStyle,
  PRAEMIE_QUEUE_headerRow,
} from "./praemieManualQueueTableStyles";

export function AdminManualPraemieQueueColumnHeaders() {
  const { t } = useTranslation();
  return (
    <div className={PRAEMIE_QUEUE_headerRow}>
      <div className="min-w-0 whitespace-nowrap text-center">
        {t("pages.adminUsers.praemieListColDate")}
      </div>
      <div className="min-w-0 break-words text-center">
        {t("pages.adminUsers.praemieListColDienst")}
      </div>
      <div className="min-w-0 break-words text-center">
        {t("pages.adminUsers.praemieListColSchedule")}
      </div>
      <div className="min-w-0 break-words text-center">
        {t("pages.adminUsers.praemieListColEquipo")}
      </div>
      <div className="min-w-0 break-words text-center">
        {t("pages.adminUsers.praemieListColEmployeeNumber")}
      </div>
      <div className="min-w-0 break-words text-center">
        {t("pages.adminUsers.praemieListColManualValue")}
      </div>
      <div className="min-w-0 break-words text-center">
        {t("pages.adminUsers.praemieListColFinalValue")}
      </div>
      <div className="min-w-0 w-full break-words text-center">
        {t("pages.adminUsers.praemieListColActions")}
      </div>
    </div>
  );
}

export interface AdminManualPraemieQueueRowBodyProps {
  row: AdminManualPraemieQueueRowData;
  rectifyInput: string;
  onRectifyChange: (value: string) => void;
  onApprove: () => void;
  busy: boolean;
  onReopen: () => void;
  /** Resaltar input cuando falta valor final explícito al aprobar. */
  finalValueError?: boolean;
  /** Cola pendiente: clic en la fila despliega reportes de jornada. */
  expandable?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

export function AdminManualPraemieQueueRowBody({
  row,
  rectifyInput,
  onRectifyChange,
  onApprove,
  busy,
  onReopen,
  finalValueError = false,
  expandable = false,
  expanded = false,
  onToggleExpand,
}: AdminManualPraemieQueueRowBodyProps) {
  const { t } = useTranslation();

  const stopRowToggle = (event: MouseEvent | KeyboardEvent) => {
    event.stopPropagation();
  };

  const handleRowClick = () => {
    if (expandable && onToggleExpand) {
      onToggleExpand();
    }
  };

  const handleRowKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!expandable || !onToggleExpand) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggleExpand();
    }
  };

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

  const finalInputPlaceholder =
    row.workdayReportsTotalPraemie != null
      ? String(row.workdayReportsTotalPraemie)
      : String(row.workerSubmittedValue);

  const finalInputPlaceholderClass =
    row.workdayReportsTotalPraemie != null
      ? "placeholder:text-rose-400/80"
      : "placeholder:text-slate-400";

  return (
    <>
    <div
      className={`${PRAEMIE_QUEUE_bodyRow} ${
        expandable ? "cursor-pointer select-none" : ""
      } ${expanded ? "bg-orange-50/90 ring-1 ring-inset ring-orange-300 hover:bg-orange-50" : ""}`}
      role={expandable ? "button" : undefined}
      tabIndex={expandable ? 0 : undefined}
      aria-expanded={expandable ? expanded : undefined}
      aria-label={expandable ? t("pages.praemien.adminManual.toggleWorkdayReportsAria") : undefined}
      onClick={expandable ? handleRowClick : undefined}
      onKeyDown={expandable ? handleRowKeyDown : undefined}
    >
      <div className="relative w-full min-w-0 justify-self-stretch text-slate-800">
        {expandable ? (
          <span
            className="absolute left-0 top-1/2 -translate-y-1/2 text-[11px] leading-none text-orange-700"
            aria-hidden
          >
            {expanded ? "▾" : "▸"}
          </span>
        ) : null}
        <span className="block whitespace-nowrap text-center">
          {fmtDDMM(row.date)}
        </span>
      </div>
      <div className="min-w-0 text-center tabular-nums text-slate-800">
        {row.dienstNumber != null ? row.dienstNumber : "—"}
      </div>
      <div className="min-w-0 break-words text-center leading-tight text-slate-800">
        {horario}
      </div>
      <div className="min-w-0 text-center text-slate-900">
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
      <div className="min-w-0 text-center tabular-nums text-slate-800">
        <span className="whitespace-nowrap">
          {fmtPraemieEmployeeNoDisplay(row.equipoDriverEmployeeNumber)}
          <span className="mx-0.5 text-slate-400">/</span>
          {row.equipoMedicUserId
            ? fmtPraemieEmployeeNoDisplay(row.equipoMedicEmployeeNumber)
            : "—"}
        </span>
      </div>
      <div className="min-w-0 text-center tabular-nums text-slate-800">
        {row.workerSubmittedValue}
      </div>
      <div
        className="min-w-0 text-center"
        onClick={expandable ? stopRowToggle : undefined}
        onKeyDown={expandable ? stopRowToggle : undefined}
      >
        {actionable ? (
          <div className="mx-auto flex w-[4.25rem] max-w-full flex-col items-center gap-0.5">
            <input
              type="number"
              min={0}
              max={10_000}
              step="any"
              className={`box-border block h-7 w-full rounded bg-white px-1 text-center text-xs tabular-nums ${
                finalValueError
                  ? "border border-rose-500"
                  : "border border-slate-300"
              } ${finalInputPlaceholderClass}`}
              value={rectifyInput}
              onChange={(e) => onRectifyChange(e.target.value)}
              disabled={busy}
              placeholder={finalInputPlaceholder}
              aria-invalid={finalValueError || undefined}
              aria-describedby={
                finalValueError ? "manual-praemie-final-value-hint" : undefined
              }
              title={
                row.workdayReportsTotalPraemie != null
                  ? t("pages.praemien.adminManual.workdayReportsTotalPraemieHint")
                  : t("pages.adminUsers.praemieListRectifyHint")
              }
              aria-label={t("pages.adminUsers.praemieListColFinalValue")}
            />
            {finalValueError ? (
              <p
                id="manual-praemie-final-value-hint"
                className="w-full text-center text-[9px] leading-tight text-rose-600"
              >
                {t("pages.praemien.adminManual.finalValueRequiredInline")}
              </p>
            ) : null}
          </div>
        ) : approved ? (
          <span className="tabular-nums text-slate-800">
            {finalDisplay ?? "—"}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </div>
      <div
        className="min-w-0 w-full justify-self-stretch"
        onClick={expandable ? stopRowToggle : undefined}
        onKeyDown={expandable ? stopRowToggle : undefined}
      >
        <div className="flex min-w-0 w-full flex-col items-stretch justify-center gap-1">
          <div className="flex min-h-[2.75rem] w-full min-w-0 items-center justify-center">
            {actionable ? (
              <div className="flex w-full min-w-0 flex-wrap items-center justify-center gap-1.5">
                <button
                  type="button"
                  onClick={onApprove}
                  disabled={busy}
                  className={`shrink-0 ${PRAEMIE_QUEUE_btnApproveVacationStyle}`}
                  title={
                    row.equipoBothSlotsPending
                      ? `${t("pages.praemien.adminManual.approve")} — ${t("pages.adminUsers.praemieListApproveAlsoTeammate")}`
                      : t("pages.adminUsers.praemieListRectifyHint")
                  }
                  aria-label={t("pages.praemien.adminManual.approve")}
                >
                  ✅
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
    {expandable && expanded ? (
      <div className="border-b border-slate-200 bg-slate-50/80 px-3 py-3 sm:px-4">
        <AdminManualPraemieDayWorkdayReports userId={row.userId} date={row.date} />
      </div>
    ) : null}
    </>
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
      className={PRAEMIE_MANUAL_DAY_DETAIL_SHELL_CLASS}
      role="region"
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}
