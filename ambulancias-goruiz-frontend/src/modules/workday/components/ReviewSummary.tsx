// src/components/workday/ReviewSummary.tsx
import React from "react";
import type { Trip } from "../domain/types/trip";
import type { AssignedDayFull } from "../../../modules/diensts";
import { formatYYYYMMDDToDDMMYYYY } from "../../../utils/timeUtils";
import { useTranslation } from "react-i18next";
import { APP_NAV_MATCH_TABLE_THEAD } from "../../../components/ui/appTableHeader";

const calcTripKm = (t: Trip) => Math.max(0, t.kmEnd - t.kmStart);

const getMultiplier = (t: Trip, totalKm: number, isWeekendLate: boolean) => {
    if (t.countsTrip === 0) return 0;
    if (t.countsTrip === 1) {
        if (totalKm >= 20) return 2;
        if (totalKm >= 15 || isWeekendLate) return 1.5;
        return 1;
    }
    if (totalKm >= 20) return 2;
    if (totalKm >= 15 || isWeekendLate) return 1.5;
    return 1;
};

interface Props {
    assignedDay: AssignedDayFull;
    ambulanceNumber: string;
    initialKm: number;
    finalKm: number;
    trips: Trip[];
    hideHeader?: boolean; // oculta la cabecera (fecha, horas, equipo, km)
    dense?: boolean; // activa modo compacto (menos alto)
    /** When false, hides prämie multiplier column (Phase 2 workday gating). */
    showPraemieColumn?: boolean;
    /** When set with showPraemieColumn, adds Total Prämie column in header. */
    totalEffectivePatients?: number | null;
}

