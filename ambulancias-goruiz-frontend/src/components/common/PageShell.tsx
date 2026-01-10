// src/components/common/PageShell.tsx
import React from "react";

type Props = {
    title?: React.ReactNode;
    subtitle?: React.ReactNode;
    children: React.ReactNode;
    maxWidthClassName?: string; // por defecto max-w-4xl
    className?: string; // para ajustes puntuales
};

const PageShell: React.FC<Props> = ({
    title,
    subtitle,
    children,
    maxWidthClassName = "max-w-4xl",
    className,
}) => {
    return (
        <div className={["min-h-screen bg-slate-50", className ?? ""].join(" ")}>
            <div
                className={[
                    "mx-auto px-4 sm:px-6 lg:px-8 py-6",
                    maxWidthClassName,
                ].join(" ")}
            >
                {(title || subtitle) && (
                    <div className="mb-4 text-center">
                        {title && (
                            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                                {title}
                            </h2>
                        )}
                        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
                    </div>
                )}

                {children}
            </div>
        </div>
    );
};

export default PageShell;
