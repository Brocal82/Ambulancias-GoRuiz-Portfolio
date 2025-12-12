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
  hideHeader?: boolean;   // oculta la cabecera (fecha, horas, equipo, km)
  dense?: boolean;        // activa modo compacto (menos alto)
}

const ReviewSummary: React.FC<Props> = ({
  assignedDay,
  ambulanceNumber,
  initialKm,
  finalKm,
  trips,
  hideHeader = false,
  dense = false,
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

  // 🔧 Clases condicionales para modo compacto
  const tableText = dense ? "text-[11px]" : "text-xs";
  const headCell = dense ? "px-1 py-1" : "px-2 py-2";
  const cell = dense ? "px-1 py-1" : "px-2 py-2";
  const zebraLight = dense ? "bg-slate-50/70" : "bg-slate-50/50";
  const zebraAlt = dense ? "bg-white" : "bg-white";
  const wrapContainer = dense
    ? "overflow-x-auto overflow-y-auto rounded-xl ring-1 ring-slate-200 bg-white max-h-64"
    : "overflow-x-auto rounded-xl ring-1 ring-slate-200 bg-white";

  return (
    <div className={dense ? "space-y-3" : "space-y-4"}>
      {/* -------- CABECERA -------- */}
{!hideHeader && (
  <div
    className={[
      "rounded-lg ring-1 ring-slate-200 bg-white",
      dense ? "p-2" : "p-3",
    ].join(" ")}
  >
    <div
      className={[
        "grid grid-cols-1 md:grid-cols-2",
        dense ? "gap-2 text-[12px]" : "gap-2 text-sm",
      ].join(" ")}
    >
      {/* Izquierda: fecha + horas + equipo compacto */}
      <div className={dense ? "space-y-0" : "space-y-0.5"}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-slate-800">
          <span className="font-semibold">
            📅 {formatYYYYMMDDToDDMMYYYY(assignedDay.date)}
          </span>
          <span className="text-slate-600">
            ⏰ {assignedDay.startTime} – {assignedDay.endTime}
          </span>
        </div>

        <div className="mt-1 grid grid-cols-1 gap-0 text-slate-700">
          <div className="truncate">{formatPerson(assignedDay.driver)}</div>
          <div className="truncate">{formatPerson(assignedDay.medic)}</div>
        </div>
      </div>

      {/* Derecha: ambulancia + km en una línea más compacta */}
      <div className={["md:text-right", dense ? "space-y-0" : "space-y-0.5"].join(" ")}>
        <div className="flex flex-wrap items-center justify-start gap-x-3 gap-y-0.5 md:justify-end">
          <span className="font-semibold">🚑 {ambulanceNumber}</span>
          <span className="text-slate-600">🔢 {initialKm} → {finalKm}</span>
          <span className="font-semibold">
            🧮 {t("pages.workday.reviewSummary.labels.totalKm", { km: totalKmDiff })}
          </span>
        </div>
      </div>
    </div>
  </div>
)}


      {/* -------- TABLA -------- */}
      <div className={wrapContainer}>
        <table className={`w-full table-auto ${tableText}`}>
          <thead className="bg-slate-50 text-slate-600 uppercase tracking-wide">
            <tr>
              <th className={`${headCell} text-center`}>{t("pages.workday.reviewSummary.table.auftrag")}</th>
              <th className={`${headCell} text-center`}>{t("pages.workday.reviewSummary.table.patient")}</th>
              <th className={`${headCell} text-center`}>{t("pages.workday.reviewSummary.table.pickup")}</th>
              <th className={`${headCell} text-center`}>{t("pages.workday.reviewSummary.table.destination")}</th>
              <th className={`${headCell} text-center`}>{t("pages.workday.reviewSummary.table.warning")}</th>
              <th className={`${headCell} text-center`}>{t("pages.workday.reviewSummary.table.homeArrival")}</th>
              <th className={`${headCell} text-center`}>{t("pages.workday.reviewSummary.table.kmStart")}</th>
              <th className={`${headCell} text-center`}>{t("pages.workday.reviewSummary.table.pickupTime")}</th>
              <th className={`${headCell} text-center`}>{t("pages.workday.reviewSummary.table.arrivalTime")}</th>
              <th className={`${headCell} text-center`}>{t("pages.workday.reviewSummary.table.kmEnd")}</th>
              <th className={`${headCell} text-center`}>{t("pages.workday.reviewSummary.table.timeEnd")}</th>
              <th className={`${headCell} text-center`}>{t("pages.workday.reviewSummary.table.kmDiff")}</th>
              <th className={`${headCell} text-center`}>{t("pages.workday.reviewSummary.table.praemie")}</th>
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
                  <tr className={`border-t border-slate-200 ${i % 2 === 1 ? zebraLight : zebraAlt}`}>
                    {/* 4 primeras: izquierda */}
                    <td className={`${cell} text-center font-semibold ${tItem.wasCancelled ? "text-rose-600" : "text-slate-800"}`}>
                      {tItem.auftragNumber}
                    </td>
                    <td className={`${cell} text-center text-slate-700`}>
                      {tItem.patientName || t("pages.workday.reviewSummary.labels.noName")}
                    </td>
                    <td className={`${cell} text-center text-slate-700`}>{tItem.fromAddress}</td>
                    <td className={`${cell} text-center text-slate-700`}>{tItem.toAddress}</td>

                    {/* resto: centradas */}
                    <td className={`${cell} text-center text-slate-700`}>{tItem.timeWarning}</td>
                    <td className={`${cell} text-center text-slate-700`}>{tItem.timeAtHome}</td>
                    <td className={`${cell} text-center text-slate-700`}>{tItem.kmStart}</td>
                    <td className={`${cell} text-center text-slate-700`}>{tItem.timePickup}</td>
                    <td className={`${cell} text-center text-slate-700`}>{tItem.timeArrival}</td>
                    <td className={`${cell} text-center text-slate-700`}>{tItem.kmEnd}</td>
                    <td className={`${cell} text-center text-slate-700`}>{tItem.timeEnd}</td>
                    <td className={`${cell} text-center font-medium text-slate-800`}>{diff}</td>
                    <td className={`${cell} text-center font-bold`}>
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
                      <td
                        colSpan={13}
                        className={`px-3 ${dense ? "py-1 text-[10px]" : "py-2 text-[11px]"} text-slate-700 italic`}
                      >
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
