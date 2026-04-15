import type { PayrollMatchStatus } from "../domain/types";

interface MatchBadgeProps {
  status: PayrollMatchStatus;
}

export default function MatchBadge({ status }: MatchBadgeProps) {
  if (status === "matched") {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
        Auto-asignada
      </span>
    );
  }

  if (status === "unmatched") {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
        Sin asignar
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/20">
      Manual
    </span>
  );
}
