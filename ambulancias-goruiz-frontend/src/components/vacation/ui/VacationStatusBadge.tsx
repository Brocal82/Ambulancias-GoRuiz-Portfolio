import React from "react";
import { useTranslation } from "react-i18next";
import type { VacationStatus } from "../../../types/vacation";
import StatusBadge from "../../common/StatusBadge";

type Props = {
    status: VacationStatus;
    className?: string;
};

const VacationStatusBadge: React.FC<Props> = ({ status, className }) => {
    const { t } = useTranslation();

    const label =
        status === "pending"
            ? t("pages.vacations.status.pending", "Pendiente")
            : status === "accepted"
                ? t("pages.vacations.status.accepted", "Aceptada")
                : status === "option_sent"
                    ? t("pages.vacations.status.option_sent", "alternativa")
                    : t("pages.vacations.status.cancelled", "Cancelada");

    // Mantener el look exacto del módulo (100/800) aunque el badge común use otras clases por defecto
    const palette =
        status === "pending"
            ? "bg-amber-100 text-amber-800 border-transparent"
            : status === "accepted"
                ? "bg-emerald-100 text-emerald-800 border-transparent"
                : status === "option_sent"
                    ? "bg-sky-100 text-sky-800 border-transparent"
                    : "bg-rose-100 text-rose-800 border-transparent";

    return (
        <StatusBadge
            context="vacation"
            status={status}
            label={label}
            className={`${palette} ${className ?? ""}`}
        />
    );
};

export default VacationStatusBadge;
