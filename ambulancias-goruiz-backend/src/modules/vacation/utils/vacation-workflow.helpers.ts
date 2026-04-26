import { DateTime } from "luxon";
import { Request } from "express";
import type { IVacationRequestModel } from "../models/vacation-request.model";

const ZONE = "Europe/Berlin";

export type VacationStatus =
  | "pending"
  | "accepted"
  | "cancelled"
  | "option_sent"
  | "cancel_requested";

export function isVacationStatus(x: unknown): x is VacationStatus {
  return (
    x === "pending" ||
    x === "accepted" ||
    x === "cancelled" ||
    x === "option_sent" ||
    x === "cancel_requested"
  );
}

export function parseVacationUpdateAuthorization(
  req: Request,
  body: { force?: unknown; canForceAccept?: unknown },
) {
  const forceRaw = (req.query.force ?? body.force ?? body.canForceAccept) as
    | unknown;

  const force =
    forceRaw === true ||
    forceRaw === "true" ||
    forceRaw === 1 ||
    forceRaw === "1";

  const roleFromMiddleware = req.userRole;
  const roleFromReqUser = req.user?.role;
  const isAdmin = roleFromMiddleware === "admin" || roleFromReqUser === "admin";
  const canForceAccept = force && isAdmin;

  return {
    forceRaw,
    force,
    roleFromMiddleware,
    roleFromReqUser,
    isAdmin,
    canForceAccept,
  };
}

export function applyAdminVacationUpdateFields(
  request: IVacationRequestModel,
  fields: {
    status?: VacationStatus;
    startDate?: unknown;
    endDate?: unknown;
    adminOptionStartDate?: unknown;
    adminOptionEndDate?: unknown;
    adminNote?: unknown;
  },
) {
  const {
    status,
    startDate,
    endDate,
    adminOptionStartDate,
    adminOptionEndDate,
    adminNote,
  } = fields;

  if (typeof status !== "undefined") {
    request.status = status;
  }

  if (startDate) {
    request.startDate = new Date(startDate as string);
  }
  if (endDate) {
    request.endDate = new Date(endDate as string);
  }

  if (adminOptionStartDate) {
    request.adminOptionStartDate = new Date(adminOptionStartDate as string);
  }
  if (adminOptionEndDate) {
    request.adminOptionEndDate = new Date(adminOptionEndDate as string);
  }
  if (typeof adminNote === "string") {
    request.adminNote = adminNote;
  }
}

export function buildAcceptedVacationRange(request: {
  user: unknown;
  startDate: Date;
  endDate: Date;
}) {
  const userId = String(request.user);
  const startISO = DateTime.fromJSDate(request.startDate, {
    zone: ZONE,
  }).toISODate()!;
  const endISO = DateTime.fromJSDate(request.endDate, {
    zone: ZONE,
  }).toISODate()!;

  return { userId, startISO, endISO };
}

export function applyAlternativeDateResponse(
  request: IVacationRequestModel,
  accept: boolean,
) {
  if (accept) {
    if (request.adminOptionStartDate) {
      request.startDate = request.adminOptionStartDate;
    }
    if (request.adminOptionEndDate) {
      request.endDate = request.adminOptionEndDate;
    }
    request.status = "accepted";
    request.adminOptionStartDate = undefined;
    request.adminOptionEndDate = undefined;
    request.adminNote = undefined;

    return { acceptedRange: buildAcceptedVacationRange(request) };
  }

  request.status = "cancelled";
  request.adminOptionStartDate = undefined;
  request.adminOptionEndDate = undefined;
  request.adminNote = undefined;

  return { acceptedRange: null };
}
