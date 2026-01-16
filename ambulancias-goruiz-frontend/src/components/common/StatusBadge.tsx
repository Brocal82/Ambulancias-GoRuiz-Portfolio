import React from "react";

export type StatusTone = "amber" | "emerald" | "sky" | "rose" | "slate";

type Props = {
  /** Texto visible dentro del chip */
  label: string;
  /** Paleta global del proyecto */
  tone: StatusTone;
  className?: string;
};

const toneClasses: Record<StatusTone, string> = {
  amber: "bg-amber-100 text-amber-800 border-transparent",
  emerald: "bg-emerald-100 text-emerald-800 border-transparent",
  sky: "bg-sky-100 text-sky-800 border-transparent",
  rose: "bg-rose-100 text-rose-800 border-transparent",
  slate: "bg-slate-100 text-slate-700 border-transparent",
};

const StatusBadge: React.FC<Props> = ({ label, tone, className }) => {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className ?? "",
      ].join(" ")}
    >
      {label}
    </span>
  );
};

export default StatusBadge;
