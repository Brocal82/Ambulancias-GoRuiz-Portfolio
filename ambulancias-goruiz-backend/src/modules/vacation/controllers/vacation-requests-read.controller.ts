import { Request, Response } from "express";
import {
  countVacationRequestsByStatus,
  getAllVacationRequests,
  getVacationRequestsForUser,
} from "../services/vacation-requests-read.service";
import { requireCompanyForAdmin } from "../../../utils/requireCompany";

export const getVacationRequests = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const companyResult = requireCompanyForAdmin(req);
    if (!companyResult.ok) {
      res.status(companyResult.statusCode).json({ message: companyResult.message });
      return;
    }
    const requests = await getAllVacationRequests(companyResult.companyId);
    res.status(200).json(requests);
  } catch (error) {
    console.error("Error al obtener solicitudes de vacaciones:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const getUserVacationRequests = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }
    const requests = await getVacationRequestsForUser(userId);
    res.status(200).json(requests);
  } catch (error) {
    console.error("Error al obtener solicitudes del usuario:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const getVacationPendingCount = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const companyResult = requireCompanyForAdmin(req);
    if (!companyResult.ok) {
      res.status(companyResult.statusCode).json({ message: companyResult.message });
      return;
    }
    const rawStatus =
      typeof req.query.status === "string" ? req.query.status : "pending";
    const status = rawStatus.toLowerCase();

    const count = await countVacationRequestsByStatus(
      status,
      companyResult.companyId,
    );
    res.status(200).json({ count });
  } catch (error) {
    console.error("Error al contar solicitudes de vacaciones:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
