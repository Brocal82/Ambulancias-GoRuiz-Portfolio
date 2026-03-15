import type { IVacationRequestModel } from "../../../models/vacationRequest";
import VacationRequest from "../../../models/vacationRequest";
import { applyAlternativeDateResponse } from "../utils/vacation-workflow.helpers";

export async function getVacationRequestById(id: string) {
  return (await VacationRequest.findById(id)) as IVacationRequestModel | null;
}

export function canRespondToAlternativeDate(
  request: IVacationRequestModel,
  userId: string,
) {
  return request.user.toString() === userId;
}

export function applyAlternativeResponseWorkflow(
  request: IVacationRequestModel,
  accept: boolean,
) {
  return applyAlternativeDateResponse(request, accept);
}
