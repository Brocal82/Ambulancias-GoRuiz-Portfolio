import React from "react";
import { withCommonIconButtonInteraction } from "./iconButtonStyles";

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
      className={withCommonIconButtonInteraction(
        `inline-flex h-8 w-8 items-center justify-center rounded-full text-base text-rose-700 hover:bg-rose-100 focus:outline-none focus:ring-4 focus:ring-rose-100 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-transparent ${className}`,
      )}
      {...props}
    >
      🛑
    </button>
  );
};

export default StopIconButton;
