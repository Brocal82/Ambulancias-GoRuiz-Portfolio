import { Request, Response } from "express";
import { getVacationAvailability } from "./vacation-availability.service";

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

    const availability = await getVacationAvailability({ year, month });
    res.status(200).json(availability);
  } catch (error) {
    console.error("Error al calcular disponibilidad:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
