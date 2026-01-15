//frontend/src/components/vacation/ui/adminStatusBadge.tsx
import type { TFunction } from "i18next";
import type { VacationStatus } from "../../../types/vacation";
import StatusBadge from "../../common/StatusBadge";

/**
 * Badge de estado para UI de Admin (modal mensual / tablas).
 * - Mantiene traducciones actuales del admin
 * - Unifica paleta con el estándar de vacaciones (amber/emerald/sky/rose)
 * - Sin cambios funcionales
 */
export const adminStatusBadge = (t: TFunction, status: VacationStatus) => {
    const labelMap: Record<VacationStatus, string> = {
        pending: t("pages.vacations.monthModal.filters.pending"),
        accepted: t("pages.vacations.monthModal.filters.accepted"),
        option_sent: t("pages.vacations.monthModal.filters.option_sent"),
        cancelled: t("pages.vacations.monthModal.filters.cancelled"),
    };

    return (
        <StatusBadge
            context="vacation"
            palette="vacation"
            status={status}
            label={labelMap[status]}
        />
    );
};
