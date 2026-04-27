import React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  title?: string;
};

const StopIconButton = ({
  type = "button",
  title = "Solicitar cancelación",
  className = "",
  ...props
}: Props) => {
  return (
    <button
      type={type}
      title={title}
      aria-label={title}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border border-transparent bg-transparent text-base text-rose-700 hover:border-rose-400 hover:bg-rose-50 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md active:translate-y-0.5 active:shadow-sm focus:outline-none focus:ring-4 focus:ring-rose-100 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-transparent ${className}`}
      {...props}
    >
      🛑
    </button>
  );
};

export default StopIconButton;
