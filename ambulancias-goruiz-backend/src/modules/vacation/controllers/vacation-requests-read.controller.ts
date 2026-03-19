import { Request, Response } from "express";
import {
  countVacationRequestsByStatus,
  getAllVacationRequests,
  getVacationRequestsForUser,
} from "../services/vacation-requests-read.service";

export const getVacationRequests = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  try {
    const requests = await getAllVacationRequests();
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
    const rawStatus =
      typeof req.query.status === "string" ? req.query.status : "pending";
    const status = rawStatus.toLowerCase();

    const count = await countVacationRequestsByStatus(status);
    res.status(200).json({ count });
  } catch (error) {
    console.error("Error al contar solicitudes de vacaciones:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
