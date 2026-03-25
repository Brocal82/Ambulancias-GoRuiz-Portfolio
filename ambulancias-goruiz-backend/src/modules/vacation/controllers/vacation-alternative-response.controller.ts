import { Request, Response } from "express";
import { clearUserFromDienstsInRange } from "../../../utils/dienstClearUtils";
import {
  applyAlternativeResponseWorkflow,
  canRespondToAlternativeDate,
  getVacationRequestById,
} from "../services/vacation-alternative-response.service";

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

    res.status(200).json(request);
  } catch (error) {
    console.error("Error al responder a fecha alternativa:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
