import { Request, Response } from "express";
import mongoose from "mongoose";
import {
  applyAdminVacationUpdateFields,
  buildAcceptedVacationRange,
  isVacationStatus,
  parseVacationUpdateAuthorization,
} from "./vacation-workflow.helpers";
import { getMaxPerDayForDate } from "./month-config.service";
import {
  checkVacationAcceptanceCapacity,
  cleanupAcceptedVacationAssignments,
  createVacationUpdateAbortError,
  getVacationRequestForAdminUpdate,
  isVacationUpdateAbortError,
} from "./vacation-update-request.service";

export const updateVacationRequest = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params;

  const { status, adminOptionStartDate, adminOptionEndDate, adminNote } =
    req.body;
  const { forceRaw, force, isAdmin, canForceAccept } =
    parseVacationUpdateAuthorization(req, req.body);

  console.log("FORCE DEBUG:", {
    id,
    status,
    forceRaw,
    force,
    isAdmin,
    role: req.user?.role,
    canForceAccept,
  });

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

      if (status === "accepted" && !canForceAccept) {
        const maxPerDay = await getMaxPerDayForDate(new Date(request.startDate));

        const overDays = await checkVacationAcceptanceCapacity({
          request,
          maxPerDay,
        });

        if (overDays.length > 0) {
          res.status(409).json({
            code: "capacity_exceeded",
            message:
              "Capacidad diaria alcanzada para uno o m\u00e1s d\u00edas del rango.",
            days: overDays,
          });
          throw createVacationUpdateAbortError();
        }
      }

      if (status === "accepted" && canForceAccept) {
        console.warn(
          `\u26a0\ufe0f Admin forz\u00f3 aceptaci\u00f3n por encima de capacidad. requestId=${id}`,
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
          res.status(400).json({ message: "Estado inv\u00e1lido" });
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
          "\u26a0\ufe0f Error al desasignar usuario de Diensts tras aceptar vacaciones:",
          clearErr,
        );
      }
    }
  } catch (err: any) {
    if (isVacationUpdateAbortError(err)) {
      return;
    }

    console.error("\u274c Error al actualizar solicitud de vacaciones:", err);
    if (!res.headersSent) {
      res.status(500).json({ message: "Error interno del servidor" });
    }
  } finally {
    session.endSession();
  }
};
