import { useEffect, useState } from "react";
import { checkTripLogic, type TripDraft } from "../utils";
import type { TripData } from "../domain/types/trip";

/**
 * Valida el borrador del viaje en tiempo real (horas en orden, km, Anschluss).
 * Devuelve error y campo problemático para feedback en el formulario.
 */
export const useTripDraftValidation = (
  tripFormData: TripData,
  wasCancelled: boolean,
  anschlussActive: boolean,
  previousTripFormData: TripData | null,
) => {
  const [draftError, setDraftError] = useState<string>("");
  const [badField, setBadField] = useState<keyof TripDraft | null>(null);

  useEffect(() => {
    const minKmStart =
      anschlussActive && previousTripFormData
        ? Number(previousTripFormData.kmStart)
        : undefined;

    const result = checkTripLogic(
      {
        timeWarning: tripFormData.timeWarning,
        timeAtHome: tripFormData.timeAtHome,
        timePickup: tripFormData.timePickup,
        timeArrival: tripFormData.timeArrival,
        timeEnd: tripFormData.timeEnd,
        kmStart: Number(tripFormData.kmStart),
        kmEnd: Number(tripFormData.kmEnd),
      },
      wasCancelled,
      minKmStart,
    );

    setDraftError(result.error || "");
    setBadField(result.badField);
  }, [tripFormData, wasCancelled, anschlussActive, previousTripFormData]);

  return { draftError, badField };
};
