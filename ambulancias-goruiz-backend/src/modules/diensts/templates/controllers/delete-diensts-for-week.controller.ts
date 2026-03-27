import { RequestHandler } from "express";
import * as lifecycleService from "../services/lifecycle.service";
import { requireCompanyForAdmin } from "../../../../utils/requireCompany";

export const deleteDienstsForWeek: RequestHandler = async (req, res) => {
  const companyResult = requireCompanyForAdmin(req);
  if (!companyResult.ok) {
    res.status(companyResult.statusCode).json({ message: companyResult.message });
    return;
  }

  const { weekStartDate } = req.body;

  if (!weekStartDate) {
    res.status(400).json({ message: "Fecha de inicio requerida" });
    return;
  }

  try {
    const { deletedCount } = await lifecycleService.deleteDienstsForWeek(
      weekStartDate,
      companyResult.companyId,
    );
    res
      .status(200)
      .json({ message: "Diensts eliminados", count: deletedCount });
  } catch (error) {
    console.error("Error al eliminar Diensts:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
