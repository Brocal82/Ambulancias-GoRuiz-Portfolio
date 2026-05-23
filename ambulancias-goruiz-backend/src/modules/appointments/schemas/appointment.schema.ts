import { z } from "zod";

/** Fecha válida (string ISO o parseable) */
const dateStringSchema = z.string().refine(
  (val) => !Number.isNaN(Date.parse(val)),
  { message: "Fecha inválida" },
);

const parseDate = (val: string) => Date.parse(val);

/** Slot con start y end; start debe ser anterior a end */
const slotSchema = z
  .object({
    start: dateStringSchema,
    end: dateStringSchema,
  })
  .refine((s) => parseDate(s.start) < parseDate(s.end), {
    message: "start debe ser anterior a end.",
    path: ["end"],
  });

const proposedSlotsOrdered = (slots: { start: string; end: string }[]) => {
  for (let i = 1; i < slots.length; i++) {
    if (parseDate(slots[i - 1].start) > parseDate(slots[i].start)) {
      return false;
    }
  }
  return true;
};

export const APPOINTMENT_STATUS_VALUES = [
  "pending",
  "proposed",
  "confirmed",
  "cancelled",
  "rescheduled",
  "cancellation_requested",
] as const;

export const appointmentStatusSchema = z.enum(APPOINTMENT_STATUS_VALUES);

/* ─────────────────────────────────────────────────────────────────────────────
 * POST /api/appointments/requests — Crear solicitud de cita
 * ───────────────────────────────────────────────────────────────────────────── */
export const requestAppointmentSchema = z.object({
  reason: z.string().min(1, "reason requerido").max(120, "reason no puede superar 120 caracteres"),
  details: z
    .string()
    .min(1, "details requerido")
    .max(5000, "details no puede superar 5000 caracteres"),
});

/* ─────────────────────────────────────────────────────────────────────────────
 * POST /api/appointments/:id/propose — Proponer slots (admin)
 * Service usa proposedSlots
 * ───────────────────────────────────────────────────────────────────────────── */
export const proposeSlotsSchema = z
  .object({
    proposedSlots: z
      .array(slotSchema)
      .min(1, "proposedSlots debe tener al menos un elemento")
      .max(3, "proposedSlots no puede tener más de 3 opciones"),
  })
  .refine((data) => proposedSlotsOrdered(data.proposedSlots), {
    message: "proposedSlots debe venir ordenado por fecha/hora ascendente.",
    path: ["proposedSlots"],
  });

/* ─────────────────────────────────────────────────────────────────────────────
 * POST /api/appointments/:id/select — Seleccionar slot (worker)
 * ───────────────────────────────────────────────────────────────────────────── */
export const selectSlotSchema = z.object({
  selectedSlot: slotSchema,
});

/* ─────────────────────────────────────────────────────────────────────────────
 * PATCH /api/appointments/:id — Actualizar cita (admin)
 * Todos opcionales; reason, details, selectedSlot
 * ───────────────────────────────────────────────────────────────────────────── */
export const updateAppointmentSchema = z
  .object({
    reason: z.string().min(1).max(120).optional(),
    details: z.string().min(1).max(5000).optional(),
    selectedSlot: slotSchema.optional(),
  })
  .refine(
    (data) =>
      data.reason !== undefined ||
      data.details !== undefined ||
      data.selectedSlot !== undefined,
    { message: "Debes enviar al menos un campo para actualizar." },
  );

/* ─────────────────────────────────────────────────────────────────────────────
 * POST /api/appointments/:id/request-cancel — Solicitar cancelación (worker)
 * ───────────────────────────────────────────────────────────────────────────── */
export const requestCancellationSchema = z.object({
  message: z.string().min(1, "El motivo de cancelación es obligatorio").max(1000),
});

/* ─────────────────────────────────────────────────────────────────────────────
 * GET /api/appointments/calendar — Calendario admin
 * ───────────────────────────────────────────────────────────────────────────── */
export const calendarQuerySchema = z
  .object({
    from: dateStringSchema,
    to: dateStringSchema,
  })
  .refine((q) => parseDate(q.from) <= parseDate(q.to), {
    message: "from debe ser anterior o igual a to.",
    path: ["to"],
  });

/* ─────────────────────────────────────────────────────────────────────────────
 * GET /api/appointments/count — Contador por estado (admin)
 * ───────────────────────────────────────────────────────────────────────────── */
export const countQuerySchema = z.object({
  status: appointmentStatusSchema.optional().default("pending"),
});
