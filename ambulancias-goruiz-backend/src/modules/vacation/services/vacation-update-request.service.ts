import mongoose from "mongoose";
import VacationRequest from "../models/vacation-request.model";
import { findOverCapacityDays } from "../utils/vacation-capacity";
import { clearUserFromDienstsInRange } from "../../../utils/dienstClearUtils";

export const VACATION_UPDATE_ABORT = "__ABORT__";

export function createVacationUpdateAbortError() {
  return new Error(VACATION_UPDATE_ABORT);
}

export function isVacationUpdateAbortError(err: unknown) {
  return err instanceof Error && err.message === VACATION_UPDATE_ABORT;
}

export async function getVacationRequestForAdminUpdate(
  session: mongoose.ClientSession,
  id: string,
) {
  return VacationRequest.findById(id).session(session);
}

export async function checkVacationAcceptanceCapacity(params: {
  request: {
    startDate: Date;
    endDate: Date;
    _id: { toString(): string };
  };
  maxPerDay: number;
  companyId: string;
}) {
  const { request, maxPerDay, companyId } = params;

  return findOverCapacityDays(
    VacationRequest,
    request.startDate,
    request.endDate,
    maxPerDay,
    companyId,
    request._id.toString(),
  );
}

export async function cleanupAcceptedVacationAssignments(range: {
  userId: string;
  startISO: string;
  endISO: string;
}) {
  return clearUserFromDienstsInRange(range);
}
