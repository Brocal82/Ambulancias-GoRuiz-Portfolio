import type { RefObject } from "react";
import type { User } from "../../users";

interface WorkersMissingPayrollProps {
  missingWorkers: User[];
  sectionRef?: RefObject<HTMLDivElement | null>;
  highlight?: boolean;
}

export default function WorkersMissingPayroll({
  missingWorkers,
  sectionRef,
  highlight,
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
        <div className="overflow-x-auto rounded-lg ring-1 ring-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-3 py-2 font-medium text-slate-600">Nombre</th>
                <th className="px-3 py-2 font-medium text-slate-600 whitespace-nowrap">
                  Numero de empleado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {missingWorkers.map((worker) => (
                <tr key={worker._id} className="text-slate-700">
                  <td className="px-3 py-2">
                    <span className="font-medium">
                      {worker.lastName}, {worker.name}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                    {worker.employeeNumber ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
