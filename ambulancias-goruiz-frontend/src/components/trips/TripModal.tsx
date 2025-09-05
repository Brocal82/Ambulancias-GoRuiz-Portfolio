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
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white rounded-lg p-6 shadow-lg max-w-md w-full relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-lg"
          aria-label={t("pages.components.tripModal.close")}
        >
          &times;
        </button>

        <h3 className="text-xl font-bold mb-4">
          {t("pages.components.tripModal.title")}
        </h3>

        <div className="space-y-2">
          <p>
            <strong>📝 {t("pages.components.tripModal.auftrag")}:</strong>{" "}
            {trip.auftragNumber}
          </p>
          <p>
            <strong>👤 {t("pages.components.tripModal.patient")}:</strong>{" "}
            {trip.patientName || t("pages.components.tripModal.noName")}
          </p>
          <p>
            <strong>📍 {t("pages.components.tripModal.from")}:</strong>{" "}
            {trip.fromAddress || t("pages.components.tripModal.noAddress")}
          </p>
          <p>
            <strong>🏥 {t("pages.components.tripModal.to")}:</strong>{" "}
            {trip.toAddress || t("pages.components.tripModal.noDestination")}
          </p>
          <p>
            <strong>⏱️ {t("pages.components.tripModal.time")}:</strong>{" "}
            {trip.timeWarning} - {trip.timeEnd}
          </p>
          <p>
            <strong>📏 {t("pages.components.tripModal.km")}:</strong>{" "}
            {trip.kmStart} → {trip.kmEnd} ({t("pages.components.tripModal.total")}{" "}
            {totalKm} km)
          </p>
          <p>
            <strong>📝 {t("pages.components.tripModal.reports")}:</strong>{" "}
            {trip.reports || t("pages.components.tripModal.noReports")}
          </p>

          {trip.wasCancelled && (
            <p className="text-red-600 font-semibold">
              ⚠️ {t("pages.components.tripModal.cancelled")}
              {trip.cancelledAtPickup &&
                " " + t("pages.components.tripModal.cancelledAtPickup")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TripModal;
