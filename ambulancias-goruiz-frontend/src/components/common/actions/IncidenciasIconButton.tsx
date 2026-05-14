import React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  count?: number;
  title?: string;
};

const IncidenciasIconButton = ({
  count,
  title = "Ver incidencias",
  className = "",
  ...props
}: Props) => {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className={`relative inline-flex items-center justify-center w-9 h-9 rounded-full border border-transparent hover:border-amber-500 hover:-translate-y-0.5 hover:scale-110 active:scale-95 active:translate-y-0 focus:outline-none focus:ring-4 focus:ring-amber-200 disabled:opacity-60 transition-all duration-200 ease-out ${className}`}
      {...props}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5 text-amber-500"
        aria-hidden="true"
      >
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>

      {count !== undefined && count > 0 && (
        <span className="absolute -top-1 -right-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white leading-none">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </button>
  );
};

export default IncidenciasIconButton;
