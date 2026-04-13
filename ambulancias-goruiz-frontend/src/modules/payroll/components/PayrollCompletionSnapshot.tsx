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
  /** Scroll to UnassignedPayrolls in the resolution workspace. */
  onNavigateToUnassignedPayrolls?: () => void;
  /** Scroll to WorkersMissingPayroll in the resolution workspace. */
  onNavigateToWorkersMissingPayroll?: () => void;
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
  onNavigateToUnassignedPayrolls,
  onNavigateToWorkersMissingPayroll,
}: PayrollCompletionSnapshotProps) {
  const isComplete =
    unassignedPayrollDocs === 0 && coveredWorkers === totalWorkers;

  const interactive = Boolean(onClick) && totalPayrollDocs > 0;

  const staticTileClass = "rounded-lg bg-slate-50 px-3 py-2 cursor-default";

  const grid = (
    <div className="grid grid-cols-1 gap-2 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-3">
      <div className={staticTileClass}>
        Total payroll documents:{" "}
        <span className="font-semibold text-slate-900">{totalPayrollDocs}</span>
      </div>
      <div className={staticTileClass}>
        Assigned payrolls:{" "}
        <span className="font-semibold text-emerald-700">
          {assignedPayrollDocs}
        </span>
      </div>
      {onNavigateToUnassignedPayrolls ? (
        <button
          type="button"
          onClick={onNavigateToUnassignedPayrolls}
          className="rounded-lg bg-slate-50 px-3 py-2 text-left w-full cursor-pointer hover:bg-slate-100/90 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-200 focus:ring-offset-1"
        >
          Unassigned payrolls:{" "}
          <span className="font-semibold text-amber-700">
            {unassignedPayrollDocs}
          </span>
        </button>
      ) : (
        <div className={staticTileClass}>
          Unassigned payrolls:{" "}
          <span className="font-semibold text-amber-700">
            {unassignedPayrollDocs}
          </span>
        </div>
      )}
      <div className={staticTileClass}>
        Workers covered:{" "}
        <span className="font-semibold text-slate-900">{coveredWorkers}</span>
      </div>
      {onNavigateToWorkersMissingPayroll ? (
        <button
          type="button"
          onClick={onNavigateToWorkersMissingPayroll}
          className="rounded-lg bg-slate-50 px-3 py-2 text-left w-full cursor-pointer hover:bg-slate-100/90 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-200 focus:ring-offset-1"
        >
          Workers missing payroll:{" "}
          <span className="font-semibold text-amber-700">
            {workersMissingPayroll}
          </span>
        </button>
      ) : (
        <div className={staticTileClass}>
          Workers missing payroll:{" "}
          <span className="font-semibold text-amber-700">
            {workersMissingPayroll}
          </span>
        </div>
      )}
      <div className={staticTileClass}>
        Total workers:{" "}
        <span className="font-semibold text-slate-900">{totalWorkers}</span>
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
        {grid}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-5 space-y-3">
      <div className="space-y-2">{headerAndHint}</div>
      {grid}
    </div>
  );
}
