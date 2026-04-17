import React from "react";
import { withCommonIconButtonInteraction } from "./iconButtonStyles";

interface DayOffIconButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> { }

const DayOffIconButton = ({
    type = "button",
    title = "Marcar día como libre",
    className = "",
    ...props
}: DayOffIconButtonProps) => {
    return (
        <button
            type={type}
            title={title}
            className={withCommonIconButtonInteraction(`
        inline-flex items-center justify-center
        w-14 h-14
        rounded-full
        text-2xl
        text-slate-700
        transition
        hover:bg-emerald-50

        disabled:opacity-60
        disabled:cursor-not-allowed
        disabled:hover:bg-transparent
        ${className}
      `)}
            {...props}
        >
            🌴
        </button>
    );
};

export default DayOffIconButton;
