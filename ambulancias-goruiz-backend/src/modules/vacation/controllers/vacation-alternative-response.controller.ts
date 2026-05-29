import { Request, Response } from "express";
import { clearUserFromDienstsInRange } from "../../../utils/dienstClearUtils";
import {
  applyAlternativeResponseWorkflow,
  canRespondToAlternativeDate,
  checkAlternativeAcceptanceCapacity,
  getVacationRequestById,
  resolveVacationCompanyId,
  validateAlternativeResponseState,
} from "../services/vacation-alternative-response.service";
import { notifyCompanyAdminsModuleGated, WS_EVENTS } from "../../notifications";
import { MODULE_KEYS } from "../../companies/constants/modules.constants";

export const respondToAlternativeDate = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }
    const { id } = req.params;
    const { accept } = req.body;

    const request = await getVacationRequestById(id);
    if (!request) {
      res.status(404).json({ message: "Solicitud no encontrada" });
      return;
    }

    if (!canRespondToAlternativeDate(request, userId)) {
      res
        .status(403)
        .json({ message: "No autorizado para responder a esta solicitud" });
      return;
    }

    const stateValidation = validateAlternativeResponseState(request);
    if (!stateValidation.ok) {
      if (stateValidation.code === "invalid_status") {
        res.status(400).json({
          message:
            "Solo puedes responder cuando hay una propuesta alternativa pendiente",
        });
        return;
      }
      res.status(400).json({
        message: "La propuesta alternativa no tiene fechas v\u00E1lidas",
      });
      return;
    }

    if (accept) {
      const companyId = await resolveVacationCompanyId(request, req.companyId);
      if (!companyId) {
        res.status(400).json({ message: "No se pudo determinar la empresa" });
        return;
      }

      const overDays = await checkAlternativeAcceptanceCapacity({
        request,
        companyId,
      });
      if (overDays.length > 0) {
        res.status(409).json({
          code: "capacity_exceeded",
          message: "Capacidad diaria alcanzada para uno o m\u00E1s d\u00EDas del rango.",
          days: overDays,
        });
        return;
      }
    }

    const workflowResult = applyAlternativeResponseWorkflow(request, !!accept);
    const acceptedRange = workflowResult.acceptedRange;

    await request.save();

    if (acceptedRange) {
      try {
        await clearUserFromDienstsInRange(acceptedRange);
      } catch (err) {
        console.error("[CLEARING_ERROR]", {
          flow: "vacation_worker_alternative_accept",
          entityId: id,
          userId: acceptedRange.userId,
          startISO: acceptedRange.startISO,
          endISO: acceptedRange.endISO,
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        });
      }
    }

    const companyId = await resolveVacationCompanyId(request, req.companyId);
    if (companyId) {
      void notifyCompanyAdminsModuleGated(
        companyId,
        WS_EVENTS.VACATION_REQUEST_CHANGED,
        MODULE_KEYS.VACATION,
      );
    }

    res.status(200).json(request);
  } catch (error) {
    console.error("Error al responder a fecha alternativa:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
