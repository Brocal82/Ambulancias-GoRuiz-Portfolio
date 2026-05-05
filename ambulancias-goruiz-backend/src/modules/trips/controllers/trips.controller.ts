import { Request, Response } from "express";
import mongoose from "mongoose";
import {
  TripError,
  createTrip as svcCreateTrip,
  getTripsByDate as svcGetTripsByDate,
  getTripSetup as svcGetTripSetup,
  upsertTripSetup as svcUpsertTripSetup,
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
 * Admin: puede crear si dienst misma empresa. Worker: solo si participa.
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
      req.companyId ?? null,
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
 * Admin: trips filtrados por empresa si tiene companyId. Worker: donde participa.
 * ───────────────────────────── */
export const getTripsByDate = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { date } = req.params;
    const rawCompanyId =
      typeof req.companyId === "string" ? req.companyId.trim() : "";
    if (!rawCompanyId || !mongoose.Types.ObjectId.isValid(rawCompanyId)) {
      res.status(403).json({
        message: "No tienes permiso. Se requiere un contexto de empresa válido.",
      });
      return;
    }
    const trips = await svcGetTripsByDate(
      date,
      req.userId ?? undefined,
      req.userRole ?? undefined,
      rawCompanyId,
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

export const upsertTripSetup = async (req: Request, res: Response): Promise<void> => {
  if (req.userRole === "worker" && !req.userId) {
    res.status(401).json({ message: "No autorizado" });
    return;
  }
  try {
    const saved = await svcUpsertTripSetup(
      req.params.assignmentId,
      req.body as { ambulanceId?: string; ambulanceNumber: string; initialKm: number },
      req.userId ?? "",
      req.userRole ?? "",
      req.companyId ?? null,
    );
    res.status(200).json(saved);
  } catch (error) {
    handleError(
      error,
      res,
      "Error al guardar configuración de jornada",
      "❌ Error al guardar trip setup:",
    );
  }
};

export const getTripSetup = async (req: Request, res: Response): Promise<void> => {
  if (req.userRole === "worker" && !req.userId) {
    res.status(401).json({ message: "No autorizado" });
    return;
  }
  try {
    const setup = await svcGetTripSetup(
      req.params.assignmentId,
      req.userId ?? "",
      req.userRole ?? "",
      req.companyId ?? null,
    );
    if (!setup) {
      res.status(200).json(null);
      return;
    }
    res.status(200).json(setup);
  } catch (error) {
    handleError(
      error,
      res,
      "Error al obtener configuración de jornada",
      "❌ Error al obtener trip setup:",
    );
  }
};
