import { Request, Response } from "express";
import mongoose from "mongoose";
import { getVacationAvailability } from "../services/vacation-availability.service";

export const getAvailability = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const year = Number(req.query.year);
    const month = Number(req.query.month);

    if (!year || !month || month < 1 || month > 12) {
      res
        .status(400)
        .json({
          message: "Parámetros inválidos: year y month (1..12) son requeridos",
        });
      return;
    }

    const rawCompanyId =
      typeof req.companyId === "string" ? req.companyId.trim() : "";
    if (!rawCompanyId || !mongoose.Types.ObjectId.isValid(rawCompanyId)) {
      res.status(403).json({
        message:
          "No tienes permiso. Se requiere un contexto de empresa válido para consultar la disponibilidad.",
      });
      return;
    }

    const availability = await getVacationAvailability({
      year,
      month,
      companyId: rawCompanyId,
    });
    res.status(200).json(availability);
  } catch (error) {
    console.error("Error al calcular disponibilidad:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
