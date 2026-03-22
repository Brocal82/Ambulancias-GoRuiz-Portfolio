import { z } from "zod";

/** Fecha válida (string ISO o parseable) */
const dateStringSchema = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: "Fecha inválida" },
);

/** Slot con start y end */
const slotSchema = z.object({
  start: dateStringSchema,
  end: dateStringSchema,
});

/* ─────────────────────────────────────────────────────────────────────────────
 * POST /api/appointments/requests — Crear solicitud de cita
 * ───────────────────────────────────────────────────────────────────────────── */
export const requestAppointmentSchema = z.object({
  reason: z.string().min(1, "reason requerido"),
  details: z.string().min(1, "details requerido"),
});

/* ─────────────────────────────────────────────────────────────────────────────
 * POST /api/appointments/:id/propose — Proponer slots (admin)
 * Service usa proposedSlots
 * ───────────────────────────────────────────────────────────────────────────── */
export const proposeSlotsSchema = z.object({
  proposedSlots: z
    .array(slotSchema)
    .min(1, "proposedSlots debe tener al menos un elemento"),
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
export const updateAppointmentSchema = z.object({
  reason: z.string().min(1).optional(),
  details: z.string().min(1).optional(),
  selectedSlot: slotSchema.optional(),
});
