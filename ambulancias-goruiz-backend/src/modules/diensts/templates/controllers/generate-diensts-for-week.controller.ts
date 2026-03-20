import { RequestHandler } from "express";
import * as lifecycleService from "../services/lifecycle.service";

export const generateDienstTemplatesForWeek: RequestHandler = async (
  req,
  res,
) => {
  const { weekStartDate } = req.body;

  if (!weekStartDate) {
    res.status(400).json({ message: "Fecha de inicio requerida" });
    return;
  }

  try {
    const startDate = new Date(weekStartDate);
    if (isNaN(startDate.getTime())) {
      res.status(400).json({ message: "Fecha de inicio inválida" });
      return;
    }

    const { count } = await lifecycleService.generateDienstTemplatesForWeek(weekStartDate);

    res.status(201).json({
      message:
        "Diensts generados correctamente a partir de plantillas, con rotación de equipos aplicada (fijos, rotativos, vacaciones y bajas, respetando horarios por día si existen).",
      count,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al generar Diensts";
    const status =
      message.includes("Ya existen") || message.includes("No hay plantillas")
        ? 400
        : 500;
    console.error("❌ Error al generar Diensts:", error);
    res.status(status).json({ message });
  }
};