const ReviewSummary: React.FC<Props> = ({
    assignedDay,
    ambulanceNumber,
    initialKm,
    finalKm,
    trips,
    hideHeader = false,
    dense = false,
    showPraemieColumn = true,
    totalEffectivePatients = null,
}) => {
    const { t } = useTranslation();
    const tableColSpan = showPraemieColumn ? 13 : 12;

    const weekendLate =
        showPraemieColumn &&
        [0, 6].includes(new Date(assignedDay.date).getDay()) &&
        (() => {
            const h = Number(assignedDay.startTime.split(":")[0] ?? 0);
            return h >= 14 && h <= 17;
        })();

    const totalKmDiff = Math.max(0, finalKm - initialKm);
    const showTotalPraemieHeader =
        showPraemieColumn && totalEffectivePatients != null;

    const formatPerson = (p: any): string => {
        if (!p) return t("pages.workday.reviewSummary.labels.deletedUser");
        if (typeof p === "string") return p;
        const last = p?.lastName ?? "";
        const first = p?.name ?? "";
        const full = [last, first].filter(Boolean).join(", ");
        return full || t("pages.workday.reviewSummary.labels.deletedUser");
    };

    const headerColCount = showTotalPraemieHeader ? 7 : 6;

    // 🔧 Clases condicionales para modo compacto
    const tableText = dense ? "text-[11px]" : "text-xs";
    const headCell = dense ? "px-1 py-1" : "px-2 py-2";
    const cell = dense ? "px-1 py-1" : "px-2 py-2";
    const zebraLight = dense ? "bg-slate-50/70" : "bg-slate-50/50";
    const zebraAlt = dense ? "bg-white" : "bg-white";
    const cardShell =
        "w-full rounded-xl ring-1 ring-slate-200 bg-white overflow-hidden";
    const tableScroll = dense
        ? "w-full overflow-x-auto overflow-y-auto max-h-64"
        : "w-full overflow-x-auto";

    return (
        <div className={`w-full min-w-0 ${dense ? "space-y-3" : "space-y-4"}`}>
            <div className={cardShell}>
                {!hideHeader && (
                    <div
                        className={[
                            "w-full border-b border-slate-200 bg-slate-50/70",
                            dense ? "px-2 py-2" : "px-3 py-3",
                        ].join(" ")}
                    >
                        <div
                            className={[
                                "grid w-full text-center",
                                headerColCount === 7 ? "grid-cols-7" : "grid-cols-6",
                                dense
                                    ? "gap-x-1 gap-y-1 text-[11px]"
                                    : "gap-x-2 gap-y-1 text-sm",
                            ].join(" ")}
                        >
                            <div className="min-w-0 px-0.5">
                                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                    {t("pages.workday.reviewSummary.labels.header.date")}
                                </div>
                                <div className="font-semibold text-slate-800">
                                    {formatYYYYMMDDToDDMMYYYY(assignedDay.date)}
                                </div>
                            </div>

                            <div className="min-w-0 px-0.5">
                                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                    {t("pages.workday.reviewSummary.labels.header.schedule")}
                                </div>
                                <div className="text-slate-700">
                                    {assignedDay.startTime} – {assignedDay.endTime}
                                </div>
                            </div>

                            <div className="min-w-0 px-0.5">
                                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                    {t("pages.workday.reviewSummary.labels.header.team")}
                                </div>
                                <div className="space-y-0 text-slate-700">
                                    <div className="truncate">
                                        {formatPerson(assignedDay.driver)}
                                    </div>
                                    <div className="truncate">
                                        {formatPerson(assignedDay.medic)}
                                    </div>
                                </div>
                            </div>

                            <div className="min-w-0 px-0.5">
                                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                    {t("pages.workday.reviewSummary.labels.header.ambulance")}
                                </div>
                                <div className="font-semibold text-slate-800 truncate">
                                    {ambulanceNumber}
                                </div>
                            </div>

                            <div className="min-w-0 px-0.5">
                                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                    {t("pages.workday.reviewSummary.labels.header.km")}
                                </div>
                                <div className="text-slate-700">
                                    {initialKm} → {finalKm}
                                </div>
                            </div>

                            <div className="min-w-0 px-0.5">
                                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                    {t("pages.workday.reviewSummary.labels.header.totalKm")}
                                </div>
                                <div className="font-semibold text-slate-800">
                                    {t("pages.workday.reviewSummary.labels.totalKm", {
                                        km: totalKmDiff,
                                    })}
                                </div>
                            </div>

                            {showTotalPraemieHeader ? (
                                <div className="min-w-0 px-0.5">
                                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                        {t(
                                            "pages.workday.reviewSummary.labels.header.totalPraemie",
                                        )}
                                    </div>
                                    <div className="font-semibold text-emerald-700">
                                        {totalEffectivePatients}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                )}

                <div className={tableScroll}>
                    <table className={`w-full table-auto ${tableText}`}>
                    <thead
                        className={`${APP_NAV_MATCH_TABLE_THEAD} uppercase tracking-wide text-slate-200`}
                    >
                        <tr>
                            <th className={`${headCell} text-center`}>
                                {t("pages.workday.reviewSummary.table.auftrag")}
                            </th>
                            <th className={`${headCell} text-center`}>
                                {t("pages.workday.reviewSummary.table.patient")}
                            </th>
                            <th className={`${headCell} text-center`}>
                                {t("pages.workday.reviewSummary.table.pickup")}
                            </th>
                            <th className={`${headCell} text-center`}>
                                {t("pages.workday.reviewSummary.table.destination")}
                            </th>
                            <th className={`${headCell} text-center`}>
                                {t("pages.workday.reviewSummary.table.warning")}
                            </th>
                            <th className={`${headCell} text-center`}>
                                {t("pages.workday.reviewSummary.table.homeArrival")}
                            </th>
                            <th className={`${headCell} text-center`}>
                                {t("pages.workday.reviewSummary.table.kmStart")}
                            </th>
                            <th className={`${headCell} text-center`}>
                                {t("pages.workday.reviewSummary.table.pickupTime")}
                            </th>
                            <th className={`${headCell} text-center`}>
                                {t("pages.workday.reviewSummary.table.arrivalTime")}
                            </th>
                            <th className={`${headCell} text-center`}>
                                {t("pages.workday.reviewSummary.table.kmEnd")}
                            </th>
                            <th className={`${headCell} text-center`}>
                                {t("pages.workday.reviewSummary.table.timeEnd")}
                            </th>
                            <th className={`${headCell} text-center`}>
                                {t("pages.workday.reviewSummary.table.kmDiff")}
                            </th>
                            {showPraemieColumn && (
                                <th className={`${headCell} text-center`}>
                                    {t("pages.workday.reviewSummary.table.praemie")}
                                </th>
                            )}
                        </tr>
                    </thead>

                    <tbody>
                        {trips.map((tItem, i) => {
                            const diff = calcTripKm(tItem);
                            const mult = showPraemieColumn
                                ? getMultiplier(tItem, diff, weekendLate)
                                : 0;
                            const isStornoThatCounts =
                                showPraemieColumn &&
                                tItem.wasCancelled &&
                                tItem.countsTrip === 1;
                            const isStornoThatDoesNotCount =
                                showPraemieColumn &&
                                tItem.wasCancelled &&
                                tItem.countsTrip === 0;

                            return (
                                <React.Fragment key={i}>
                                    <tr
                                        className={`border-t border-slate-200 ${i % 2 === 1 ? zebraLight : zebraAlt}`}
                                    >
                                        {/* 4 primeras: izquierda */}
                                        <td
                                            className={`${cell} text-center font-semibold ${tItem.wasCancelled ? "text-rose-600" : "text-slate-800"}`}
                                        >
                                            {tItem.auftragNumber}
                                        </td>
                                        <td className={`${cell} text-center text-slate-700`}>
                                            {tItem.patientName ||
                                                t("pages.workday.reviewSummary.labels.noName")}
                                        </td>
                                        <td className={`${cell} text-center text-slate-700`}>
                                            {tItem.fromAddress}
                                        </td>
                                        <td className={`${cell} text-center text-slate-700`}>
                                            {tItem.toAddress}
                                        </td>

                                        {/* resto: centradas */}
                                        <td className={`${cell} text-center text-slate-700`}>
                                            {tItem.timeWarning}
                                        </td>
                                        <td className={`${cell} text-center text-slate-700`}>
                                            {tItem.timeAtHome}
                                        </td>
                                        <td className={`${cell} text-center text-slate-700`}>
                                            {tItem.kmStart}
                                        </td>
                                        <td className={`${cell} text-center text-slate-700`}>
                                            {tItem.timePickup}
                                        </td>
                                        <td className={`${cell} text-center text-slate-700`}>
                                            {tItem.timeArrival}
                                        </td>
                                        <td className={`${cell} text-center text-slate-700`}>
                                            {tItem.kmEnd}
                                        </td>
                                        <td className={`${cell} text-center text-slate-700`}>
                                            {tItem.timeEnd}
                                        </td>
                                        <td
                                            className={`${cell} text-center font-medium text-slate-800`}
                                        >
                                            {diff}
                                        </td>
                                        {showPraemieColumn && (
                                            <td className={`${cell} text-center font-bold`}>
                                                {isStornoThatDoesNotCount ? (
                                                    <span className="text-slate-500">0x</span>
                                                ) : isStornoThatCounts ? (
                                                    <span className="text-green-600">{mult}x</span>
                                                ) : (
                                                    <span className="text-slate-800">{mult}x</span>
                                                )}
                                            </td>
                                        )}
                                    </tr>

                                    {tItem.reports && tItem.reports.trim() !== "" && (
                                        <tr
                                            className={`${i % 2 === 1 ? "bg-slate-50" : "bg-slate-50/70"}`}
                                        >
                                            <td
                                                colSpan={tableColSpan}
                                                className={`px-3 ${dense ? "py-1 text-[10px]" : "py-2 text-[11px]"} text-slate-700 italic`}
                                            >
                                                {t("pages.workday.reviewSummary.labels.observations")}{" "}
                                                {tItem.reports}
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
                </div>
            </div>
        </div>
    );
};

export default ReviewSummary;
