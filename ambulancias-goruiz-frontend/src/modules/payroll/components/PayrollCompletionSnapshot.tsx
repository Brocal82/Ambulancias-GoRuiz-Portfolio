interface PayrollCompletionSnapshotProps {
  totalPayrollDocs: number;
  assignedPayrollDocs: number;
  unassignedPayrollDocs: number;
  coveredWorkers: number;
  totalWorkers: number;
  /** When set and there is at least one payroll doc, the snapshot is clickable (toggles monthly list). */
  onClick?: () => void;
  /** Reflects expanded state for a11y + chevron when interactive. */
  monthlyListExpanded?: boolean;
}

export default function PayrollCompletionSnapshot({
  totalPayrollDocs,
  assignedPayrollDocs,
  unassignedPayrollDocs,
  coveredWorkers,
  totalWorkers,
  onClick,
  monthlyListExpanded = false,
}: PayrollCompletionSnapshotProps) {
  const isComplete =
    unassignedPayrollDocs === 0 && coveredWorkers === totalWorkers;

  const interactive = Boolean(onClick) && totalPayrollDocs > 0;

  const inner = (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-base font-semibold text-slate-800">
            Monthly Completion Snapshot
          </h2>
          {interactive ? (
            <span
              className="shrink-0 text-slate-400 text-xs"
              aria-hidden
            >
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

      <div className="grid grid-cols-1 gap-2 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          Total payroll documents:{" "}
          <span className="font-semibold text-slate-900">{totalPayrollDocs}</span>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          Assigned payrolls:{" "}
          <span className="font-semibold text-emerald-700">{assignedPayrollDocs}</span>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          Unassigned payrolls:{" "}
          <span className="font-semibold text-amber-700">{unassignedPayrollDocs}</span>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          Workers covered:{" "}
          <span className="font-semibold text-slate-900">{coveredWorkers}</span>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          Total workers:{" "}
          <span className="font-semibold text-slate-900">{totalWorkers}</span>
        </div>
      </div>
    </>
  );

  if (interactive && onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-expanded={monthlyListExpanded}
        className="w-full rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-5 space-y-3 text-left cursor-pointer hover:bg-slate-50/80 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:ring-offset-2 transition-colors"
      >
        {inner}
      </button>
    );
  }

  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-5 space-y-3">
      {inner}
    </div>
  );
}
