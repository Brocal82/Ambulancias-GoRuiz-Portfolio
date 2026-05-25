import { RequestHandler } from "express";
import * as lifecycleService from "../services/lifecycle.service";
import { requireCompanyForAdmin } from "../../../../utils/requireCompany";

export const generateDienstTemplatesForWeek: RequestHandler = async (
  req,
  res,
) => {
  const companyResult = requireCompanyForAdmin(req);
  if (!companyResult.ok) {
    res.status(companyResult.statusCode).json({ message: companyResult.message });
    return;
  }

  const { weekStartDate } = req.body as { weekStartDate: string };

  try {
    const { count, dienstSummaries } =
      await lifecycleService.generateDienstTemplatesForWeek(
        weekStartDate,
        companyResult.companyId,
      );

    res.status(201).json({
      message:
        "Diensts generados correctamente a partir de plantillas, con rotación de equipos aplicada (fijos, rotativos, vacaciones y bajas, respetando horarios por día si existen).",
      count,
      dienstSummaries,
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
