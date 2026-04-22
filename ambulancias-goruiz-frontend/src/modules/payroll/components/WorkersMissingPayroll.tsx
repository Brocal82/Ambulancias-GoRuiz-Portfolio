import type { RefObject } from "react";
import type { User } from "../../users";
import { APP_NAV_MATCH_TABLE_HEADER_TR } from "../../../components/ui/appTableHeader";

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
      className={`rounded-2xl bg-white shadow-sm overflow-hidden transition-shadow duration-300 ${
        highlight
          ? "ring-2 ring-blue-300 ring-offset-2"
          : "ring-1 ring-slate-200"
      }`}
    >
      <div className="px-4 py-2 border-b border-slate-800 bg-slate-900/95">
        <h2 className="text-sm font-semibold text-slate-100 leading-tight">
          Workers Missing Payroll
        </h2>
      </div>

      {missingWorkers.length === 0 ? (
        <p className="px-4 py-5 text-center text-xs text-slate-500">
          Todos los trabajadores tienen nómina asignada
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className={APP_NAV_MATCH_TABLE_HEADER_TR}>
                <th className="px-3 py-1 text-xs font-medium text-slate-200">Nombre</th>
                <th className="px-3 py-1 text-xs font-medium text-slate-200 whitespace-nowrap">
                  Numero de empleado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {missingWorkers.map((worker) => (
                <tr key={worker._id} className="transition-colors hover:bg-slate-50/70">
                  <td className="px-3 py-1.5 text-slate-800 align-middle min-w-[14rem]">
                    <span className="font-medium">
                      {worker.lastName}, {worker.name}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap tabular-nums text-slate-700 align-middle">
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
