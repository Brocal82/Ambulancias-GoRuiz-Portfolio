import { RequestHandler } from "express";
import * as lifecycleService from "../services/lifecycle.service";
import {
  requireCompanyForAdmin,
  CompanyValidationError,
} from "../../../../utils/requireCompany";
import { DeleteWeekConflictError } from "../../utils/dienstWeekReferences";

export const deleteDienstsForWeek: RequestHandler = async (req, res) => {
  const companyResult = requireCompanyForAdmin(req);
  if (!companyResult.ok) {
    res.status(companyResult.statusCode).json({ message: companyResult.message });
    return;
  }

  const { weekStartDate } = req.body as { weekStartDate: string };

  try {
    const { deletedCount } = await lifecycleService.deleteDienstsForWeek(
      weekStartDate,
      companyResult.companyId,
    );
    res
      .status(200)
      .json({ message: "Diensts eliminados", count: deletedCount });
  } catch (error) {
    if (error instanceof DeleteWeekConflictError) {
      res.status(409).json({
        message: error.message,
        sources: error.sources,
        counts: error.counts,
      });
      return;
    }
    if (error instanceof CompanyValidationError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    console.error("Error al eliminar Diensts:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
