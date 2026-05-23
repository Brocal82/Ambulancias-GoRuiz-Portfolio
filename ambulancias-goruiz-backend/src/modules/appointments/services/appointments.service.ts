import mongoose from "mongoose";
import { Appointment } from "../models/appointment.model";
import User from "../../users/models/user.model";
import { APPOINTMENT_STATUS_VALUES } from "../schemas/appointment.schema";
import { AppointmentStatus, IAppointment, TimeSlot } from "../types/appointment.types";
import { sendPushNotification } from "../../notifications";

async function getWorkerIdsForCompany(companyId: string): Promise<mongoose.Types.ObjectId[]> {
  const users = await User.find({
    companyId: new mongoose.Types.ObjectId(companyId),
  })
    .select("_id")
    .lean();
  return users.map((u) => (u as unknown as { _id: mongoose.Types.ObjectId })._id);
}

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
  companyId?: string,
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
    ...(companyId && mongoose.Types.ObjectId.isValid(companyId) && {
      companyId: new mongoose.Types.ObjectId(companyId),
    }),
  };

  return await Appointment.create(appointment);
}

export async function getMyAppointments(workerId: string) {
  return await Appointment.find({ workerId }).sort({ createdAt: -1 });
}

export async function getPendingAppointments(companyId?: string | null) {
  if (!companyId || String(companyId).trim() === "") {
    return [];
  }
  const filter: Record<string, unknown> = { status: "pending" };
  const companyOid = new mongoose.Types.ObjectId(companyId);
  const workerIds = await getWorkerIdsForCompany(companyId);
  filter.$or = [
    { companyId: companyOid },
    { companyId: null, workerId: { $in: workerIds } },
  ];
  return await Appointment.find(filter)
    .populate("workerId", "name lastName email")
    .sort({ createdAt: -1 });
}

export async function getOpenAppointments(companyId?: string | null) {
  if (!companyId || String(companyId).trim() === "") {
    return [];
  }
  const filter: Record<string, unknown> = {
    status: { $in: ["pending", "proposed", "cancellation_requested"] },
  };
  const companyOid = new mongoose.Types.ObjectId(companyId);
  const workerIds = await getWorkerIdsForCompany(companyId);
  filter.$or = [
    { companyId: companyOid },
    { companyId: null, workerId: { $in: workerIds } },
  ];
  return await Appointment.find(filter)
    .populate("workerId", "name lastName email")
    .sort({ createdAt: -1 })
    .select("+proposedSlots");
}

