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
  const isEmpty = totalPayrollDocs === 0;
  const isComplete =
    !isEmpty && unassignedPayrollDocs === 0 && coveredWorkers === totalWorkers;
  const statusLabel = isEmpty ? "EMPTY" : isComplete ? "COMPLETE" : "INCOMPLETE";
  const statusClass = isEmpty
    ? "bg-slate-100 text-slate-600 ring-slate-500/20"
    : isComplete
      ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
      : "bg-amber-50 text-amber-700 ring-amber-600/20";

  const interactive = Boolean(onClick) && totalPayrollDocs > 0;
  const hasReconciliationPending =
    unassignedPayrollDocs > 0 || workersMissingPayroll > 0;
  const reconciliationInteractive =
    Boolean(onToggleReconciliation) && hasReconciliationPending;
  const missingCoveredWorkers = Math.max(totalWorkers - coveredWorkers, 0);
  const missingAssignedPayrolls = Math.max(unassignedPayrollDocs, 0);

  const metricTileClass =
    "rounded-lg bg-slate-50 px-3 py-2 transition-colors group-hover:bg-white";

  const snapshotHeader = (
    <>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:items-start">
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-6 text-slate-800">
            Monthly Completion Snapshot
          </h2>
        </div>
        <span
          className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset sm:justify-self-start ${statusClass}`}
        >
          {statusLabel}
        </span>
      </div>
    </>
  );

  const snapshotMetrics = (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-sm text-slate-700">
      <div className={metricTileClass}>
        Total workers:{" "}
        <span className="font-semibold text-slate-900">{totalWorkers}</span>
      </div>
      <div className={metricTileClass}>
        Workers covered:{" "}
        <span className="font-semibold text-slate-900">
          {coveredWorkers}
          {missingCoveredWorkers > 0 ? (
            <span className="ml-1 text-red-600">({missingCoveredWorkers})</span>
          ) : null}
        </span>
      </div>
      <div className={metricTileClass}>
        Total payroll documents:{" "}
        <span className="font-semibold text-slate-900">{totalPayrollDocs}</span>
      </div>
      <div className={metricTileClass}>
        Assigned payrolls:{" "}
        <span className="font-semibold text-slate-900">
          {assignedPayrollDocs}
          {missingAssignedPayrolls > 0 ? (
            <span className="ml-1 text-red-600">({missingAssignedPayrolls})</span>
          ) : null}
        </span>
      </div>
    </div>
  );

  const issuesPanel = (
    <button
      type="button"
      onClick={onToggleReconciliation}
      disabled={!reconciliationInteractive}
      className={`h-full rounded-xl border px-3 pt-2.5 pb-3 text-left transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md active:translate-y-0.5 active:shadow-sm outline-none focus:outline-none focus:ring-0 focus:ring-offset-0 ${
        reconciliationInteractive
          ? reconciliationOpen
            ? "border-red-400 bg-red-50/50 hover:bg-red-50/70 cursor-pointer group"
            : "border-red-300 bg-white hover:bg-red-50/50 cursor-pointer group"
          : "border-slate-200 bg-slate-50 text-slate-500 cursor-default"
      }`}
    >
      <div className="min-w-0">
        <h2 className="text-base font-semibold leading-6 text-slate-800">
          Incidencias
        </h2>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-700">
        <div className={metricTileClass}>
          <div className="flex items-center justify-between gap-3">
            <span>Sin asignar</span>
            <span className="font-semibold text-amber-700">
              {unassignedPayrollDocs}
            </span>
          </div>
        </div>
        <div className={metricTileClass}>
          <div className="flex items-center justify-between gap-3">
            <span>Trabajadores sin nómina</span>
            <span className="font-semibold text-amber-700">
              {workersMissingPayroll}
            </span>
          </div>
        </div>
      </div>
    </button>
  );

  if (interactive && onClick) {
    return (
      <div className="w-full rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-5">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <button
            type="button"
            onClick={onClick}
            aria-expanded={monthlyListExpanded}
            className={`lg:col-span-2 h-full rounded-xl border px-3 py-3 text-left cursor-pointer outline-none focus:outline-none focus:ring-0 focus:ring-offset-0 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md active:translate-y-0.5 active:shadow-sm space-y-3 group ${
              monthlyListExpanded
                ? "border-emerald-400 bg-emerald-50/50 hover:bg-emerald-50/70"
                : "border-emerald-200 bg-white hover:bg-emerald-50/50"
            }`}
          >
            {snapshotHeader}
            {snapshotMetrics}
          </button>
          {issuesPanel}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-5">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2 h-full rounded-xl border border-emerald-200 bg-white px-3 py-3 space-y-3">
          {snapshotHeader}
          {snapshotMetrics}
        </div>
        {issuesPanel}
      </div>
    </div>
  );
}
