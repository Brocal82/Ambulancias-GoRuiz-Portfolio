import { WorkdaySummaryError } from "../../../utils/assignmentClosure";

/** Upper bound for odometer readings (sanity check). */
export const MAX_ODOMETER_KM = 9_999_999;

export function validateClosureKm(initialKm: number, finalKm: number): void {
  if (!Number.isFinite(initialKm) || !Number.isFinite(finalKm)) {
    throw new WorkdaySummaryError("Kilómetros inválidos", 400);
  }
  if (initialKm < 0 || finalKm < 0) {
    throw new WorkdaySummaryError("Los kilómetros no pueden ser negativos", 400);
  }
  if (initialKm > MAX_ODOMETER_KM || finalKm > MAX_ODOMETER_KM) {
    throw new WorkdaySummaryError(
      "Los kilómetros están fuera del rango permitido",
      400,
    );
  }
  if (finalKm < initialKm) {
    throw new WorkdaySummaryError(
      "El km final no puede ser menor que el inicial",
      400,
    );
  }
}

export function validateTripKmPair(kmStart: number, kmEnd: number): void {
  if (!Number.isFinite(kmStart) || !Number.isFinite(kmEnd)) {
    throw new WorkdaySummaryError("Kilómetros de viaje inválidos", 400);
  }
  if (kmStart < 0 || kmEnd < 0) {
    throw new WorkdaySummaryError(
      "Los kilómetros de viaje no pueden ser negativos",
      400,
    );
  }
  if (kmStart > MAX_ODOMETER_KM || kmEnd > MAX_ODOMETER_KM) {
    throw new WorkdaySummaryError(
      "Los kilómetros de viaje están fuera del rango permitido",
      400,
    );
  }
  if (kmEnd < kmStart) {
    throw new WorkdaySummaryError(
      "El km final del viaje no puede ser menor que el inicial",
      400,
    );
  }
}