export async function proposeSlots(
  adminId: string,
  id: string,
  body: { proposedSlots?: { start: string; end: string }[] },
  companyId?: string | null,
) {
  const appointment = await Appointment.findById(id);
  if (!appointment) {
    throw new AppointmentError("Cita no encontrada.", 404);
  }
  if (!companyId || String(companyId).trim() === "") {
    throw new AppointmentError("No tienes permiso para modificar esta cita.", 403);
  }
  let matchPropose: boolean;
  if (appointment.companyId) {
    // New record (Phase 1+): direct check, no extra DB query
    matchPropose = String(appointment.companyId) === String(companyId);
  } else {
    // Legacy record (companyId null): existing indirect check, unchanged
    const worker = await User.findById(appointment.workerId).select("companyId").lean();
    const workerCo = worker ? (worker as { companyId?: unknown }).companyId : null;
    matchPropose = !!(workerCo && String(workerCo) === String(companyId));
  }
  if (!matchPropose) {
    throw new AppointmentError("No tienes permiso para modificar esta cita.", 403);
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

  const saved = await appointment.save();
  void sendPushNotification(
    [appointment.workerId.toString()],
    "Nueva propuesta de cita",
    "El administrador te ha propuesto horarios para tu cita.",
    { type: "appointment_proposed", appointmentId: String(appointment._id), screen: "appointments" },
  );
  return saved;
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
  if (sel.start >= sel.end) {
    throw new AppointmentError("start debe ser anterior a end.", 400);
  }
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

export async function rejectProposal(workerId: string, id: string) {
  const appointment = await Appointment.findById(id);
  if (!appointment) {
    throw new AppointmentError("Cita no encontrada.", 404);
  }
  if (appointment.workerId.toString() !== workerId) {
    throw new AppointmentError(
      "No autorizado para rechazar esta propuesta.",
      403,
    );
  }
  if (appointment.status !== "proposed") {
    throw new AppointmentError(
      "Solo se puede rechazar cuando la cita está en estado proposed.",
      400,
    );
  }

  appointment.status = "pending";
  appointment.proposedSlots = [];
  appointment.selectedSlot = null;

  return await appointment.save();
}

export async function getCalendarAppointments(
  query: { from?: string; to?: string },
  companyId?: string | null,
) {
  const { from, to } = query;
  if (!from || !to) {
    throw new AppointmentError(
      "Parámetros from y to son requeridos (YYYY-MM-DD o ISO).",
      400,
    );
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (
    Number.isNaN(fromDate.getTime()) ||
    Number.isNaN(toDate.getTime())
  ) {
    throw new AppointmentError("from y to deben ser fechas válidas.", 400);
  }
  if (fromDate > toDate) {
    throw new AppointmentError("from debe ser anterior o igual a to.", 400);
  }

  if (!companyId || String(companyId).trim() === "") {
    return [];
  }
  const filter: Record<string, unknown> = {
    status: { $in: ["confirmed", "rescheduled"] },
    "selectedSlot.start": { $gte: fromDate, $lte: toDate },
  };
  const companyOid = new mongoose.Types.ObjectId(companyId);
  const workerIds = await getWorkerIdsForCompany(companyId);
  filter.$or = [
    { companyId: companyOid },
    { companyId: null, workerId: { $in: workerIds } },
  ];

  return await Appointment.find(filter)
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
  companyId?: string | null,
) {
  const appointment = await Appointment.findById(id);
  if (!appointment) {
    throw new AppointmentError("Cita no encontrada.", 404);
  }
  if (!companyId || String(companyId).trim() === "") {
    throw new AppointmentError("No tienes permiso para modificar esta cita.", 403);
  }
  let matchUpdate: boolean;
  if (appointment.companyId) {
    // New record (Phase 1+): direct check, no extra DB query
    matchUpdate = String(appointment.companyId) === String(companyId);
  } else {
    // Legacy record (companyId null): existing indirect check, unchanged
    const worker = await User.findById(appointment.workerId).select("companyId").lean();
    const workerCo = worker ? (worker as { companyId?: unknown }).companyId : null;
    matchUpdate = !!(workerCo && String(workerCo) === String(companyId));
  }
  if (!matchUpdate) {
    throw new AppointmentError("No tienes permiso para modificar esta cita.", 403);
  }

  let status = appointment.status;

  if (typeof body.reason === "string") appointment.reason = body.reason.trim();
  if (typeof body.details === "string") appointment.details = body.details.trim();

  if (body.selectedSlot) {
    const sel: TimeSlot = {
      start: parseISOToDate(body.selectedSlot.start),
      end: parseISOToDate(body.selectedSlot.end),
    };
    if (sel.start >= sel.end) {
      throw new AppointmentError("start debe ser anterior a end.", 400);
    }
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

export async function cancelAppointment(
  adminId: string,
  id: string,
  companyId?: string | null,
) {
  const appointment = await Appointment.findById(id);
  if (!appointment) {
    throw new AppointmentError("Cita no encontrada.", 404);
  }
  if (!companyId || String(companyId).trim() === "") {
    throw new AppointmentError("No tienes permiso para cancelar esta cita.", 403);
  }
  let matchCancel: boolean;
  if (appointment.companyId) {
    // New record (Phase 1+): direct check, no extra DB query
    matchCancel = String(appointment.companyId) === String(companyId);
  } else {
    // Legacy record (companyId null): existing indirect check, unchanged
    const worker = await User.findById(appointment.workerId).select("companyId").lean();
    const workerCo = worker ? (worker as { companyId?: unknown }).companyId : null;
    matchCancel = !!(workerCo && String(workerCo) === String(companyId));
  }
  if (!matchCancel) {
    throw new AppointmentError("No tienes permiso para cancelar esta cita.", 403);
  }

  appointment.status = "cancelled";
  appointment.adminId = new mongoose.Types.ObjectId(adminId);

  return await appointment.save();
}

export async function requestCancellation(
  workerId: string,
  id: string,
  message: string,
) {
  const appointment = await Appointment.findById(id);
  if (!appointment) {
    throw new AppointmentError("Cita no encontrada.", 404);
  }
  if (appointment.workerId.toString() !== workerId) {
    throw new AppointmentError("No autorizado para cancelar esta cita.", 403);
  }
  if (
    appointment.status === "cancelled" ||
    appointment.status === "cancellation_requested"
  ) {
    throw new AppointmentError(
      "Esta cita ya está cancelada o tiene una solicitud de cancelación pendiente.",
      400,
    );
  }

  appointment.status = "cancellation_requested";
  appointment.cancellationMessage = message.trim();

  return await appointment.save();
}

export async function acceptCancellation(
  adminId: string,
  id: string,
  companyId?: string | null,
) {
  const appointment = await Appointment.findById(id);
  if (!appointment) {
    throw new AppointmentError("Cita no encontrada.", 404);
  }
  if (!companyId || String(companyId).trim() === "") {
    throw new AppointmentError("No tienes permiso para cancelar esta cita.", 403);
  }
  let matchCancel: boolean;
  if (appointment.companyId) {
    matchCancel = String(appointment.companyId) === String(companyId);
  } else {
    const worker = await User.findById(appointment.workerId).select("companyId").lean();
    const workerCo = worker ? (worker as { companyId?: unknown }).companyId : null;
    matchCancel = !!(workerCo && String(workerCo) === String(companyId));
  }
  if (!matchCancel) {
    throw new AppointmentError("No tienes permiso para cancelar esta cita.", 403);
  }
  if (appointment.status !== "cancellation_requested") {
    throw new AppointmentError(
      "Esta cita no tiene una solicitud de cancelación pendiente.",
      400,
    );
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
    throw new AppointmentError("No autorizado para eliminar esta cita.", 403);
  }
  if (appointment.status !== "cancelled") {
    throw new AppointmentError(
      "Solo puedes eliminar citas ya canceladas.",
      400,
    );
  }

  await appointment.deleteOne();
}

export async function getAppointmentsCount(
  status?: string,
  companyId?: string | null,
) {
  const rawStatus = typeof status === "string" ? status : "pending";
  const normalizedStatus = rawStatus.toLowerCase();
  if (
    !APPOINTMENT_STATUS_VALUES.includes(normalizedStatus as AppointmentStatus)
  ) {
    throw new AppointmentError("status inválido.", 400);
  }
  if (!companyId || String(companyId).trim() === "") {
    return { count: 0 };
  }
  const filter: Record<string, unknown> = { status: normalizedStatus };
  const companyOid = new mongoose.Types.ObjectId(companyId);
  const workerIds = await getWorkerIdsForCompany(companyId);
  filter.$or = [
    { companyId: companyOid },
    { companyId: null, workerId: { $in: workerIds } },
  ];
  const count = await Appointment.countDocuments(filter);
  return { count };
}
