import fs from "fs";
import path from "path";
import { Request, Response, RequestHandler } from "express";
import User from "../models/user.model";
import { IUser } from "../models/user.model";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { getAllDienstsWithBasicPopulate } from "../../diensts";
import mongoose from "mongoose";
import { sanitizeUser, sanitizeUsers } from "../utils/users.sanitize";
import {
  getAvailableUsersForDateService,
  getUsersWithTodayVacationInfo,
  updateUserService,
  getUserByIdService,
  createUserService,
  loginUserService,
  deleteUserService,
} from "../services/users.service";
import {
  parseUpdateUserDTO,
  parseCreateUserDTO,
} from "../utils/users.parsers";
import {
  requireCompanyForAdmin,
  isSameCompany,
} from "../../../utils/requireCompany";

const ZONE = "Europe/Berlin";

// Función para validar el formato del email
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const createUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const dto = parseCreateUserDTO(req.body);

  try {
    const newUser = await createUserService(dto);
    res.status(201).json(sanitizeUser(newUser));
  } catch (error: any) {
    const msg = String(error?.message || "");

    // 400 para validaciones/duplicado/rol, igual que antes
    if (
      msg.includes("obligatorios") ||
      msg.includes("contraseña") ||
      msg.includes("email") ||
      msg.includes("Rol no válido") ||
      msg.includes("Ya existe un usuario")
    ) {
      res.status(400).json({ message: msg });
      return;
    }

    console.error("Error al crear usuario:", error);
    res.status(500).json({ message: "Error al crear el usuario" });
  }
};

export const getUsers = async (req: Request, res: Response): Promise<void> => {
  const companyResult = requireCompanyForAdmin(req);
  if (!companyResult.ok) {
    res.status(companyResult.statusCode).json({ message: companyResult.message });
    return;
  }
  try {
    const users = await getUsersWithTodayVacationInfo(companyResult.companyId);
    res.status(200).json(sanitizeUsers(users as any[]));
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    res.status(500).json({ message: "Error al obtener usuarios" });
  }
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
  const userId = req.params.id || req.user?.id;

  if (!userId) {
    res.status(400).json({ message: "ID de usuario no proporcionado" });
    return;
  }

  let adminCompanyId: string | undefined;
  if (req.userRole === "admin" && userId !== req.userId) {
    const companyResult = requireCompanyForAdmin(req);
    if (!companyResult.ok) {
      res.status(companyResult.statusCode).json({ message: companyResult.message });
      return;
    }
    const targetUser = await User.findById(userId).select("companyId").lean();
    if (!targetUser || !isSameCompany(targetUser.companyId, companyResult.companyId)) {
      res.status(403).json({ message: "No tienes permiso para editar este usuario" });
      return;
    }
    adminCompanyId = companyResult.companyId;
  }

  try {
    const dto = parseUpdateUserDTO(req.body);
    if (req.userRole !== "admin") {
      delete dto.employeeNumber;
      delete dto.pscheinConfirmedAt;
      delete dto.pscheinConfirmedBy;
      delete dto.pscheinDocumentPath;
    }
    if (req.userRole === "worker") {
      delete dto.ambulanceRole;
      delete dto.pscheinExpiry;
    }
    const updatedUser = await updateUserService(userId, dto, adminCompanyId);
    res.status(200).json(sanitizeUser(updatedUser));
  } catch (error: any) {
    const msg = String(error?.message || "");

    // Mapeo de errores a status codes (sin cambiar comportamiento)
    if (
      msg.includes("no proporcionado") ||
      msg.includes("obligatorios") ||
      msg.includes("no es válido")
    ) {
      res.status(400).json({ message: msg });
      return;
    }

    if (msg.includes("no encontrado")) {
      res.status(404).json({ message: msg });
      return;
    }

    if (msg.includes("permiso")) {
      res.status(403).json({ message: msg });
      return;
    }

    console.error("Error al actualizar usuario:", error);
    res.status(500).json({ message: "Error al actualizar el usuario" });
  }
};

export const getUserById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params;

  if (req.userRole === "admin" && id !== req.userId) {
    const companyResult = requireCompanyForAdmin(req);
    if (!companyResult.ok) {
      res.status(companyResult.statusCode).json({ message: companyResult.message });
      return;
    }
    const targetUser = await User.findById(id).select("companyId").lean();
    if (!targetUser || !isSameCompany(targetUser.companyId, companyResult.companyId)) {
      res.status(403).json({ message: "No tienes permiso para ver este usuario" });
      return;
    }
  }

  try {
    const user = await getUserByIdService(id);
    res.status(200).json(sanitizeUser(user));
  } catch (error: any) {
    const msg = String(error?.message || "");

    if (msg.includes("no válido")) {
      res.status(400).json({ message: msg });
      return;
    }

    if (msg.includes("no encontrado")) {
      res.status(404).json({ message: msg });
      return;
    }

    console.error("Error al obtener usuario:", error);
    res.status(500).json({ message: "Error al obtener el usuario" });
  }
};

