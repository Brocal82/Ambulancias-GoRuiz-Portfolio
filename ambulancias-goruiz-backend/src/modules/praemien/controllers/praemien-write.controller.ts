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

    if ("skippedManualMode" in result && result.skippedManualMode) {
      res.status(200).json({
        message:
          "En modo manual efectivo los cierres mensuales se generan automáticamente desde las entradas aprobadas.",
      });
      return;
    }

    if (!result.hasData) {
      res.status(200).json({ message: "No hay datos para ese mes" });
      return;
    }

    res
      .status(200)
      .json({ message: "Monthly pr\u00e4mie guardada", data: result.updated });
  } catch (error) {
    const msg = String((error as Error)?.message ?? "");
    if (msg.includes("no está asociado a una empresa")) {
      res.status(403).json({ message: msg });
      return;
    }
    console.error("Error en saveMonthlyPraemie:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
