import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { IVacationRequest } from "../../modules/vacation/domain/types";
import UserVacationList from "./UserVacationList";
import { toBerlinDayKey } from "../../utils/dates/dayKey";
import { getRequestRangeBerlin } from "../../modules/vacation/utils/getRequestRangeBerlin";

type Props = {
    /** Solicitudes activas (o las que tú le pases) */
    requests: IVacationRequest[];

    /** Mes abierto en el modal: 0..11 */
    monthIndex: number;

    /** Año abierto en el modal */
    year: number;

    /** Acciones (necesarias para tener lo mismo que el desplegable) */
    onCancelRequest?: (id: string) => void;
    onRespondAlternative?: (id: string, accept: boolean) => void;
};

const WorkerMonthRequests: React.FC<Props> = ({
    requests,
    monthIndex,
    year,
    onCancelRequest,
    onRespondAlternative,
}) => {
    const { t } = useTranslation();

    const monthRequests = useMemo(() => {
        // Rango del mes en "Berlin dayKey" (inclusive)
        // Usamos 12:00 para evitar edge cases de DST al convertir a dayKey.
        const monthStartKey = toBerlinDayKey(new Date(year, monthIndex, 1, 12, 0, 0, 0));
        const monthEndKey = toBerlinDayKey(new Date(year, monthIndex + 1, 0, 12, 0, 0, 0));

        if (!monthStartKey || !monthEndKey) return [];

        return requests.filter((r) => {
            const { start, end } = getRequestRangeBerlin(r);

            const sKey = toBerlinDayKey(start);
            const eKey = toBerlinDayKey(end);
            if (!sKey || !eKey) return false;

            // Normalizamos por si algo viene invertido
            const startKey = sKey <= eKey ? sKey : eKey;
            const endKey = sKey <= eKey ? eKey : sKey;

            // Solape inclusivo: [startKey, endKey] toca [monthStartKey, monthEndKey]
            return startKey <= monthEndKey && monthStartKey <= endKey;
        });
    }, [requests, monthIndex, year]);



    // Si no hay solicitudes para este mes, no mostramos nada
    if (monthRequests.length === 0) return null;

    // Si faltan handlers, no renderizamos la tabla (evita errores)
    if (!onCancelRequest || !onRespondAlternative) return null;

    return (
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-3">
            <h4 className="text-sm font-semibold text-slate-900">
                {t(
                    "pages.vacations.workerPage.monthRequestsTitle",
                    "Solicitudes de este mes"
                )}
            </h4>

            {/* En móvil, la tabla puede necesitar scroll horizontal */}
            <div className="mt-2 w-full min-w-0 overflow-x-auto">
                <UserVacationList
                    requests={monthRequests}
                    onCancelRequest={onCancelRequest}
                    onRespondAlternative={onRespondAlternative}
                />
            </div>
        </div>
    );
};

export default WorkerMonthRequests;

