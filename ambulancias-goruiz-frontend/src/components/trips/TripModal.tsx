// frontend/src/components/trips/TripModal.tsx
import React from "react";
import type { Trip } from "../../types/trip";
import { useTranslation } from "react-i18next";

interface TripModalProps {
  trip: Trip | null;
  onClose: () => void;
}

const TripModal: React.FC<TripModalProps> = ({ trip, onClose }) => {
  const { t } = useTranslation();
  if (!trip) return null;

  const totalKm = trip.wasCancelled
    ? 0
    : typeof trip.totalKm === "number"
      ? trip.totalKm
      : trip.kmEnd - trip.kmStart;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:items-center">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="trip-modal-title"
        className="relative z-10 w-full max-w-md rounded-2xl bg-white p-5 shadow-lg ring-1 ring-slate-200"
      >
        {/* Close */}
        <button
          onClick={onClose}
          aria-label={t("pages.components.tripModal.close")}
          className="absolute right-2.5 top-2.5 inline-flex h-9 w-9 items-center justify-center rounded-full
                     text-slate-600 hover:bg-slate-100 hover:text-slate-800 focus:outline-none
                     focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        >
          <span aria-hidden>✕</span>
        </button>

        {/* Title */}
        <h3
          id="trip-modal-title"
          className="pr-10 text-lg font-semibold text-slate-900"
        >
          {t("pages.components.tripModal.title")}
        </h3>

        {/* Content */}
        <div className="mt-4 space-y-2 text-sm">
          <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200 space-y-1">
            <p className="flex gap-2">
              <span className="font-medium text-slate-700">
                📝 {t("pages.components.tripModal.auftrag")}:
              </span>
              <span className="text-slate-800">{trip.auftragNumber}</span>
            </p>

            <p className="flex gap-2">
              <span className="font-medium text-slate-700">
                👤 {t("pages.components.tripModal.patient")}:
              </span>
              <span className="text-slate-800">
                {trip.patientName || t("pages.components.tripModal.noName")}
              </span>
            </p>

            <p className="flex gap-2">
              <span className="font-medium text-slate-700">
                📍 {t("pages.components.tripModal.from")}:
              </span>
              <span className="text-slate-800">
                {trip.fromAddress || t("pages.components.tripModal.noAddress")}
              </span>
            </p>

            <p className="flex gap-2">
              <span className="font-medium text-slate-700">
                🏥 {t("pages.components.tripModal.to")}:
              </span>
              <span className="text-slate-800">
                {trip.toAddress ||
                  t("pages.components.tripModal.noDestination")}
              </span>
            </p>

            <p className="flex gap-2">
              <span className="font-medium text-slate-700">
                ⏱️ {t("pages.components.tripModal.time")}:
              </span>
              <span className="text-slate-800 font-mono">
                {trip.timeWarning} — {trip.timeEnd}
              </span>
            </p>

            <p className="flex gap-2">
              <span className="font-medium text-slate-700">
                📏 {t("pages.components.tripModal.km")}:
              </span>
              <span className="text-slate-800">
                <span className="font-mono">{trip.kmStart}</span> →
                <span className="font-mono"> {trip.kmEnd}</span>
                <span className="ml-2 text-slate-600">
                  ({t("pages.components.tripModal.total")}{" "}
                  <span className="font-mono">{totalKm}</span> km)
                </span>
              </span>
            </p>
          </div>

          <div className="rounded-xl p-3 ring-1 ring-slate-200">
            <p className="font-medium text-slate-700">
              📝 {t("pages.components.tripModal.reports")}:
            </p>
            <p className="mt-1 whitespace-pre-line text-slate-800">
              {trip.reports || t("pages.components.tripModal.noReports")}
            </p>
          </div>

          {trip.wasCancelled && (
            <div className="rounded-lg bg-rose-50 px-3 py-2 text-rose-700 ring-1 ring-rose-200">
              <span className="font-semibold">
                ⚠️ {t("pages.components.tripModal.cancelled")}
              </span>
              {trip.cancelledAtPickup && (
                <span className="ml-1">
                  {t("pages.components.tripModal.cancelledAtPickup")}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            {t("pages.components.tripModal.close")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TripModal;
