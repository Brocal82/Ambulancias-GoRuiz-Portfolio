// backend/src/modules/users/controller.ts
import { Request, Response, RequestHandler } from "express";
import User from "../../models/User";
import { IUser } from "../../types/User";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Dienst from "../../models/Dienst";
import mongoose from "mongoose";
import { sanitizeUser, sanitizeUsers } from "./sanitize";
import { getAvailableUsersForDateService, getUsersWithTodayVacationInfo, updateUserService, getUserByIdService, createUserService, loginUserService, deleteUserService } from "./service";
import { parseUpdateUserDTO, parseCreateUserDTO } from "./parsers";


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
    console.log("✅ Usuario guardado:", newUser);
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

    console.error("❌ Error al crear usuario:", error);
    res.status(500).json({ message: "Error al crear el usuario" });
  }
};

export const getUsers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await getUsersWithTodayVacationInfo();
    res.status(200).json(sanitizeUsers(users as any[]));
  } catch (error) {
    console.error("❌ Error al obtener usuarios:", error);
    res.status(500).json({ message: "Error al obtener usuarios" });
  }
};


export const updateUser = async (req: Request, res: Response): Promise<void> => {
  const userId = req.params.id || req.user?.id;

  if (!userId) {
    res.status(400).json({ message: "ID de usuario no proporcionado" });
    return;
  }

  try {
const dto = parseUpdateUserDTO(req.body);
const updatedUser = await updateUserService(userId, dto as any);

    console.log("✅ Usuario actualizado:", updatedUser);
    res.status(200).json(sanitizeUser(updatedUser));
  } catch (error: any) {
    const msg = String(error?.message || "");

    // Mapeo de errores a status codes (sin cambiar comportamiento)
    if (msg.includes("no proporcionado") || msg.includes("obligatorios") || msg.includes("no es válido")) {
      res.status(400).json({ message: msg });
      return;
    }

    if (msg.includes("no encontrado")) {
      res.status(404).json({ message: msg });
      return;
    }

    console.error("❌ Error al actualizar usuario:", error);
    res.status(500).json({ message: "Error al actualizar el usuario" });
  }
};


export const getUserById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params;

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

    console.error("❌ Error al obtener usuario:", error);
    res.status(500).json({ message: "Error al obtener el usuario" });
  }
};

export const deleteUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params;

  try {
    await deleteUserService(id);
    res.status(200).json({ message: "Usuario eliminado correctamente" });
  } catch (error: any) {
    const msg = String(error?.message || "");

    if (msg.includes("no encontrado")) {
      res.status(404).json({ message: msg });
      return;
    }

    console.error("❌ Error al eliminar usuario:", error);
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

    if (msg.includes("no encontrado")) {
      res.status(404).json({ message: msg });
      return;
    }

    if (msg.includes("incorrecta")) {
      res.status(401).json({ message: msg });
      return;
    }

    console.error("❌ Error en login:", error);
    res.status(500).json({ message: "Error al iniciar sesión" });
  }
};


// ✅ Obtener todos los Diensts (solo para admin)
export const getAllUsersDienst = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  try {
    const diensts = await Dienst.find().populate(
      "assignments.driver assignments.medic",
    );
    res.status(200).json(diensts);
  } catch (error) {
    console.error("❌ Error al obtener diensts:", error);
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

  const role = desiredRole ?? "both";
  const includeExpiredBool = String(includeExpired).toLowerCase() === "true";

  try {
    const available = await getAvailableUsersForDateService({
      date,
      desiredRole: role,
      startTime,
      endTime,
      includeExpired: includeExpiredBool,
    });

    res.json(sanitizeUsers(available as any[]));
  } catch (error) {
    console.error("Error al obtener usuarios disponibles:", error);
    res.status(500).json({ message: "Error del servidor" });
  }
};


export const uploadUserFiles = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const files = req.files as {
      [fieldname: string]: Express.Multer.File[];
    };

    const updates: Record<string, any> = {};

    // ✅ Actualiza SOLO la nueva imagen, reemplazando la anterior
    if (files?.profileImage?.[0]) {
      updates.profileImage = `/uploads/${files.profileImage[0].filename}`;
    }

    // ✅ Si hay documentos nuevos, los acumulamos con los anteriores
    if (files?.documents?.length) {
      const existingUser = await User.findById(userId);
      const currentDocuments = existingUser?.documents || [];
      const newDocs = files.documents.map(
        (file) => `/uploads/${file.filename}`,
      );
      updates.documents = [...currentDocuments, ...newDocs];
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true },
    );

    if (!updatedUser) {
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error("❌ Error al subir archivos:", error);
    res.status(500).json({ message: "Error al subir archivos" });
  }
};

export const deleteUserDocument = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { filePath } = req.body;

    if (!filePath) {
      res.status(400).json({ message: "Ruta de documento no proporcionada" });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }

    // Filtrar documentos que no coinciden con el que se quiere eliminar
    user.documents = (user.documents || []).filter((doc) => doc !== filePath);
    await user.save();

    res
      .status(200)
      .json({
        message: "Documento eliminado correctamente",
        documents: user.documents,
      });
  } catch (error) {
    console.error("❌ Error al eliminar documento:", error);
    res.status(500).json({ message: "Error al eliminar documento" });
  }
};

