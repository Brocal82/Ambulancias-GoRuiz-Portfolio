import type { Request, Response } from "express";
import { requireCompanyForAdmin } from "../../../utils/requireCompany";
import { getAdminDashboardCounts } from "../services/admin-dashboard-counts.service";

export async function getAdminDashboardCountsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const companyResult = requireCompanyForAdmin(req);
  if (!companyResult.ok) {
    res.status(companyResult.statusCode).json({ message: companyResult.message });
    return;
  }

  try {
    const counts = await getAdminDashboardCounts(companyResult.companyId);
    res.status(200).json(counts);
  } catch (error) {
    console.error("Error al obtener contadores del dashboard admin:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
}
