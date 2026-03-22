import mongoose from "mongoose";
import { Appointment } from "../models/appointment.model";
import { IAppointment, TimeSlot } from "../types/appointment.types";

/** Error con código HTTP para mapeo en controller */
export class AppointmentError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = "AppointmentError";
  }
}

// Helpers (lógica de dominio)
const parseISOToDate = (iso: string): Date => new Date(iso);
const isFuture = (d: Date) => d.getTime() > Date.now();
const sortByStartAsc = (a: TimeSlot, b: TimeSlot) =>
  a.start.getTime() - b.start.getTime();
const timeslotEquals = (a: TimeSlot, b: TimeSlot) =>
  a.start.getTime() === b.start.getTime() &&
  a.end.getTime() === b.end.getTime();

const validateSlots = (slots: TimeSlot[]) => {
  if (!Array.isArray(slots) || slots.length === 0) {
    throw new AppointmentError(
      "Debes proporcionar al menos 1 opción de horario.",
      400,
    );
  }
  if (slots.length > 3) {
    throw new AppointmentError(
      "proposedSlots no puede tener más de 3 opciones.",
      400,
    );
  }
  for (const s of slots) {
    if (
      !(s.start instanceof Date) ||
      !(s.end instanceof Date) ||
      Number.isNaN(s.start.getTime()) ||
      Number.isNaN(s.end.getTime())
    ) {
      throw new AppointmentError(
        "Cada slot debe tener start y end ISO válidos.",
        400,
      );
    }
    if (s.start >= s.end) throw new AppointmentError("start debe ser anterior a end.", 400);
    if (!isFuture(s.start))
      throw new AppointmentError("No se pueden proponer horarios en el pasado.", 400);
  }
};

export async function requestAppointment(
  workerId: string,
  body: { reason?: string; details?: string },
) {
  const { reason, details } = body;
  if (!reason || !details) {
    throw new AppointmentError("reason y details son obligatorios.", 400);
  }

  const appointment: Partial<IAppointment> = {
    workerId: new mongoose.Types.ObjectId(workerId),
    reason: reason.trim(),
    details: details.trim(),
    status: "pending",
    proposedSlots: [],
    selectedSlot: null,
  };

  return await Appointment.create(appointment);
}

export async function getMyAppointments(workerId: string) {
  return await Appointment.find({ workerId }).sort({ createdAt: -1 });
}

export async function getPendingAppointments() {
  return await Appointment.find({ status: "pending" })
    .populate("workerId", "name lastName email")
    .sort({ createdAt: -1 });
}

export async function getOpenAppointments() {
  return await Appointment.find({
    status: { $in: ["pending", "proposed"] },
  })
    .populate("workerId", "name lastName email")
    .sort({ createdAt: -1 })
    .select("+proposedSlots");
}

export async function proposeSlots(
  adminId: string,
  id: string,
  body: { proposedSlots?: { start: string; end: string }[] },
) {
  const appointment = await Appointment.findById(id);
  if (!appointment) {
    throw new AppointmentError("Cita no encontrada.", 404);
  }
  if (appointment.status !== "pending" && appointment.status !== "proposed") {
    throw new AppointmentError(
      "Solo se pueden proponer horarios para solicitudes pendientes o ya propuestas.",
      400,
    );
  }

  const slots: TimeSlot[] = (body.proposedSlots || []).map((s) => ({
    start: parseISOToDate(s.start),
    end: parseISOToDate(s.end),
  }));

  validateSlots(slots);
  slots.sort(sortByStartAsc);

  appointment.adminId = new mongoose.Types.ObjectId(adminId);
  appointment.proposedSlots = slots;
  appointment.selectedSlot = null;
  appointment.status = "proposed";

  return await appointment.save();
}

