import { Request, Response } from "express";
import mongoose from "mongoose";
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

  const { status, adminOptionStartDate, adminOptionEndDate, adminNote } =
    req.body;
  const { forceRaw, force, isAdmin, canForceAccept } =
    parseVacationUpdateAuthorization(req, req.body);

  let acceptedRange: {
    userId: string;
    startISO: string;
    endISO: string;
  } | null = null;

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const request = await getVacationRequestForAdminUpdate(session, id);
      if (!request) {
        res.status(404).json({ message: "Solicitud no encontrada" });
        throw createVacationUpdateAbortError();
      }
      const userDoc = await User.findById(request.user)
        .select("companyId")
        .lean();
      const userCompanyId = userDoc ? (userDoc as { companyId?: unknown }).companyId : null;
      if (!isSameCompany(userCompanyId, companyResult.companyId)) {
        res.status(403).json({ message: "No tienes permiso para modificar esta solicitud" });
        throw createVacationUpdateAbortError();
      }

      if (status === "accepted" && !canForceAccept) {
        const maxPerDay = await getMaxPerDayForDate(new Date(request.startDate));

        const overDays = await checkVacationAcceptanceCapacity({
          request,
          maxPerDay,
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
          adminNote,
        });
      }

      await request.save({ session });

      if (request.status === "accepted") {
        acceptedRange = buildAcceptedVacationRange(request);
      }

      res.status(200).json(request);
    });

    if (acceptedRange) {
      try {
        await cleanupAcceptedVacationAssignments(acceptedRange);
      } catch (clearErr) {
        console.error(
          "⚠️ Error al desasignar usuario de Diensts tras aceptar vacaciones:",
          clearErr,
        );
      }
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
