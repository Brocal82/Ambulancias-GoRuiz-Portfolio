import { Request, Response } from "express";
import { saveMonthlyPraemieForUser } from "../services/save-monthly-praemie.service";

export const saveMonthlyPraemie = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }

    const result = await saveMonthlyPraemieForUser(
      userId,
      req.query.year,
      req.query.month,
    );

    if (!result.hasData) {
      res.status(200).json({ message: "No hay datos para ese mes" });
      return;
    }

    res
      .status(200)
      .json({ message: "Monthly pr\u00e4mie guardada", data: result.updated });
  } catch (error) {
    console.error("Error en saveMonthlyPraemie:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