export const deleteUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params;

  if (id === req.userId) {
    res
      .status(403)
      .json({ message: "No está permitido eliminar tu propia cuenta" });
    return;
  }

  let adminCompanyId: string | undefined;
  if (req.userRole === "admin" && id !== req.userId) {
    const companyResult = requireCompanyForAdmin(req);
    if (!companyResult.ok) {
      res.status(companyResult.statusCode).json({ message: companyResult.message });
      return;
    }
    const targetUser = await User.findById(id).select("companyId").lean();
    if (!targetUser || !isSameCompany(targetUser.companyId, companyResult.companyId)) {
      res.status(403).json({ message: "No tienes permiso para eliminar este usuario" });
      return;
    }
    adminCompanyId = companyResult.companyId;
  }

  try {
    await deleteUserService(id, adminCompanyId);
    res.status(200).json({ message: "Usuario eliminado correctamente" });
  } catch (error: any) {
    const msg = String(error?.message || "");

    if (msg.includes("no encontrado")) {
      res.status(404).json({ message: msg });
      return;
    }

    if (msg.includes("permiso")) {
      res.status(403).json({ message: msg });
      return;
    }

    console.error("Error al eliminar usuario:", error);
    res.status(500).json({ message: "Error al eliminar el usuario" });
  }
};

export const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await loginUserService(req.body);
    res.status(200).json(result);
  } catch (error: any) {
    const msg = String(error?.message || "");

    if (msg.includes("obligatorios")) {
      res.status(400).json({ message: msg });
      return;
    }

    if (msg.includes("Email o contraseña incorrectos")) {
      res.status(401).json({ message: "Email o contraseña incorrectos." });
      return;
    }

    if (msg.includes("no está asociada a una empresa")) {
      res.status(403).json({ message: msg });
      return;
    }

    console.error("Error en login:", error);
    res.status(500).json({ message: "Error al iniciar sesión" });
  }
};

// Obtener todos los Diensts (solo para admin)
export const getAllUsersDienst = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const companyResult = requireCompanyForAdmin(req);
  if (!companyResult.ok) {
    res.status(companyResult.statusCode).json({ message: companyResult.message });
    return;
  }
  try {
    const diensts = await getAllDienstsWithBasicPopulate(companyResult.companyId);
    res.status(200).json(diensts);
  } catch (error) {
    console.error("Error al obtener diensts:", error);
    res.status(500).json({ message: "Error al obtener diensts" });
  }
};

export const getAvailableUsersForDate: RequestHandler = async (
  req: Request,
  res: Response,
) => {
  const { date, desiredRole, startTime, endTime, includeExpired } =
    req.query as {
      date?: string;
      desiredRole?: "driver" | "medic" | "both";
      startTime?: string;
      endTime?: string;
      includeExpired?: string;
    };

  if (!date || typeof date !== "string") {
    res.status(400).json({ message: "Fecha inválida" });
    return;
  }

  const companyResult = requireCompanyForAdmin(req);
  if (!companyResult.ok) {
    res.status(companyResult.statusCode).json({ message: companyResult.message });
    return;
  }

  const role = desiredRole ?? "both";
  const includeExpiredBool = String(includeExpired).toLowerCase() === "true";

  try {
    const available = await getAvailableUsersForDateService({
      date,
      desiredRole: role,
      startTime,
      endTime,
      includeExpired: includeExpiredBool,
      companyId: companyResult.companyId,
    });

    res.json(sanitizeUsers(available as any[]));
  } catch (error) {
    console.error("Error al obtener usuarios disponibles:", error);
    res.status(500).json({ message: "Error del servidor" });
  }
};

/** Lógica compartida: sube archivos y actualiza el usuario indicado */
function applyUploadToUser(
  targetUserId: string,
  files: { [fieldname: string]: Express.Multer.File[] },
): Promise<any> {
  const updates: Record<string, any> = {};

  if (files?.profileImage?.[0]) {
    updates.profileImage = `/uploads/${files.profileImage[0].filename}`;
  }

  if (files?.documents?.length) {
    return User.findById(targetUserId).then((existingUser) => {
      const currentDocuments = existingUser?.documents || [];
      const newDocs = files.documents!.map(
        (file) => `/uploads/${file.filename}`,
      );
      updates.documents = [...currentDocuments, ...newDocs];
      return User.findByIdAndUpdate(
        targetUserId,
        { $set: updates },
        { new: true, runValidators: true },
      );
    });
  }

  return User.findByIdAndUpdate(
    targetUserId,
    { $set: updates },
    { new: true, runValidators: true },
  );
}

