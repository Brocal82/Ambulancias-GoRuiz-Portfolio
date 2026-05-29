import { Request, Response } from "express";
import {
  cancelOwnVacationRequest,
  createVacationRequestRecord,
  deleteOwnDeniedVacationRequest,
  deleteVacationRequestRecord,
} from "../services/vacation-requests-write.service";
import { requireCompanyForAdmin } from "../../../utils/requireCompany";
import { notifyCompanyAdminsModuleGated, WS_EVENTS } from "../../notifications";
import { MODULE_KEYS } from "../../companies/constants/modules.constants";

export const createVacationRequest = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }
    const { startDate, endDate } = req.body;

    const newRequest = await createVacationRequestRecord({
      userId,
      startDate,
      endDate,
      companyId: req.companyId,
    });
    if (newRequest.kind === "overlap") {
      res.status(409).json({
        message: "Ya tienes una solicitud de vacaciones en ese rango de fechas",
      });
      return;
    }

    if (req.companyId) {
      void notifyCompanyAdminsModuleGated(
        req.companyId,
        WS_EVENTS.VACATION_REQUEST_CHANGED,
        MODULE_KEYS.VACATION,
      );
    }

    res.status(201).json(newRequest.request);
  } catch (error) {
    console.error("Error al crear solicitud de vacaciones:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const cancelMyVacationRequest = async (req: any, res: any) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ message: "No autorizado" });
    }

    const result = await cancelOwnVacationRequest({ userId, id });

    if (result.kind === "not_found") {
      return res.status(404).json({ message: "Solicitud no encontrada" });
    }

    if (result.kind === "forbidden") {
      return res
        .status(403)
        .json({ message: "No puedes cancelar esta solicitud" });
    }

    if (result.kind === "invalid_status") {
      return res
        .status(400)
        .json({
          message:
            "Solo puedes cancelar solicitudes pendientes, con opción enviada o ya aceptadas",
        });
    }

    if (req.companyId) {
      void notifyCompanyAdminsModuleGated(
        req.companyId,
        WS_EVENTS.VACATION_REQUEST_CHANGED,
        MODULE_KEYS.VACATION,
      );
    }

    return res.status(200).json(result.request);
  } catch (err) {
    console.error("❌ cancelMyVacationRequest error:", err);
    return res.status(500).json({ message: "Error al cancelar la solicitud" });
  }
};

export const deleteVacationRequest = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const companyResult = requireCompanyForAdmin(req);
    if (!companyResult.ok) {
      res.status(companyResult.statusCode).json({ message: companyResult.message });
      return;
    }
    const { id } = req.params;
    const result = await deleteVacationRequestRecord(
      id,
      companyResult.companyId,
    );

    if (result.kind === "not_found") {
      res.status(404).json({ message: "Solicitud no encontrada" });
      return;
    }
    if (result.kind === "forbidden") {
      res.status(403).json({ message: "No tienes permiso para eliminar esta solicitud" });
      return;
    }

    res.status(200).json({ message: "Solicitud eliminada correctamente" });
  } catch (error) {
    console.error("Error al eliminar solicitud de vacaciones:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const removeMyDeniedVacationRequest = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    if (!userId) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }

    const result = await deleteOwnDeniedVacationRequest({ userId, id });
    if (result.kind === "not_found") {
      res.status(404).json({ message: "Solicitud no encontrada" });
      return;
    }
    if (result.kind === "forbidden") {
      res.status(403).json({ message: "No puedes eliminar esta solicitud" });
      return;
    }
    if (result.kind === "invalid_status") {
      res.status(400).json({ message: "Solo puedes eliminar solicitudes denegadas" });
      return;
    }

    res.status(200).json({ message: "Solicitud eliminada correctamente" });
  } catch (error) {
    console.error("Error al eliminar solicitud denegada del trabajador:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
