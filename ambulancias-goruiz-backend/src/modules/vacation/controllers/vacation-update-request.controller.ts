import { Request, Response } from "express";
import mongoose from "mongoose";
import { sendPushNotification } from "../../notifications";
import {
  applyAdminVacationUpdateFields,
  buildAcceptedVacationRange,
  isVacationStatus,
  parseVacationUpdateAuthorization,
} from "../utils/vacation-workflow.helpers";
import { requireCompanyForAdmin, isSameCompany } from "../../../utils/requireCompany";
import User from "../../users/models/user.model";
import { getMaxPerDayForDate } from "../services/month-config.service";
import {
  checkVacationAcceptanceCapacity,
  cleanupAcceptedVacationAssignments,
  createVacationUpdateAbortError,
  getVacationRequestForAdminUpdate,
  isVacationUpdateAbortError,
} from "../services/vacation-update-request.service";

export const updateVacationRequest = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const companyResult = requireCompanyForAdmin(req);
  if (!companyResult.ok) {
    res.status(companyResult.statusCode).json({ message: companyResult.message });
    return;
  }

  const { id } = req.params;

  const {
    status,
    startDate,
    endDate,
    adminOptionStartDate,
    adminOptionEndDate,
    adminNote,
  } = req.body;
  const { forceRaw, force, isAdmin, canForceAccept } =
    parseVacationUpdateAuthorization(req, req.body);

  let acceptedRange: {
    userId: string;
    startISO: string;
    endISO: string;
  } | null | undefined = undefined;

  let vacationPush: { userId: string; status: string } | null | undefined = undefined;

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const request = await getVacationRequestForAdminUpdate(session, id);
      if (!request) {
        res.status(404).json({ message: "Solicitud no encontrada" });
        throw createVacationUpdateAbortError();
      }
      let matchUpdate: boolean;
      if (request.companyId) {
        // New record (Phase 1+): direct check, no extra DB query
        matchUpdate = String(request.companyId) === String(companyResult.companyId);
      } else {
        // Legacy record (companyId null): existing indirect check, unchanged
        const userDoc = await User.findById(request.user)
          .select("companyId")
          .lean();
        const userCompanyId = userDoc ? (userDoc as { companyId?: unknown }).companyId : null;
        matchUpdate = isSameCompany(userCompanyId, companyResult.companyId);
      }
      if (!matchUpdate) {
        res.status(403).json({ message: "No tienes permiso para modificar esta solicitud" });
        throw createVacationUpdateAbortError();
      }

      if (status === "accepted" && !canForceAccept) {
        const maxPerDay = await getMaxPerDayForDate(
          new Date(request.startDate),
          companyResult.companyId,
        );

        const overDays = await checkVacationAcceptanceCapacity({
          request,
          maxPerDay,
          companyId: companyResult.companyId,
        });

        if (overDays.length > 0) {
          res.status(409).json({
            code: "capacity_exceeded",
            message: "Capacidad diaria alcanzada para uno o más días del rango.",
            days: overDays,
          });
          throw createVacationUpdateAbortError();
        }
      }

      if (status === "accepted" && canForceAccept) {
        console.warn(
          `⚠️ Admin forzó aceptación por encima de capacidad. requestId=${id}`,
        );
      }

      if (typeof status !== "undefined") {
        if (isVacationStatus(status)) {
          applyAdminVacationUpdateFields(request, {
            status,
            startDate,
            endDate,
            adminOptionStartDate,
            adminOptionEndDate,
            adminNote,
          });
        } else {
          res.status(400).json({ message: "Estado inválido" });
          throw createVacationUpdateAbortError();
        }
      } else {
        applyAdminVacationUpdateFields(request, {
          adminOptionStartDate,
          adminOptionEndDate,
          startDate,
          endDate,
          adminNote,
        });
      }

      await request.save({ session });

      if (request.status === "accepted") {
        acceptedRange = buildAcceptedVacationRange(request);
      }

      const notifiableStatuses = ["accepted", "cancelled", "option_sent"];
      if (typeof status !== "undefined" && notifiableStatuses.includes(request.status)) {
        vacationPush = { userId: String(request.user), status: request.status };
      }

      res.status(200).json(request);
    });

    if (acceptedRange != null) {
      const range = acceptedRange as {
        userId: string;
        startISO: string;
        endISO: string;
      };

      try {
        await cleanupAcceptedVacationAssignments(range);
      } catch (clearErr) {
        console.error("[CLEARING_ERROR]", {
          flow: "vacation_admin_accept",
          entityId: id,
          userId: range.userId,
          startISO: range.startISO,
          endISO: range.endISO,
          error:
            clearErr instanceof Error ? clearErr.message : String(clearErr),
          stack: clearErr instanceof Error ? clearErr.stack : undefined,
        });
      }
    }

    if (vacationPush != null) {
      const push = vacationPush as { userId: string; status: string };
      const pushTitles: Record<string, string> = {
        accepted: "Vacaciones aceptadas",
        cancelled: "Vacaciones no aceptadas",
        option_sent: "Nueva propuesta de vacaciones",
      };
      const pushBodies: Record<string, string> = {
        accepted: "Tu solicitud de vacaciones ha sido aceptada.",
        cancelled: "Tu solicitud de vacaciones no ha podido ser aceptada.",
        option_sent: "El administrador te ha propuesto fechas alternativas.",
      };
      void sendPushNotification(
        [push.userId],
        pushTitles[push.status] ?? "Actualización de vacaciones",
        pushBodies[push.status] ?? "Tu solicitud de vacaciones ha sido actualizada.",
        { type: "vacation_updated", status: push.status, screen: "vacations" },
      );
    }
  } catch (err: any) {
    if (isVacationUpdateAbortError(err)) {
      return;
    }

    console.error("❌ Error al actualizar solicitud de vacaciones:", err);
    if (!res.headersSent) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  } finally {
    session.endSession();
  }
};
