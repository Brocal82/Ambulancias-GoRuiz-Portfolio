interface PayrollCompletionSnapshotProps {
  totalPayrollDocs: number;
  assignedPayrollDocs: number;
  unassignedPayrollDocs: number;
  coveredWorkers: number;
  totalWorkers: number;
  /** Workers without a matched/manual payroll for the month (same basis as WorkersMissingPayroll). */
  workersMissingPayroll: number;
  /** When set and there is at least one payroll doc, the header toggles the monthly list. */
  onClick?: () => void;
  /** Reflects expanded state for a11y + chevron when interactive. */
  monthlyListExpanded?: boolean;
  /** Unified reconciliation toggle/action. */
  onToggleReconciliation?: () => void;
  /** Reflects reconciliation open state in snapshot UI. */
  reconciliationOpen?: boolean;
}

export default function PayrollCompletionSnapshot({
  totalPayrollDocs,
  assignedPayrollDocs,
  unassignedPayrollDocs,
  coveredWorkers,
  totalWorkers,
  workersMissingPayroll,
  onClick,
  monthlyListExpanded = false,
  onToggleReconciliation,
  reconciliationOpen = false,
}: PayrollCompletionSnapshotProps) {
  const isComplete =
    unassignedPayrollDocs === 0 && coveredWorkers === totalWorkers;

  const interactive = Boolean(onClick) && totalPayrollDocs > 0;
  const hasReconciliationPending =
    unassignedPayrollDocs > 0 || workersMissingPayroll > 0;
  const reconciliationInteractive =
    Boolean(onToggleReconciliation) && hasReconciliationPending;

  const staticTileClass = "rounded-lg bg-slate-50 px-3 py-2 cursor-default";
  const metricTileClass = "rounded-lg bg-slate-50 px-3 py-2";

  const summary = (
    <div className="space-y-2 text-sm text-slate-700">
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
        <div className="space-y-2">
          <div className={metricTileClass}>
            Total workers:{" "}
            <span className="font-semibold text-slate-900">{totalWorkers}</span>
          </div>
          <div className={metricTileClass}>
            Total payroll documents:{" "}
            <span className="font-semibold text-slate-900">{totalPayrollDocs}</span>
          </div>
        </div>
        <div className="space-y-2">
          <div className={metricTileClass}>
            Workers covered:{" "}
            <span className="font-semibold text-slate-900">{coveredWorkers}</span>
          </div>
          <div className={metricTileClass}>
            Assigned payrolls:{" "}
            <span className="font-semibold text-emerald-700">
              {assignedPayrollDocs}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleReconciliation}
          disabled={!reconciliationInteractive}
          className={`rounded-lg border px-3 py-2 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-blue-200 focus:ring-offset-1 ${
            reconciliationInteractive
              ? reconciliationOpen
                ? "border-blue-300 bg-blue-50 hover:bg-blue-100/80 cursor-pointer"
                : "border-amber-300 bg-amber-50 hover:bg-amber-100/80 cursor-pointer"
              : "border-slate-200 bg-slate-50 text-slate-500 cursor-default"
          }`}
        >
          <p className="text-sm text-slate-700">
            Sin asignar:{" "}
            <span className="font-semibold text-amber-700">
              {unassignedPayrollDocs}
            </span>
          </p>
          <p className="mt-1 text-sm text-slate-700">
            Trabajadores sin nómina:{" "}
            <span className="font-semibold text-amber-700">
              {workersMissingPayroll}
            </span>
          </p>
        </button>
      </div>
    </div>
  );

  const headerAndHint = (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-base font-semibold text-slate-800">
            Monthly Completion Snapshot
          </h2>
          {interactive ? (
            <span className="shrink-0 text-slate-400 text-xs" aria-hidden>
              {monthlyListExpanded ? "▲" : "▼"}
            </span>
          ) : null}
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
            isComplete
              ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
              : "bg-amber-50 text-amber-700 ring-amber-600/20"
          }`}
        >
          {isComplete ? "COMPLETE" : "INCOMPLETE"}
        </span>
      </div>

      {interactive ? (
        <p className="text-xs text-slate-500">
          Clic para {monthlyListExpanded ? "ocultar" : "ver"} documentos del mes
        </p>
      ) : null}
    </>
  );

  if (interactive && onClick) {
    return (
      <div className="w-full rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-5 space-y-3">
        <button
          type="button"
          onClick={onClick}
          aria-expanded={monthlyListExpanded}
          className="w-full rounded-xl -mx-1 px-1 py-0.5 text-left cursor-pointer hover:bg-slate-50/80 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:ring-offset-2 transition-colors space-y-2"
        >
          {headerAndHint}
        </button>
        {summary}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-5 space-y-3">
      <div className="space-y-2">{headerAndHint}</div>
      {summary}
    </div>
  );
}
