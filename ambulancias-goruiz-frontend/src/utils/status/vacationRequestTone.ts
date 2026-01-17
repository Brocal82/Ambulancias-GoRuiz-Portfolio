// frontend/src/utils/status/vacationRequestTone.ts
import type { StatusTone } from "../../components/common/StatusBadge";

export type VacationRequestStatus =
  | "pending"
  | "accepted"
  | "option_sent"
  | "cancelled"
  | "rejected";

export const vacationRequestTone = (
  status: string | VacationRequestStatus,
): StatusTone => {
  switch (status) {
    case "pending":
      return "amber";
    case "accepted":
      return "emerald";
    case "option_sent":
      return "sky";
    case "cancelled":
    case "rejected":
      return "rose";
    default:
      return "slate";
  }
};
