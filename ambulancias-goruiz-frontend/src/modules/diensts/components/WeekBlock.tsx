import type React from "react";

type WeekBlockProps = {
    title: string;
    children: React.ReactNode;
    className?: string;
};

/**
 * Wrapper visual único para una semana (título + grid).
 * No mete lógica de fechas aquí: solo estructura y consistencia UX.
 */
export const WeekBlock: React.FC<WeekBlockProps> = ({
    title,
    children,
    className,
}) => {
    return (
        <div
            className={[
                "rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-4",
                className ?? "",
            ].join(" ")}
        >
            <p className="text-sm font-medium text-slate-700 mb-3">{title}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {children}
            </div>
        </div>
    );
};
