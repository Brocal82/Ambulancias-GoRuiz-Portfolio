import type React from "react";

export type WeekBlockProps = {
    title: string;
    children: React.ReactNode;
    className?: string;

    /** Si quieres que WeekBlock pinte el título arriba (por defecto true) */
    showTitle?: boolean;

    /** Si quieres que WeekBlock envuelva children en la grid (por defecto true) */
    withGrid?: boolean;
};

export const WEEK_GRID_CLASS =
    "grid grid-cols-7 gap-3";



/**
 * Wrapper visual único para una semana.
 * - Puede pintar el título o dejarte poner un header custom.
 * - Puede crear la grid estándar o dejarte renderizar lo que quieras dentro.
 */
export const WeekBlock: React.FC<WeekBlockProps> = ({
    title,
    children,
    className,
    showTitle = true,
    withGrid = true,
}) => {
    return (
        <div
            className={[
                "rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-3",
                className ?? "",
            ].join(" ")}
        >
            {showTitle && (
                <p className="text-sm font-medium text-slate-700 mb-2">{title}</p>
            )}

            {withGrid ? (
                <div className={WEEK_GRID_CLASS}>

                    {children}
                </div>
            ) : (
                <>{children}</>
            )}
        </div>
    );
};
