import type { IVacationRequestModel } from "../models/vacation-request.model";
import VacationRequest from "../models/vacation-request.model";
import User from "../../users/models/user.model";
import { applyAlternativeDateResponse } from "../utils/vacation-workflow.helpers";
import { findOverCapacityDays } from "../utils/vacation-capacity";
import { getMaxPerDayForDate } from "./month-config.service";

export async function getVacationRequestById(id: string) {
  return (await VacationRequest.findById(id)) as IVacationRequestModel | null;
}

export function canRespondToAlternativeDate(
  request: IVacationRequestModel,
  userId: string,
) {
  return request.user.toString() === userId;
}

export type AlternativeResponseValidation =
  | { ok: true }
  | { ok: false; code: "invalid_status" | "missing_dates" };

export function validateAlternativeResponseState(
  request: IVacationRequestModel,
): AlternativeResponseValidation {
  if (request.status !== "option_sent") {
    return { ok: false, code: "invalid_status" };
  }
  if (!request.adminOptionStartDate || !request.adminOptionEndDate) {
    return { ok: false, code: "missing_dates" };
  }
  return { ok: true };
}

export async function resolveVacationCompanyId(
  request: IVacationRequestModel,
  fallbackCompanyId?: string | null,
): Promise<string | null> {
  if (request.companyId) {
    return String(request.companyId);
  }
  if (fallbackCompanyId) {
    return fallbackCompanyId;
  }
  const userDoc = await User.findById(request.user).select("companyId").lean();
  const userCo = userDoc ? (userDoc as { companyId?: unknown }).companyId : null;
  return userCo ? String(userCo) : null;
}

export async function checkAlternativeAcceptanceCapacity(params: {
  request: IVacationRequestModel;
  companyId: string;
}) {
  const { request, companyId } = params;
  const maxPerDay = await getMaxPerDayForDate(
    new Date(request.adminOptionStartDate!),
    companyId,
  );

  return findOverCapacityDays(
    VacationRequest,
    request.adminOptionStartDate!,
    request.adminOptionEndDate!,
    maxPerDay,
    companyId,
    request._id.toString(),
  );
}

export function applyAlternativeResponseWorkflow(
  request: IVacationRequestModel,
  accept: boolean,
) {
  return applyAlternativeDateResponse(request, accept);
}
