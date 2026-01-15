//src/components/vacation/UserVacationListItem.tsx
import React from "react";
import type { IVacationRequest } from "../../types/vacationRequest";
import { useTranslation } from "react-i18next";
import { getRequestRangeBerlin } from "../../utils/vacation/getRequestRangeBerlin";


type Props = {
  request: IVacationRequest;
  onAcceptAlternative: (id: string) => void;
  onRejectAlternative: (id: string) => void;
};

const UserVacationListItem: React.FC<Props> = ({
  request: req,
  onAcceptAlternative,
  onRejectAlternative,
}) => {
  const { t, i18n } = useTranslation();
  const locale =
    i18n.language === "de"
      ? "de-DE"
      : i18n.language === "en"
        ? "en-US"
        : "es-ES";

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, {
      timeZone: "Europe/Berlin",
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  const statusBadge = (status: IVacationRequest["status"]) => {
    const base =
      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";
    switch (status) {
      case "accepted":
        return (
          <span className={`${base} bg-green-100 text-green-700`}>
            {t("pages.vacations.listItem.status.accepted")}
          </span>
        );
      case "cancelled":
        return (
          <span className={`${base} bg-red-100 text-red-700`}>
            {t("pages.vacations.listItem.status.cancelled")}
          </span>
        );
      case "option_sent":
        return (
          <span className={`${base} bg-blue-100 text-blue-700`}>
            {t("pages.vacations.listItem.status.option_sent")}
          </span>
        );
      default:
        return (
          <span className={`${base} bg-yellow-100 text-yellow-700`}>
            {t("pages.vacations.listItem.status.pending")}
          </span>
        );
    }
  };

  return (
    <li className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="mt-0.5 text-sm grid grid-cols-[auto,1fr] gap-x-2">
            <span className="font-medium text-gray-700">
              {t("pages.vacations.listItem.requested")}
            </span>
            <span className="text-gray-600">
              {(() => {
                const { start, end } = getRequestRangeBerlin(req);
                return (
                  <>
                    {fmtDate(start.toISOString())} — {fmtDate(end.toISOString())}
                  </>
                );
              })()}

            </span>

            {req.adminOptionStartDate && req.adminOptionEndDate && (
              <>
                <span className="font-medium text-blue-700">
                  {t("pages.vacations.listItem.proposal")}
                </span>
                <span className="text-blue-700">
                  {fmtDate(req.adminOptionStartDate)} —{" "}
                  {fmtDate(req.adminOptionEndDate)}
                </span>
              </>
            )}
          </div>

          {req.adminNote && (
            <p className="mt-2 text-sm text-gray-600">
              <span className="font-medium">
                {t("pages.vacations.listItem.note")}
              </span>{" "}
              {req.adminNote}
            </p>
          )}
        </div>

        <div className="shrink-0">{statusBadge(req.status)}</div>
      </div>

      {req.status === "option_sent" && (
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            className="rounded bg-green-600 px-3 py-1 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            onClick={() => onAcceptAlternative(req._id)}
          >
            {t("pages.vacations.listItem.accept")}
          </button>
          <button
            className="rounded bg-red-600 px-3 py-1 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            onClick={() => onRejectAlternative(req._id)}
          >
            {t("pages.vacations.listItem.reject")}
          </button>
        </div>
      )}
    </li>
  );
};

export default UserVacationListItem;
