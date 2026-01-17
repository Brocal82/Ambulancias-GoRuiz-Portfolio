// src/utils/status/appointments.ts
import type { Appointment } from "../../types/appointment";
import type { StatusTone } from "../../components/common/StatusBadge";

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
          : "slate";
};
