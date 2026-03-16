import type { SickDocumentRequirementResult } from "../types/sick-leave.types";
import {
  toBerlinDateTime,
  toBerlinEndOfDay,
  toBerlinStartOfDay,
} from "./sick-date.helpers";

export function calculateSickDocumentRequirements(input: {
  startDate: Date;
  endDate: Date;
  createdAt: Date;
}): SickDocumentRequirementResult {
  const startDt = toBerlinStartOfDay(input.startDate);
  const endDt = toBerlinEndOfDay(input.endDate);

  const durationDays = Math.floor(endDt.diff(startDt, "days").days) + 1;
  const requiresDocument = durationDays >= 3;

  if (!requiresDocument) {
    return {
      requiresDocument,
      verificationStatus: "not_required",
      documentDueAt: undefined,
    };
  }

  return {
    requiresDocument,
    verificationStatus: "pending",
    documentDueAt: toBerlinDateTime(input.createdAt)
      .plus({ days: 3 })
      .endOf("day")
      .toJSDate(),
  };
}
