import React from "react";
import { withCommonIconButtonInteraction } from "./iconButtonStyles";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  title?: string;
};

const CopyLinkIconButton = ({
  type = "button",
  title = "Copiar enlace",
  className = "",
  ...props
}: Props) => {
  return (
    <button
      type={type}
      title={title}
      aria-label={title}
      className={withCommonIconButtonInteraction(`
        inline-flex items-center justify-center
        h-10 w-10
        rounded-full
        bg-white
        text-lg
        text-slate-700
        shadow-sm
        hover:bg-slate-50
        focus:outline-none
        focus-visible:ring-1 focus-visible:ring-orange-200/60
        disabled:opacity-50
        disabled:cursor-not-allowed
        disabled:pointer-events-none
        ${className}
      `)}
      {...props}
    >
      <span aria-hidden>🔗</span>
    </button>
  );
};

export default CopyLinkIconButton;
