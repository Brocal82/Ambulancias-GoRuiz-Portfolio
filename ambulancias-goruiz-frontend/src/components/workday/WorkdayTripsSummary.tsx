// frontend/src/components/workday/WorkdayTripsSummary.tsx
import React from "react";
import type { Trip } from "../../types/trip";
import type { AssignedDayFull } from "../../modules/diensts";
import { useTranslation } from "react-i18next";

interface Props {
    trips: Trip[];
    assignedDay: AssignedDayFull;
    onOpenTrip: (trip: Trip) => void;

    vehicleConfirmed: boolean;
    isClosingDay: boolean;
    onCloseAndSend: () => void;
}

const WorkdayTripsSummary: React.FC<Props> = ({
    trips,
    assignedDay,
    onOpenTrip,
    vehicleConfirmed,
    isClosingDay,
    onCloseAndSend,
}) => {
    const { t } = useTranslation();

    return (
        <>
            <h3 className="text-xl font-semibold mt-6">
                {t("pages.workday.tripSummary")}
            </h3>

            <ul className="mt-2 space-y-2">
                {trips.map((trip: Trip, idx: number) => {
                    const totalKm = trip.wasCancelled
                        ? 0
                        : typeof trip.totalKm === "number"
                            ? trip.totalKm
                            : trip.kmEnd - trip.kmStart;

                    const isWeekendAfternoonShift = () => {
                        const day = new Date(assignedDay.date).getDay();
                        if (day !== 0 && day !== 6) return false;
                        const [h] = assignedDay.startTime.split(":").map(Number);
                        return h >= 14 && h <= 17;
                    };

                    const getMultiplier = () => {
                        if (trip.countsTrip === 0) return 0;
                        if (totalKm >= 20) return 2;
                        if (totalKm >= 15) return 1.5;
                        if (isWeekendAfternoonShift()) return 1.5;
                        return 1;
                    };

                    const multiplier = getMultiplier();

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

            {vehicleConfirmed && !isClosingDay && (
                <button
                    onClick={onCloseAndSend}
                    className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg"
                >
                    {t("pages.workday.closeAndSend")}
                </button>
            )}
        </>
    );
};

export default WorkdayTripsSummary;