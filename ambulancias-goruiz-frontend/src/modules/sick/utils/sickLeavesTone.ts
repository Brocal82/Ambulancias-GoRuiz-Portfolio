// src/utils/status/sickLeaveTone.ts
import type { SickLeaveStatus } from "../domain";

export const sickLeaveTone = (
  status: SickLeaveStatus,
): "amber" | "emerald" | "rose" => {
  switch (status) {
    case "pending":
      return "amber";
    case "accepted":
      return "emerald";
    case "rejected":
    default:
      return "rose";
  }
};


