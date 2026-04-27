import { Request, Response } from "express";
import { WorkdaySummaryError } from "../../../utils/assignmentClosure";
import {
  createMechanicsWorkOrder,
  listMechanicsWorkOrders,
  getMechanicsWorkOrderById,
  patchMechanicsWorkOrderByAdmin,
  patchMechanicsWorkOrderByMechanic,
} from "../services/mechanics-work-orders.service";
import {
  patchMechanicsWorkOrderAdminSchema,
  patchMechanicsWorkOrderMechanicSchema,
} from "../schemas/mechanics-work-order.schema";

function handleError(
  error: unknown,
  res: Response,
  fallbackMsg: string,
  logLabel: string,
): void {
  if (error instanceof WorkdaySummaryError) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }
  console.error(logLabel, error);
  res.status(500).json({ message: fallbackMsg });
}

export const createWorkOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId ?? "";
    const doc = await createMechanicsWorkOrder(req.companyId, userId, {
      ambulanceId: String(req.body.ambulanceId ?? "").trim(),
      title: String(req.body.title ?? ""),
      description:
        req.body.description !== undefined
          ? String(req.body.description)
          : undefined,
      plannedFor: req.body.plannedFor as Date | undefined,
      assignedTo:
        typeof req.body.assignedTo === "string" && req.body.assignedTo.trim()
          ? req.body.assignedTo.trim()
          : undefined,
    });
    res.status(201).json(doc);
  } catch (error) {
    handleError(
      error,
      res,
      "Error al crear la orden de trabajo",
      "❌ createWorkOrder:",
    );
  }
};

export const listWorkOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const ambulanceId =
      typeof req.query.ambulanceId === "string"
        ? req.query.ambulanceId
        : undefined;
    const list = await listMechanicsWorkOrders(req.companyId, ambulanceId);
    res.status(200).json(list);
  } catch (error) {
    handleError(
      error,
      res,
      "Error al listar órdenes de trabajo",
      "❌ listWorkOrders:",
    );
  }
};

export const getWorkOrderById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const doc = await getMechanicsWorkOrderById(req.companyId, id);
    if (!doc) {
      res.status(404).json({ message: "Orden no encontrada" });
      return;
    }
    res.status(200).json(doc);
  } catch (error) {
    handleError(
      error,
      res,
      "Error al obtener la orden",
      "❌ getWorkOrderById:",
    );
  }
};

export const patchWorkOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const role = req.userRole ?? "";
    const userId = req.userId ?? "";

    if (role === "mecanico") {
      const parsed = patchMechanicsWorkOrderMechanicSchema.safeParse(req.body);
      if (!parsed.success) {
        const msg = parsed.error.issues.map((e) => e.message).join("; ");
        res.status(400).json({ message: msg || "Datos inválidos" });
        return;
      }
      const doc = await patchMechanicsWorkOrderByMechanic(
        req.companyId,
        userId,
        id,
        parsed.data,
      );
      res.status(200).json(doc);
      return;
    }

    if (role === "admin" || role === "jefe_mecanicos") {
      const parsed = patchMechanicsWorkOrderAdminSchema.safeParse(req.body);
      if (!parsed.success) {
        const msg = parsed.error.issues.map((e) => e.message).join("; ");
        res.status(400).json({ message: msg || "Datos inválidos" });
        return;
      }
      const b = parsed.data;
      const doc = await patchMechanicsWorkOrderByAdmin(
        req.companyId,
        userId,
        id,
        {
          title: b.title,
          description: b.description,
          plannedFor: b.plannedFor ?? undefined,
          assignedTo: b.assignedTo,
          status: b.status,
          completionNotes: b.completionNotes,
        },
      );
      res.status(200).json(doc);
      return;
    }

    res.status(403).json({ message: "Acceso denegado" });
  } catch (error) {
    handleError(
      error,
      res,
      "Error al actualizar la orden",
      "❌ patchWorkOrder:",
    );
  }
};
