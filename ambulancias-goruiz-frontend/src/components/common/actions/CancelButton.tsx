import React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children?: React.ReactNode;
};

const CancelButton = ({ children, className = "", type, ...props }: Props) => {
    return (
        <button
            // Por defecto evitamos submit accidental si alguien lo usa dentro de un <form>
            type={type ?? "button"}
            className={[
                // layout
                "inline-flex items-center justify-center",
                "h-7 rounded-lg px-3",
                "text-xs font-medium",
                // semantic cancel look
                "border border-rose-200",
                "bg-rose-50 text-rose-700",
                // interaction
                "hover:bg-rose-100 hover:border-rose-300",
                "focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-2",
                "active:translate-y-[1px]",
                // disabled
                "disabled:opacity-50 disabled:pointer-events-none",
                // animation polish
                "transition-colors",
                className,
            ].join(" ")}
            {...props}
        >
            {children ?? "Cancelar"}
        </button>
    );
};

export default CancelButton;
