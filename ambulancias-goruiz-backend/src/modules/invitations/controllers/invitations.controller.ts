import { Request, Response } from "express";
import mongoose from "mongoose";
import {
  createInvitationService,
  validateInvitationService,
  acceptInvitationService,
} from "../services/invitations.service";
import { sanitizeUser } from "../../users/utils/users.sanitize";

export const createInvitation = async (req: Request, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const invitedBy = req.userId;

  if (!companyId || !invitedBy) {
    res.status(403).json({
      message: "No tienes permiso para crear invitaciones. Se requiere pertenecer a una empresa.",
    });
    return;
  }

  try {
    const { email, role, expiresInDays } = req.body;

    const result = await createInvitationService({
      email,
      role,
      expiresInDays,
      companyId: new mongoose.Types.ObjectId(companyId),
      invitedBy: new mongoose.Types.ObjectId(invitedBy),
    });

    res.status(201).json({
      invitationId: result.invitationId,
      token: result.token,
      expiresAt: result.expiresAt,
      email: email.trim().toLowerCase(),
      role,
    });
  } catch (error: any) {
    const msg = String(error?.message || "");
    if (msg.includes("obligatorio") || msg.includes("Email") || msg.includes("inválido")) {
      res.status(400).json({ message: msg });
      return;
    }
    console.error("Error al crear invitación:", error);
    res.status(500).json({ message: "Error al crear la invitación" });
  }
};

export const validateInvitation = async (req: Request, res: Response): Promise<void> => {
  const token = req.query.token;
  const tokenStr = typeof token === "string" ? token : undefined;

  if (!tokenStr) {
    res.status(400).json({ valid: false, reason: "Token requerido" });
    return;
  }

  try {
    const result = await validateInvitationService(tokenStr);

    if (!result.valid) {
      res.status(200).json({ valid: false, reason: result.reason });
      return;
    }

    res.status(200).json({
      valid: true,
      email: result.email,
      role: result.role,
      companyName: result.companyName,
    });
  } catch (error) {
    console.error("Error al validar invitación:", error);
    res.status(500).json({ valid: false, reason: "Error al validar" });
  }
};

export const acceptInvitation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, name, lastName, password } = req.body;

    const newUser = await acceptInvitationService({
      token,
      name,
      lastName,
      password,
    });

    res.status(201).json(sanitizeUser(newUser));
  } catch (error: any) {
    const msg = String(error?.message || "");

    if (
      msg.includes("Token") ||
      msg.includes("Invitación") ||
      msg.includes("expirada") ||
      msg.includes("utilizada") ||
      msg.includes("revocada")
    ) {
      res.status(400).json({ message: msg });
      return;
    }
    if (msg.includes("Ya existe un usuario")) {
      res.status(409).json({ message: msg });
      return;
    }
    if (
      msg.includes("obligatorio") ||
      msg.includes("requerido") ||
      msg.includes("contraseña") ||
      msg.includes("al menos 6")
    ) {
      res.status(400).json({ message: msg });
      return;
    }

    console.error("Error al aceptar invitación:", error);
    res.status(500).json({ message: "Error al completar el registro" });
  }
};
