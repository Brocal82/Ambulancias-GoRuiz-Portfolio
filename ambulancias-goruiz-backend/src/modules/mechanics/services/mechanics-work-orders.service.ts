import mongoose from "mongoose";
import MechanicsWorkOrder, {
  type IMechanicsWorkOrder,
  type MechanicsWorkOrderStatus,
} from "../models/mechanics-work-order.model";
import { getAmbulanceById } from "../../ambulances/services/ambulances.service";
import User from "../../users/models/user.model";
import { WorkdaySummaryError } from "../../../utils/assignmentClosure";
import { isSameCompany } from "../../../utils/requireCompany";

function requireCompanyOid(
  companyId: string | null | undefined,
): mongoose.Types.ObjectId {
  const raw = typeof companyId === "string" ? companyId.trim() : "";
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) {
    throw new WorkdaySummaryError(
      "No tienes permiso. Se requiere pertenecer a una empresa.",
      403,
    );
  }
  return new mongoose.Types.ObjectId(raw);
}

async function assertUserAssignableToCompany(
  userId: string,
  adminCompanyId: string,
): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new WorkdaySummaryError("Usuario asignado inválido", 400);
  }
  const user = await User.findById(userId).select("companyId").lean();
  if (!user) {
    throw new WorkdaySummaryError("Usuario asignado no encontrado", 404);
  }
  const uCo = (user as { companyId?: unknown }).companyId;
  if (!isSameCompany(uCo, adminCompanyId)) {
    throw new WorkdaySummaryError(
      "El usuario asignado no pertenece a tu empresa",
      403,
    );
  }
}

export async function createMechanicsWorkOrder(
  companyId: string | null | undefined,
  createdByUserId: string,
  input: {
    ambulanceId: string;
    title: string;
    description?: string;
    plannedFor?: Date;
    assignedTo?: string;
  },
): Promise<IMechanicsWorkOrder> {
  const co = requireCompanyOid(companyId);
  const ambulance = await getAmbulanceById(input.ambulanceId, String(co));
  if (!ambulance) {
    throw new WorkdaySummaryError("Ambulancia no encontrada", 404);
  }

  if (input.assignedTo) {
    await assertUserAssignableToCompany(input.assignedTo, String(co));
  }

  const doc = await MechanicsWorkOrder.create({
    companyId: co,
    ambulanceId: ambulance._id,
    ambulanceNumber: String(ambulance.ambulanceNumber ?? "").trim() || "—",
    title: input.title.trim(),
    ...(input.description !== undefined && input.description !== ""
      ? { description: input.description.trim() }
      : {}),
    ...(input.plannedFor ? { plannedFor: input.plannedFor } : {}),
    ...(input.assignedTo
      ? { assignedTo: new mongoose.Types.ObjectId(input.assignedTo) }
      : {}),
    createdBy: new mongoose.Types.ObjectId(createdByUserId),
    status: "pending" as MechanicsWorkOrderStatus,
  });

  return doc;
}

export async function listMechanicsWorkOrders(
  companyId: string | null | undefined,
  ambulanceId?: string | null,
): Promise<IMechanicsWorkOrder[]> {
  const co = requireCompanyOid(companyId);
  const filter: Record<string, unknown> = { companyId: co };
  const amb = typeof ambulanceId === "string" ? ambulanceId.trim() : "";
  if (amb && mongoose.Types.ObjectId.isValid(amb)) {
    filter.ambulanceId = new mongoose.Types.ObjectId(amb);
  }
  return MechanicsWorkOrder.find(filter).sort({ createdAt: -1 }).exec();
}

export async function getMechanicsWorkOrderById(
  companyId: string | null | undefined,
  id: string,
): Promise<IMechanicsWorkOrder | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }
  const co = requireCompanyOid(companyId);
  return MechanicsWorkOrder.findOne({
    _id: id,
    companyId: co,
  }).exec();
}

