import React from "react";
import { withCommonIconButtonInteraction } from "./iconButtonStyles";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  title?: string;
};

const ProposeSlotsIconButton = ({
  type = "button",
  title = "Proponer horarios",
  className = "",
  ...props
}: Props) => {
  return (
    <button
      type={type}
      title={title}
      aria-label={title}
      className={withCommonIconButtonInteraction(
        `inline-flex h-8 w-8 items-center justify-center rounded-full text-base text-indigo-700 hover:bg-indigo-100 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-transparent ${className}`,
      )}
      {...props}
    >
      🕒
    </button>
  );
};

export default ProposeSlotsIconButton;
