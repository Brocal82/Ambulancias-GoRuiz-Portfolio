import type { VacationStatus } from "../domain/vacation";

export function canWorkerRespondToAlternative(input: {
  status: VacationStatus;
  adminOptionStartDate?: string;
  adminOptionEndDate?: string;
}): boolean {
  return (
    input.status === "option_sent" &&
    !!input.adminOptionStartDate &&
    !!input.adminOptionEndDate
  );
}

export function canWorkerCancelVacation(status: VacationStatus): boolean {
  return status === "pending" || status === "option_sent";
}

export function isVacationCapacityExceededError(err: {
  status?: number;
  body?: { code?: string };
}): boolean {
  return err?.status === 409 && err?.body?.code === "capacity_exceeded";
}
