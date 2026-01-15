import React from "react";
import { useTranslation } from "react-i18next";
import type { VacationStatus } from "../../../types/vacation";

type Props = {
    status: VacationStatus;
    className?: string;
};

const VacationStatusBadge: React.FC<Props> = ({ status, className }) => {
    const { t } = useTranslation();

    const base =
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";

    if (status === "pending") {
        return (
            <span className={`${base} bg-amber-100 text-amber-800 ${className ?? ""}`}>
                {t("pages.vacations.status.pending", "Pendiente")}
            </span>
        );
    }

    if (status === "accepted") {
        return (
            <span
                className={`${base} bg-emerald-100 text-emerald-800 ${className ?? ""}`}
            >
                {t("pages.vacations.status.accepted", "Aceptada")}
            </span>
        );
    }

    if (status === "option_sent") {
        return (
            <span className={`${base} bg-sky-100 text-sky-800 ${className ?? ""}`}>
                {t("pages.vacations.status.option_sent", "alternativa")}
            </span>
        );
    }

    // fallback: cancelled
    return (
        <span className={`${base} bg-rose-100 text-rose-800 ${className ?? ""}`}>
            {t("pages.vacations.status.cancelled", "Cancelada")}
        </span>
    );
};

export default VacationStatusBadge;
