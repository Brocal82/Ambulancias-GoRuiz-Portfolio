interface PayrollCompletionSnapshotProps {
  totalPayrollDocs: number;
  assignedPayrollDocs: number;
  unassignedPayrollDocs: number;
  coveredWorkers: number;
  totalWorkers: number;
}

export default function PayrollCompletionSnapshot({
  totalPayrollDocs,
  assignedPayrollDocs,
  unassignedPayrollDocs,
  coveredWorkers,
  totalWorkers,
}: PayrollCompletionSnapshotProps) {
  const isComplete =
    unassignedPayrollDocs === 0 && coveredWorkers === totalWorkers;

  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-800">
          Monthly Completion Snapshot
        </h2>
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
    </div>
  );
}
