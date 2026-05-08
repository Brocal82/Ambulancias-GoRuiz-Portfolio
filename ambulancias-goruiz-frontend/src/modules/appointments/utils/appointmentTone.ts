
import type { Appointment } from "../domain/types";
import type { StatusTone } from "../../../components/common/StatusBadge";

export const toneForAppointmentStatus = (
  s: Appointment["status"],
): StatusTone => {
  return s === "confirmed" || s === "rescheduled"
    ? "emerald"
    : s === "pending"
      ? "amber"
      : s === "proposed"
        ? "sky"
        : s === "cancelled"
          ? "rose"
          : s === "cancellation_requested"
            ? "amber"
            : "slate";
};

