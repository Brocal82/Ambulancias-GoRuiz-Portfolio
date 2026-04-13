import type { User } from "../../users";

interface WorkersMissingPayrollProps {
  missingWorkers: User[];
}

export default function WorkersMissingPayroll({
  missingWorkers,
}: WorkersMissingPayrollProps) {
  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-5">
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
              <span className="font-medium">
                {worker.lastName}, {worker.name}
              </span>
              {worker.employeeNumber ? (
                <span className="ml-2 text-slate-500">
                  ({worker.employeeNumber})
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
