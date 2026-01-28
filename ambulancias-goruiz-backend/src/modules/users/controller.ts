// backend/src/modules/users/controller.ts
import { Request, Response, RequestHandler } from "express";
import User from "../../models/User";
import { IUser } from "../../types/User";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Dienst from "../../models/Dienst";
import mongoose from "mongoose";
import { sanitizeUser, sanitizeUsers } from "./sanitize";
import { getAvailableUsersForDateService, getUsersWithTodayVacationInfo, updateUserService } from "./service";


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
  const {
    name,
    lastName,
    email,
    password,
    role = "worker",
  } = req.body as IUser & { role?: string };

  if (!name || !lastName || !email) {
    res
      .status(400)
      .json({ message: "Nombre, apellidos y email son obligatorios" });
    return;
  }

  if (!password || password.length < 6) {
    res
      .status(400)
      .json({
        message:
          "La contraseña es obligatoria y debe tener al menos 6 caracteres",
      });
    return;
  }

  if (!validateEmail(email)) {
    res.status(400).json({ message: "El formato del email no es válido" });
    return;
  }

  if (role !== "admin" && role !== "worker") {
    res
      .status(400)
      .json({ message: 'Rol no válido. Debe ser "admin" o "worker"' });
    return;
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ message: "Ya existe un usuario con ese email" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      lastName,
      email,
      password: hashedPassword,
      role,
      // ambulanceRole se completará más adelante desde el perfil
    });

    await newUser.save();
    console.log("✅ Usuario guardado:", newUser);
    res.status(201).json(newUser);
  } catch (error) {
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
    const updatedUser = await updateUserService(userId, req.body);

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

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: "ID de usuario no válido" });
    return;
  }

  try {
    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }

    res.status(200).json(sanitizeUser(user));
  } catch (error) {
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
    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }

    res.status(200).json({ message: "Usuario eliminado correctamente" });
  } catch (error) {
    console.error("❌ Error al eliminar usuario:", error);
    res.status(500).json({ message: "Error al eliminar el usuario" });
  }
};

export const loginUser = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ message: "Email y contraseña son obligatorios" });
    return;
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ message: "Contraseña incorrecta" });
      return;
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: "1h" },
    );

    res.status(200).json({
      message: "Login exitoso",
      token,
      user: {
        _id: user._id,
        name: user.name,
        lastName: user.lastName, // 👈 Añade esto
        email: user.email,
        role: user.role,
        ambulanceRole: user.ambulanceRole,
        pscheinExpiry: user.pscheinExpiry,
        address: user.address,
        phone: user.phone,
        emergencyPhone: user.emergencyPhone,
        profileImage: user.profileImage,
      },
    });
  } catch (error) {
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

