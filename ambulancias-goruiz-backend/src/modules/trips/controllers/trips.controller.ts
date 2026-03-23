import { Request, Response } from "express";
import {
  TripError,
  createTrip as svcCreateTrip,
  getTripsByDate as svcGetTripsByDate,
} from "../services/trips.service";

function handleError(
  error: unknown,
  res: Response,
  fallbackMsg: string,
  logLabel: string,
): void {
  if (error instanceof TripError) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }
  console.error(logLabel, error);
  res.status(500).json({ message: fallbackMsg });
}

/* ─────────────────────────────
 * POST /api/trips
 * Admin: puede crear. Worker: solo si participa (driver/medic) en el assignment.
 * driver/medic se ignoran del body y se usan los del assignment en BD.
 * ───────────────────────────── */
export const createTrip = async (
  req: Request,
  res: Response,
): Promise<void> => {
  if (req.userRole === "worker" && !req.userId) {
    res.status(401).json({ message: "No autorizado" });
    return;
  }
  try {
    const savedTrip = await svcCreateTrip(
      req.body,
      req.userId ?? "",
      req.userRole ?? "",
    );
    res.status(201).json(savedTrip);
  } catch (error) {
    handleError(
      error,
      res,
      "Error interno del servidor",
      "❌ Error al crear el viaje:",
    );
  }
};

/* ─────────────────────────────
 * GET /api/trips/date/:date
 * Admin: todos los trips de la fecha. Worker: solo donde participa (driver/medic).
 * ───────────────────────────── */
export const getTripsByDate = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { date } = req.params;
    const trips = await svcGetTripsByDate(
      date,
      req.userId ?? undefined,
      req.userRole ?? undefined,
    );
    res.status(200).json(trips);
  } catch (error) {
    handleError(
      error,
      res,
      "Error al obtener viajes",
      "❌ Error al obtener viajes por fecha:",
    );
  }
};