export const uploadUserFiles = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }
    const files = req.files as {
      [fieldname: string]: Express.Multer.File[];
    };

    const updatedUser = await applyUploadToUser(userId, files);

    if (!updatedUser) {
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Error al subir archivos:", error);
    res.status(500).json({ message: "Error al subir archivos" });
  }
};

/** Admin sube archivos para otro usuario (evita mezclar con perfil del admin) */
export const uploadUserFilesForUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const targetUserId = req.params.userId;
  if (!targetUserId) {
    res.status(400).json({ message: "ID de usuario no proporcionado" });
    return;
  }

  const companyResult = requireCompanyForAdmin(req);
  if (!companyResult.ok) {
    res.status(companyResult.statusCode).json({ message: companyResult.message });
    return;
  }
  const targetUser = await User.findById(targetUserId).select("companyId").lean();
  if (!targetUser || !isSameCompany(targetUser.companyId, companyResult.companyId)) {
    res.status(403).json({ message: "No tienes permiso para editar este usuario" });
    return;
  }

  try {
    const files = req.files as {
      [fieldname: string]: Express.Multer.File[];
    };

    const updatedUser = await applyUploadToUser(targetUserId, files);

    if (!updatedUser) {
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Error al subir archivos:", error);
    res.status(500).json({ message: "Error al subir archivos" });
  }
};

/** Lógica compartida: elimina documento del usuario indicado */
async function removeDocumentFromUser(
  targetUserId: string,
  filePath: string,
): Promise<{ documents: string[] } | null> {
  const user = await User.findById(targetUserId);
  if (!user) return null;

  const wasInDocuments = (user.documents || []).includes(filePath);
  user.documents = (user.documents || []).filter((doc) => doc !== filePath);

  const pscheinPath = user.pscheinDocumentPath?.trim();
  const wasInPschein = !!(pscheinPath && pscheinPath === filePath.trim());
  if (wasInPschein) {
    user.pscheinDocumentPath = undefined;
    user.pscheinConfirmedAt = undefined;
    user.pscheinConfirmedBy = undefined;
  }

  await user.save();

  if (wasInDocuments || wasInPschein) {
    const uploadsDir = path.join(__dirname, "../../../../uploads");
    const filename = path.basename(filePath);
    const absolutePath = path.join(uploadsDir, filename);
    await fs.promises.unlink(absolutePath).catch(() => {});
  }

  return { documents: user.documents };
}

export const deleteUserDocument = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }
    const { filePath } = req.body;

    if (!filePath) {
      res.status(400).json({ message: "Ruta de documento no proporcionada" });
      return;
    }

    const result = await removeDocumentFromUser(userId, filePath);
    if (!result) {
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }

    res.status(200).json({
      message: "Documento eliminado correctamente",
      documents: result.documents,
    });
  } catch (error) {
    console.error("Error al eliminar documento:", error);
    res.status(500).json({ message: "Error al eliminar documento" });
  }
};

/** Admin elimina documento de otro usuario */
export const deleteUserDocumentForUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const targetUserId = req.params.userId;
  const { filePath } = req.body;

  if (!targetUserId) {
    res.status(400).json({ message: "ID de usuario no proporcionado" });
    return;
  }
  if (!filePath) {
    res.status(400).json({ message: "Ruta de documento no proporcionada" });
    return;
  }

  const companyResult = requireCompanyForAdmin(req);
  if (!companyResult.ok) {
    res.status(companyResult.statusCode).json({ message: companyResult.message });
    return;
  }
  const targetUser = await User.findById(targetUserId).select("companyId").lean();
  if (!targetUser || !isSameCompany(targetUser.companyId, companyResult.companyId)) {
    res.status(403).json({ message: "No tienes permiso para editar este usuario" });
    return;
  }

  try {
    const result = await removeDocumentFromUser(targetUserId, filePath);
    if (!result) {
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }

    res.status(200).json({
      message: "Documento eliminado correctamente",
      documents: result.documents,
    });
  } catch (error) {
    console.error("Error al eliminar documento:", error);
    res.status(500).json({ message: "Error al eliminar documento" });
  }
};