export async function selectSlot(
  workerId: string,
  id: string,
  body: { selectedSlot?: { start: string; end: string } },
) {
  const appointment = await Appointment.findById(id);
  if (!appointment) {
    throw new AppointmentError("Cita no encontrada.", 404);
  }
  if (appointment.workerId.toString() !== workerId) {
    throw new AppointmentError(
      "No autorizado para confirmar esta cita.",
      403,
    );
  }
  if (appointment.status !== "proposed") {
    throw new AppointmentError(
      "Solo se puede seleccionar un horario cuando la cita está en estado proposed.",
      400,
    );
  }

  const sel: TimeSlot = {
    start: parseISOToDate(body.selectedSlot!.start),
    end: parseISOToDate(body.selectedSlot!.end),
  };
  if (!isFuture(sel.start)) {
    throw new AppointmentError(
      "No se puede confirmar un horario en el pasado.",
      400,
    );
  }

  const belongs = (appointment.proposedSlots || []).some((s) =>
    timeslotEquals(s, sel),
  );
  if (!belongs) {
    throw new AppointmentError(
      "selectedSlot debe pertenecer a proposedSlots.",
      400,
    );
  }

  appointment.selectedSlot = sel;
  appointment.status = "confirmed";

  return await appointment.save();
}

export async function getCalendarAppointments(query: { from?: string; to?: string }) {
  const { from, to } = query;
  if (!from || !to) {
    throw new AppointmentError(
      "Parámetros from y to son requeridos (YYYY-MM-DD o ISO).",
      400,
    );
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);

  return await Appointment.find({
    status: { $in: ["confirmed", "rescheduled"] },
    "selectedSlot.start": { $gte: fromDate, $lte: toDate },
  })
    .populate("workerId", "name lastName email")
    .populate("adminId", "name lastName email")
    .sort({ "selectedSlot.start": 1 });
}

export async function updateAppointment(
  adminId: string,
  id: string,
  body: {
    reason?: string;
    details?: string;
    selectedSlot?: { start: string; end: string };
  },
) {
  const appointment = await Appointment.findById(id);
  if (!appointment) {
    throw new AppointmentError("Cita no encontrada.", 404);
  }

  let status = appointment.status;

  if (typeof body.reason === "string") appointment.reason = body.reason.trim();
  if (typeof body.details === "string") appointment.details = body.details.trim();

  if (body.selectedSlot) {
    const sel: TimeSlot = {
      start: parseISOToDate(body.selectedSlot.start),
      end: parseISOToDate(body.selectedSlot.end),
    };
    if (!isFuture(sel.start)) {
      throw new AppointmentError(
        "No se puede programar un horario en el pasado.",
        400,
      );
    }
    appointment.selectedSlot = sel;
    status = "rescheduled";
  }

  appointment.status = status as IAppointment["status"];
  appointment.adminId = new mongoose.Types.ObjectId(adminId);

  return await appointment.save();
}

export async function cancelAppointment(adminId: string, id: string) {
  const appointment = await Appointment.findById(id);
  if (!appointment) {
    throw new AppointmentError("Cita no encontrada.", 404);
  }

  appointment.status = "cancelled";
  appointment.adminId = new mongoose.Types.ObjectId(adminId);

  return await appointment.save();
}

export async function deleteMyAppointment(workerId: string, id: string) {
  const appointment = await Appointment.findById(id);
  if (!appointment) {
    throw new AppointmentError("Cita no encontrada.", 404);
  }

  if (appointment.workerId.toString() !== workerId) {
    throw new AppointmentError(
      "No autorizado para eliminar esta cita.",
      403,
    );
  }

  const now = Date.now();
  const startMs = appointment.selectedSlot?.start
    ? appointment.selectedSlot.start.getTime()
    : 0;
  const endMs = appointment.selectedSlot?.end
    ? appointment.selectedSlot.end.getTime()
    : startMs;

  const isPast = endMs > 0 && endMs < now;
  const isCancelled = appointment.status === "cancelled";

  if (!isPast && !isCancelled) {
    throw new AppointmentError(
      "Solo puedes eliminar citas canceladas o ya pasadas.",
      400,
    );
  }

  await appointment.deleteOne();
}

export async function getAppointmentsCount(status?: string) {
  const rawStatus = typeof status === "string" ? status : "pending";
  const normalizedStatus = rawStatus.toLowerCase();
  const count = await Appointment.countDocuments({ status: normalizedStatus });
  return { count };
}
