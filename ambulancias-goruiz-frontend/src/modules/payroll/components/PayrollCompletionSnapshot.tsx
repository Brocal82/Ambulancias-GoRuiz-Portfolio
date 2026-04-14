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
      {onToggleReconciliation ? (
        <button
          type="button"
          onClick={onToggleReconciliation}
          className={`rounded-lg px-3 py-2 text-left w-full cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-200 focus:ring-offset-1 sm:col-span-2 ${
            reconciliationOpen
              ? "bg-blue-50 ring-1 ring-blue-200 hover:bg-blue-100/80"
              : "bg-slate-50 hover:bg-slate-100/90"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-slate-800">
              Reconciliation
            </span>
            <span className="text-[11px] text-slate-500">
              {reconciliationOpen ? "Abierto" : "Abrir"}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            Sin asignar:{" "}
            <span className="font-semibold text-amber-700">
              {unassignedPayrollDocs}
            </span>
            {" · "}
            Trabajadores sin nómina:{" "}
            <span className="font-semibold text-amber-700">
              {workersMissingPayroll}
            </span>
          </p>
        </button>
      ) : (
        <div className={`${staticTileClass} sm:col-span-2`}>
          Reconciliation · Sin asignar:{" "}
          <span className="font-semibold text-amber-700">{unassignedPayrollDocs}</span>
          {" · "}Trabajadores sin nómina:{" "}
          <span className="font-semibold text-amber-700">{workersMissingPayroll}</span>
        </div>
      )}
      <div className={staticTileClass}>
        Workers covered:{" "}
        <span className="font-semibold text-slate-900">{coveredWorkers}</span>
      </div>
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
