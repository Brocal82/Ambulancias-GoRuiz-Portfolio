import { Request, Response } from "express";
import mongoose from "mongoose";
import { Notification } from "../models/Notifications";

type Role = "admin" | "worker";

function toBool(v: any, defaultValue = false) {
  if (v === undefined) return defaultValue;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.toLowerCase() === "true";
  return !!v;
}

// ✔️ Importante: Promise<void> y nunca devolver Response
export const getNotifications = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    // Tu middleware guarda en req.userId y req.userRole
    const authUserId = req.userId;
    const authUserRole = req.userRole as Role | undefined;

    const queryUserId = (req.query.userId as string) || authUserId;
    const queryRole = (req.query.role as Role) || authUserRole;
    const unreadOnly = toBool(req.query.unreadOnly, false);
    const type = (req.query.type as string | undefined) || undefined;

    const page = Math.max(parseInt((req.query.page as string) || "1", 10), 1);
    const limit = Math.max(
      parseInt((req.query.limit as string) || "10", 10),
      1,
    );
    const skip = (page - 1) * limit;

    const filter: any = {};
    const ors: any[] = [];

    if (queryUserId && mongoose.Types.ObjectId.isValid(queryUserId)) {
      ors.push({ recipientId: new mongoose.Types.ObjectId(queryUserId) });
    }
    if (queryRole) {
      ors.push({ role: queryRole });
    }
    if (ors.length > 0) {
      filter.$or = ors;
    }

    if (unreadOnly) filter.isRead = false;
    if (type) filter.type = type;

    const [items, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
    ]);

    res.json({
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
    return;
  } catch (err) {
    console.error("getNotifications error", err);
    res.status(500).json({ message: "Error obteniendo notificaciones" });
    return;
  }
};

// ✔️ Promise<void>, validar IDs y no devolver Response
export const postNotification = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { title, message, recipientId, role, type } = req.body as {
      title?: string;
      message?: string;
      recipientId?: string;
      role?: Role;
      type?: string;
    };

    if (!title || !message) {
      res.status(400).json({ message: "title y message son obligatorios" });
      return;
    }
    if (!recipientId && !role) {
      res.status(400).json({ message: "Debes especificar recipientId o role" });
      return;
    }
    if (recipientId && !mongoose.Types.ObjectId.isValid(recipientId)) {
      res.status(400).json({ message: "recipientId inválido" });
      return;
    }

    const created = await Notification.create({
      title,
      message,
      recipientId: recipientId
        ? new mongoose.Types.ObjectId(recipientId)
        : undefined,
      role,
      type,
    });

    res.status(201).json(created.toObject());
    return;
  } catch (err) {
    console.error("postNotification error", err);
    res.status(500).json({ message: "Error creando notificación" });
    return;
  }
};

// ✔️ Promise<void>, filtrar por pertenencia, no devolver Response
export const patchNotificationRead = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: "ID inválido" });
      return;
    }

    const userId = req.userId;
    const userRole = req.userRole as Role | undefined;

    const filter: any = { _id: new mongoose.Types.ObjectId(id) };
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      filter.$or = [
        { recipientId: new mongoose.Types.ObjectId(userId) },
        ...(userRole ? [{ role: userRole }] : []),
      ];
    } else if (userRole) {
      filter.role = userRole;
    }

    const updated = await Notification.findOneAndUpdate(
      filter,
      { isRead: true },
      { new: true },
    ).lean();

    if (!updated) {
      res
        .status(404)
        .json({ message: "Notificación no encontrada o no autorizada" });
      return;
    }

    res.json(updated);
    return;
  } catch (err) {
    console.error("patchNotificationRead error", err);
    res.status(500).json({ message: "Error marcando como leída" });
    return;
  }
};
