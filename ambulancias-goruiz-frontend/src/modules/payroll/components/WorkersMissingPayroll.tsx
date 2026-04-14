import type { RefObject } from "react";
import type { User } from "../../users";

interface WorkersMissingPayrollProps {
  missingWorkers: User[];
  sectionRef?: RefObject<HTMLDivElement | null>;
  highlight?: boolean;
  onViewUnassignedPayrolls?: () => void;
}

export default function WorkersMissingPayroll({
  missingWorkers,
  sectionRef,
  highlight,
  onViewUnassignedPayrolls,
}: WorkersMissingPayrollProps) {
  return (
    <div
      ref={sectionRef}
      className={`rounded-2xl bg-white shadow-sm p-5 transition-shadow duration-300 ${
        highlight
          ? "ring-2 ring-blue-300 ring-offset-2"
          : "ring-1 ring-slate-200"
      }`}
    >
      <h2 className="text-base font-semibold text-slate-800 mb-3">
        Workers Missing Payroll
      </h2>

      {missingWorkers.length === 0 ? (
        <p className="text-sm text-slate-600">
          Todos los trabajadores tienen nómina asignada
        </p>
      ) : (
        <ul className="space-y-2">
          {missingWorkers.map((worker) => (
            <li
              key={worker._id}
              className="text-sm text-slate-700 rounded-lg bg-slate-50 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-medium">
                    {worker.lastName}, {worker.name}
                  </span>
                  {worker.employeeNumber ? (
                    <span className="ml-2 text-slate-500">
                      ({worker.employeeNumber})
                    </span>
                  ) : null}
                </div>
                {onViewUnassignedPayrolls ? (
                  <button
                    type="button"
                    onClick={onViewUnassignedPayrolls}
                    className="shrink-0 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-100"
                  >
                    Ver nóminas sin asignar
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
