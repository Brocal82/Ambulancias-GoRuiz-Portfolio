import React from "react";
import type { Trip } from "../../types/trip";
import type { AssignedDayFull } from "../../types/dienst";
import { formatYYYYMMDDToDDMMYYYY } from "../../utils/timeUtils";
import { useTranslation } from "react-i18next";

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
}

const ReviewSummary: React.FC<Props> = ({
  assignedDay,
  ambulanceNumber,
  initialKm,
  finalKm,
  trips,
}) => {
  const { t } = useTranslation();

  const weekendLate =
    [0, 6].includes(new Date(assignedDay.date).getDay()) &&
    (() => {
      const h = Number(assignedDay.startTime.split(":")[0] ?? 0);
      return h >= 14 && h <= 17;
    })();

  const totalKmDiff = Math.max(0, finalKm - initialKm);

  const formatPerson = (p: any): string => {
    if (!p) return t("pages.workday.reviewSummary.labels.deletedUser");
    if (typeof p === "string") return p;
    const last = p?.lastName ?? "";
    const first = p?.name ?? "";
    const full = [last, first].filter(Boolean).join(", ");
    return full || t("pages.workday.reviewSummary.labels.deletedUser");
  };

  return (
    <div className="space-y-4">
      {/* -------- CABECERA -------- */}
      <div className="flex justify-between text-sm">
        <div>
          <p>
            📅 <strong>{formatYYYYMMDDToDDMMYYYY(assignedDay.date)}</strong>
          </p>
          <p>⏰ {assignedDay.startTime} – {assignedDay.endTime}</p>

          <div>
            <p className="font-semibold">
              {t("pages.workday.reviewSummary.labels.team")}
            </p>
            <div className="ml-2 space-y-1">
              <p>{formatPerson(assignedDay.driver)}</p>
              <p>{formatPerson(assignedDay.medic)}</p>
            </div>
          </div>
        </div>

        <div className="text-right">
          <p>🚑 <strong>{ambulanceNumber}</strong></p>
          <p>🔢 {initialKm} → {finalKm}</p>
          <p className="font-semibold">🧮 {t("pages.workday.reviewSummary.labels.totalKm", { km: totalKmDiff })}</p>
        </div>
      </div>

      {/* -------- TABLA -------- */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-1">{t("pages.workday.reviewSummary.table.auftrag")}</th>
              <th>{t("pages.workday.reviewSummary.table.patient")}</th>
              <th>{t("pages.workday.reviewSummary.table.pickup")}</th>
              <th>{t("pages.workday.reviewSummary.table.destination")}</th>
              <th>{t("pages.workday.reviewSummary.table.warning")}</th>
              <th>{t("pages.workday.reviewSummary.table.homeArrival")}</th>
              <th>{t("pages.workday.reviewSummary.table.kmStart")}</th>
              <th>{t("pages.workday.reviewSummary.table.pickupTime")}</th>
              <th>{t("pages.workday.reviewSummary.table.arrivalTime")}</th>
              <th>{t("pages.workday.reviewSummary.table.kmEnd")}</th>
              <th>{t("pages.workday.reviewSummary.table.timeEnd")}</th>
              <th>{t("pages.workday.reviewSummary.table.kmDiff")}</th>
              <th>{t("pages.workday.reviewSummary.table.praemie")}</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {trips.map((tItem, i) => {
              const diff = calcTripKm(tItem);
              const mult = getMultiplier(tItem, diff, weekendLate);
              const isStornoThatCounts = tItem.wasCancelled && tItem.countsTrip === 1;
              const isStornoThatDoesNotCount = tItem.wasCancelled && tItem.countsTrip === 0;

              return (
                <React.Fragment key={i}>
                  <tr className="border-t">
                    <td className={`p-1 text-center font-semibold ${tItem.wasCancelled ? "text-red-600" : ""}`}>
                      {tItem.auftragNumber}
                    </td>
                    <td className="text-center">
                      {tItem.patientName || t("pages.workday.reviewSummary.labels.noName")}
                    </td>
                    <td className="text-center">{tItem.fromAddress}</td>
                    <td className="text-center">{tItem.toAddress}</td>
                    <td className="text-center">{tItem.timeWarning}</td>
                    <td className="text-center">{tItem.timeAtHome}</td>
                    <td className="text-center">{tItem.kmStart}</td>
                    <td className="text-center">{tItem.timePickup}</td>
                    <td className="text-center">{tItem.timeArrival}</td>
                    <td className="text-center">{tItem.kmEnd}</td>
                    <td className="text-center">{tItem.timeEnd}</td>
                    <td className="text-center">{diff}</td>
                    <td className="text-center font-bold">
                      {isStornoThatDoesNotCount ? (
                        "0x"
                      ) : isStornoThatCounts ? (
                        <span className="text-green-600">{mult}x</span>
                      ) : (
                        `${mult}x`
                      )}
                    </td>
                  </tr>

                  {tItem.reports && tItem.reports.trim() !== "" && (
                    <tr className="text-[11px] text-gray-700 bg-gray-50">
                      <td colSpan={13} className="italic px-2 py-1">
                        {t("pages.workday.reviewSummary.labels.observations")} {tItem.reports}
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
  );
};

export default ReviewSummary;
