import type { PayrollDocument } from "../domain/types";

interface UnassignedPayrollsProps {
  unassignedPayrolls: PayrollDocument[];
}

export default function UnassignedPayrolls({
  unassignedPayrolls,
}: UnassignedPayrollsProps) {
  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-5">
      <h2 className="text-base font-semibold text-slate-800 mb-3">
        Unassigned Payrolls
      </h2>

      {unassignedPayrolls.length === 0 ? (
        <p className="text-sm text-slate-600">Todas las nóminas están asignadas</p>
      ) : (
        <ul className="space-y-2">
          {unassignedPayrolls.map((doc) => (
            <li
              key={doc._id}
              className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700"
            >
              <p className="font-medium text-slate-800">{doc.originalName}</p>
              {doc.parsedEmployeeNumber ? (
                <p className="text-slate-500">
                  Nº empleado detectado: {doc.parsedEmployeeNumber}
                </p>
              ) : null}
              {doc.matchReason ? (
                <p className="text-slate-500">{doc.matchReason}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
