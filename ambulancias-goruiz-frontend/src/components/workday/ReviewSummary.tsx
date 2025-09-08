// src/components/workday/ReviewSummary.tsx
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
  hideHeader?: boolean; // 👈 NUEVA PROP
}

const ReviewSummary: React.FC<Props> = ({
  assignedDay,
  ambulanceNumber,
  initialKm,
  finalKm,
  trips,
  hideHeader = false,
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
    {!hideHeader && (
      <div className="rounded-xl ring-1 ring-slate-200 p-4 bg-white">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="space-y-1">
            <p>
              📅 <strong>{formatYYYYMMDDToDDMMYYYY(assignedDay.date)}</strong>
            </p>
            <p>
              ⏰ {assignedDay.startTime} – {assignedDay.endTime}
            </p>

            <div className="pt-1">
              <p className="font-semibold">
                {t("pages.workday.reviewSummary.labels.team")}
              </p>
              <div className="ml-1 mt-1 grid grid-cols-1 gap-0.5 text-slate-700">
                <p>{formatPerson(assignedDay.driver)}</p>
                <p>{formatPerson(assignedDay.medic)}</p>
              </div>
            </div>
          </div>

          <div className="md:text-right space-y-1">
            <p>
              🚑 <strong>{ambulanceNumber}</strong>
            </p>
            <p>
              🔢 {initialKm} → {finalKm}
            </p>
            <p className="font-semibold">
              🧮{" "}
              {t("pages.workday.reviewSummary.labels.totalKm", {
                km: totalKmDiff,
              })}
            </p>
          </div>
        </div>
      </div>
    )}

    {/* -------- TABLA -------- */}
<div className="overflow-x-auto rounded-xl ring-1 ring-slate-200 bg-white">
  <table className="w-full table-auto text-xs">
  <thead className="bg-slate-50 text-slate-600 uppercase tracking-wide">
    <tr>
      <th className="px-1 py-2 text-left">{t("pages.workday.reviewSummary.table.auftrag")}</th>
      <th className="px-1 py-2 text-left">{t("pages.workday.reviewSummary.table.patient")}</th>
      <th className="px-1 py-2 text-left">{t("pages.workday.reviewSummary.table.pickup")}</th>
      <th className="px-1 py-2 text-left">{t("pages.workday.reviewSummary.table.destination")}</th>
      <th className="px-2 py-2 text-center">{t("pages.workday.reviewSummary.table.warning")}</th>
      <th className="px-2 py-2 text-center">{t("pages.workday.reviewSummary.table.homeArrival")}</th>
      <th className="px-2 py-2 text-center">{t("pages.workday.reviewSummary.table.kmStart")}</th>
      <th className="px-2 py-2 text-center">{t("pages.workday.reviewSummary.table.pickupTime")}</th>
      <th className="px-2 py-2 text-center">{t("pages.workday.reviewSummary.table.arrivalTime")}</th>
      <th className="px-2 py-2 text-center">{t("pages.workday.reviewSummary.table.kmEnd")}</th>
      <th className="px-2 py-2 text-center">{t("pages.workday.reviewSummary.table.timeEnd")}</th>
      <th className="px-2 py-2 text-center">{t("pages.workday.reviewSummary.table.kmDiff")}</th>
      <th className="px-2 py-2 text-center">{t("pages.workday.reviewSummary.table.praemie")}</th>
    </tr>
  </thead>

    <tbody>
      {trips.map((tItem, i) => {
        const diff = calcTripKm(tItem);
        const mult = getMultiplier(tItem, diff, weekendLate);
        const isStornoThatCounts = tItem.wasCancelled && tItem.countsTrip === 1;
        const isStornoThatDoesNotCount = tItem.wasCancelled && tItem.countsTrip === 0;

        return (
          <React.Fragment key={i}>
            <tr className={`border-t border-slate-200 ${i % 2 === 1 ? "bg-slate-50/50" : "bg-white"}`}>
              {/* 4 primeras: izquierda (igual que thead) */}
              <td className={`px-2 py-2 text-left font-semibold ${tItem.wasCancelled ? "text-rose-600" : "text-slate-800"}`}>
                {tItem.auftragNumber}
              </td>
              <td className="px-2 py-2 text-left text-slate-700">
                {tItem.patientName || t("pages.workday.reviewSummary.labels.noName")}
              </td>
              <td className="px-2 py-2 text-left text-slate-700">{tItem.fromAddress}</td>
              <td className="px-2 py-2 text-left text-slate-700">{tItem.toAddress}</td>

              {/* resto: centradas (igual que thead) */}
              <td className="px-2 py-2 text-center text-slate-700">{tItem.timeWarning}</td>
              <td className="px-2 py-2 text-center text-slate-700">{tItem.timeAtHome}</td>
              <td className="px-2 py-2 text-center text-slate-700">{tItem.kmStart}</td>
              <td className="px-2 py-2 text-center text-slate-700">{tItem.timePickup}</td>
              <td className="px-2 py-2 text-center text-slate-700">{tItem.timeArrival}</td>
              <td className="px-2 py-2 text-center text-slate-700">{tItem.kmEnd}</td>
              <td className="px-2 py-2 text-center text-slate-700">{tItem.timeEnd}</td>
              <td className="px-2 py-2 text-center font-medium text-slate-800">{diff}</td>
              <td className="px-2 py-2 text-center font-bold">
                {isStornoThatDoesNotCount ? (
                  <span className="text-slate-500">0x</span>
                ) : isStornoThatCounts ? (
                  <span className="text-green-600">{mult}x</span>
                ) : (
                  <span className="text-slate-800">{mult}x</span>
                )}
              </td>
            </tr>

            {tItem.reports && tItem.reports.trim() !== "" && (
              <tr className={`${i % 2 === 1 ? "bg-slate-50" : "bg-slate-50/70"}`}>
                <td colSpan={13} className="px-3 py-2 text-[11px] text-slate-700 italic">
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
