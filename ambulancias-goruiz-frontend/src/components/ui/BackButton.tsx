import { Link } from "react-router-dom";

type BackButtonProps = {
  to: string;
  label?: string;
};

export default function BackButton({ to, label = "Volver" }: BackButtonProps) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200 rounded"
    >
      <svg
        className="h-4 w-4 shrink-0"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
      {label}
    </Link>
  );
}
