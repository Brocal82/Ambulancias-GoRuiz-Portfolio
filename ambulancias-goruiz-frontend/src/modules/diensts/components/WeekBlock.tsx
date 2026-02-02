import type React from "react";

type WeekBlockProps = {
    title: string;
    children: React.ReactNode;
    className?: string;

    /**
     * ✅ true (default): WeekBlock incluye el grid de 7 días
     * ✅ false: WeekBlock solo actúa como wrapper (sin grid)
     */
    withGrid?: boolean;

    /**
     * ✅ true (default): muestra el título arriba
     * ✅ false: NO muestra el título (útil si el contenido ya trae su propio header)
     */
    showTitle?: boolean;
};

/**
 * Wrapper visual único para una semana (título + contenido).
 * - Worker/AdminUser: withGrid=true, showTitle=true
 * - AdminDiensts: withGrid=false, showTitle=false (porque ya tiene header propio)
 */
export const WeekBlock: React.FC<WeekBlockProps> = ({
    title,
    children,
    className,
    withGrid = true,
    showTitle = true,
}) => {
    return (
        <div
            className={[
                "rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-4",
                className ?? "",
            ].join(" ")}
        >
            {showTitle && (
                <p className="text-sm font-medium text-slate-700 mb-3">{title}</p>
            )}

            {withGrid ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    {children}
                </div>
            ) : (
                <>{children}</>
            )}
        </div>
    );
};