export async function patchMechanicsWorkOrderByAdmin(
  companyId: string | null | undefined,
  actorUserId: string,
  id: string,
  body: {
    title?: string;
    description?: string | null;
    plannedFor?: Date | null | undefined;
    assignedTo?: string | null;
    status?: MechanicsWorkOrderStatus;
    completionNotes?: string | null;
  },
): Promise<IMechanicsWorkOrder> {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new WorkdaySummaryError("ID inválido", 400);
  }
  const co = requireCompanyOid(companyId);
  const existing = await MechanicsWorkOrder.findOne({
    _id: id,
    companyId: co,
  });
  if (!existing) {
    throw new WorkdaySummaryError("Orden no encontrada", 404);
  }

  if (existing.status === "completed" || existing.status === "cancelled") {
    throw new WorkdaySummaryError("No se puede modificar una orden cerrada", 400);
  }

  if (body.assignedTo) {
    await assertUserAssignableToCompany(body.assignedTo, String(co));
  }

  const $set: Record<string, unknown> = {};

  if (body.title !== undefined) $set.title = body.title.trim();
  if (body.description !== undefined) {
    $set.description =
      body.description === null || body.description === ""
        ? ""
        : String(body.description).trim();
  }
  if (body.plannedFor !== undefined) {
    $set.plannedFor = body.plannedFor;
  }
  if (body.assignedTo !== undefined) {
    if (body.assignedTo === null || body.assignedTo === "") {
      $set.assignedTo = null;
    } else {
      $set.assignedTo = new mongoose.Types.ObjectId(body.assignedTo);
    }
  }
  if (body.completionNotes !== undefined) {
    $set.completionNotes =
      body.completionNotes === null || body.completionNotes === ""
        ? ""
        : String(body.completionNotes).trim();
  }

  if (body.status !== undefined) {
    if (body.status === "completed") {
      const notes =
        typeof body.completionNotes === "string"
          ? body.completionNotes.trim()
          : String(existing.completionNotes ?? "").trim();
      if (notes.length < 3) {
        throw new WorkdaySummaryError(
          "Las notas de cierre son obligatorias (mín. 3 caracteres) al completar",
          400,
        );
      }
      $set.completionNotes = notes;
      $set.completedAt = new Date();
      if (mongoose.Types.ObjectId.isValid(actorUserId)) {
        $set.completedBy = new mongoose.Types.ObjectId(actorUserId);
      }
    }
    if (body.status === "cancelled") {
      $set.cancelledAt = new Date();
    }
    $set.status = body.status;
  }

  if (Object.keys($set).length === 0) {
    return existing;
  }

  const updated = await MechanicsWorkOrder.findByIdAndUpdate(
    id,
    { $set },
    { new: true, runValidators: true },
  );
  if (!updated) {
    throw new WorkdaySummaryError("Orden no encontrada", 404);
  }
  return updated;
}

export async function patchMechanicsWorkOrderByMechanic(
  companyId: string | null | undefined,
  mechanicUserId: string,
  id: string,
  body: {
    status: "in_progress" | "completed";
    completionNotes?: string;
  },
): Promise<IMechanicsWorkOrder> {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new WorkdaySummaryError("ID inválido", 400);
  }
  const co = requireCompanyOid(companyId);
  const order = await MechanicsWorkOrder.findOne({
    _id: id,
    companyId: co,
  });
  if (!order) {
    throw new WorkdaySummaryError("Orden no encontrada", 404);
  }

  if (order.status === "cancelled" || order.status === "completed") {
    throw new WorkdaySummaryError("Esta orden ya está cerrada", 400);
  }

  const mechOid = new mongoose.Types.ObjectId(mechanicUserId);
  const assigned = order.assignedTo;

  if (assigned && !assigned.equals(mechOid)) {
    throw new WorkdaySummaryError(
      "Esta orden está asignada a otro mecánico",
      403,
    );
  }

  if (body.status === "in_progress") {
    if (order.status !== "pending") {
      throw new WorkdaySummaryError(
        "Solo se puede iniciar desde estado pendiente",
        400,
      );
    }
    const $set: Record<string, unknown> = {
      status: "in_progress",
    };
    if (!assigned) {
      $set.assignedTo = mechOid;
    }
    const updated = await MechanicsWorkOrder.findByIdAndUpdate(
      id,
      { $set },
      { new: true, runValidators: true },
    );
    if (!updated) throw new WorkdaySummaryError("Orden no encontrada", 404);
    return updated;
  }

  if (body.status === "completed") {
    if (order.status !== "in_progress") {
      throw new WorkdaySummaryError(
        "Solo se puede completar una orden en curso",
        400,
      );
    }
    const notes = (body.completionNotes ?? "").trim();
    if (notes.length < 3) {
      throw new WorkdaySummaryError(
        "Debes indicar notas de cierre (mín. 3 caracteres)",
        400,
      );
    }
    const updated = await MechanicsWorkOrder.findByIdAndUpdate(
      id,
      {
        $set: {
          status: "completed",
          completionNotes: notes,
          completedAt: new Date(),
          completedBy: mechOid,
        },
      },
      { new: true, runValidators: true },
    );
    if (!updated) throw new WorkdaySummaryError("Orden no encontrada", 404);
    return updated;
  }

  throw new WorkdaySummaryError("Estado no válido", 400);
}
