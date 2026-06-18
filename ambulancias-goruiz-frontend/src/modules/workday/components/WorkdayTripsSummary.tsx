// frontend/src/components/workday/WorkdayTripsSummary.tsx
import type { Trip } from "../domain/types/trip";
import type { AssignedDayFull } from "../../diensts";
import type { PraemienRuleConfig } from "../../praemien/domain/api";
import { getPraemienPreviewMultiplier } from "../../praemien/utils/praemienRulePreview";
import { useTranslation } from "react-i18next";

interface Props {
    trips: Trip[];
    assignedDay: AssignedDayFull;
    praemienRules?: PraemienRuleConfig | null;
    onOpenTrip: (trip: Trip) => void;

    vehicleConfirmed: boolean;
    isClosingDay: boolean;
    onCloseAndSend: () => void;

    isOpen: boolean;
    onToggleOpen: () => void;
}

const WorkdayTripsSummary = ({
    trips,
    assignedDay,
    praemienRules = null,
    onOpenTrip,
    vehicleConfirmed,
    isClosingDay,
    onCloseAndSend,
    isOpen,
    onToggleOpen,
}: Props) => {
    const { t } = useTranslation();

    return (
        <div className="mt-6">
            <div className="flex items-center justify-between gap-3">
                <button
                    type="button"
                    onClick={onToggleOpen}
                    className="relative inline-flex items-center justify-center rounded-xl p-3 bg-white hover:bg-slate-50 ring-1 ring-slate-200 transition"
                    title={t("pages.workday.tripSummary")}
                >
                    <span className="text-2xl" aria-hidden="true">
                        {isOpen ? "📂" : "📁"}
                    </span>

                    {trips.length > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[1.4rem] h-[1.4rem] flex items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold px-1 shadow">
                            {trips.length}
                        </span>
                    )}
                </button>

                {vehicleConfirmed && !isClosingDay && (
                    <button
                        type="button"
                        onClick={onCloseAndSend}
                        className="inline-flex items-center justify-center rounded-xl p-3 bg-white ring-1 ring-slate-200 hover:bg-slate-50 transition"
                        title={t("pages.workday.closeAndSend")}
                    >
                        <span className="text-xl" aria-hidden="true">
                            📤
                        </span>
                    </button>
                )}
            </div>

            {isOpen && (
                <div className="mt-3">
                    {trips.length === 0 ? (
                        <div className="rounded-lg bg-slate-50 text-slate-600 ring-1 ring-slate-200 p-3">
                            {t("pages.workday.noTripsYet") ?? "Aún no hay viajes guardados."}
                        </div>
                    ) : (
                        <ul className="space-y-2">
                            {trips.map((trip: Trip, idx: number) => {
                                const totalKm = trip.wasCancelled
                                    ? 0
                                    : typeof trip.totalKm === "number"
                                        ? trip.totalKm
                                        : trip.kmEnd - trip.kmStart;

                                const multiplier = getPraemienPreviewMultiplier({
                                    trip,
                                    dienstDate: assignedDay.date,
                                    dienstStartTime: assignedDay.startTime,
                                    rules: praemienRules,
                                });

                                return (
                                    <li
                                        key={trip._id || idx}
                                        onClick={() => onOpenTrip(trip)}
                                        className="bg-white p-3 rounded-xl shadow-sm ring-1 ring-slate-200 cursor-pointer hover:bg-blue-50"
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className="font-semibold">
                                                {trip.auftragNumber}
                                                {trip.wasCancelled && (
                                                    <span className="ml-2 text-red-600 font-medium">
                                                        {t("pages.workday.tripCancelledTag")}
                                                    </span>
                                                )}
                                            </span>

                                            <span>
                                                {totalKm} km
                                                <span className="ml-3 text-green-700 font-bold text-xl">
                                                    {multiplier}x
                                                </span>
                                            </span>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
};

export default WorkdayTripsSummary;
