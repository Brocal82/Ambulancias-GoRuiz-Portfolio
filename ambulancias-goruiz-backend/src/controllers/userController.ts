//backend/src/controllers/userController.ts
import { Request, Response, RequestHandler } from "express";
import User from "../models/User";
import { IUser } from "../types/User";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Dienst from "../models/Dienst";
import mongoose from "mongoose";
import { DateTime } from "luxon";
import VacationRequest from "../models/vacationRequest";
import { isOnVacationDay } from "../utils/dienstValidation";

const ZONE = "Europe/Berlin";

// 🔎 Helper: devuelve si el usuario está de vacaciones HOY y hasta cuándo
async function getTodayVacationInfo(userId?: string) {
  if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
    return {
      isOnVacation: false as const,
      vacationUntil: undefined as string | undefined,
    };
  }
  const now = DateTime.now().setZone(ZONE);
  const startOfToday = now.startOf("day").toJSDate();
  const endOfToday = now.endOf("day").toJSDate();

  const vac = await VacationRequest.findOne({
    user: new mongoose.Types.ObjectId(userId),
    status: "accepted",
    startDate: { $lte: endOfToday },
    endDate: { $gte: startOfToday },
  })
    .select("endDate")
    .lean();

  if (!vac) {
    return { isOnVacation: false as const, vacationUntil: undefined };
  }
  return {
    isOnVacation: true as const,
    vacationUntil: new Date(vac.endDate).toISOString(),
  };
}

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
    // Traemos usuarios ordenados como ya hacías
    const users = await User.find().sort({ lastName: 1 }).lean();

    // Para cada usuario, añadimos flags de vacaciones HOY (no rompe el shape)
    await Promise.all(
      users.map(async (u: any) => {
        const info = await getTodayVacationInfo(String(u._id));
        u.isOnVacation = info.isOnVacation;
        if (info.isOnVacation) {
          u.vacationUntil = info.vacationUntil;
        }
      }),
    );

    res.status(200).json(users);
  } catch (error) {
    console.error("❌ Error al obtener usuarios:", error);
    res.status(500).json({ message: "Error al obtener usuarios" });
  }
};

// ✅ updateUser como función async que devuelve void
export const updateUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = req.params.id || req.user?.id;

  if (!userId) {
    res.status(400).json({ message: "ID de usuario no proporcionado" });
    return;
  }

  const {
    name,
    lastName,
    email,
    ambulanceRole,
    address,
    phone,
    emergencyPhone,
    pscheinExpiry,
    profileImage,
  } = req.body;

  if (!name || !email) {
    res.status(400).json({ message: "El nombre y el email son obligatorios" });
    return;
  }

  if (!validateEmail(email)) {
    res.status(400).json({ message: "El formato del email no es válido" });
    return;
  }

  try {
    // 👇 Preparamos manualmente el objeto de actualización
    const updates: any = {
      name,
      lastName,
      email,
      ambulanceRole,
      address,
      phone,
      emergencyPhone,
      pscheinExpiry,
    };

    // ✅ Si viene el campo profileImage vacío, lo quitamos de la base de datos
    if (profileImage === "") {
      updates.profileImage = "";
    } else if (profileImage) {
      updates.profileImage = profileImage;
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updates, {
      new: true,
      runValidators: true,
    });

    if (!updatedUser) {
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }

    console.log("✅ Usuario actualizado:", updatedUser);
    res.status(200).json(updatedUser);
  } catch (error) {
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

    res.status(200).json(user);
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
      startTime?: string; // "HH:mm" opcional
      endTime?: string; // "HH:mm" opcional
      includeExpired?: string; // "true" para incluir P-Schein caducados en la respuesta
    };

  if (!date || typeof date !== "string") {
    res.status(400).json({ message: "Fecha inválida" });
    return;
  }

  const includeExpiredBool = String(includeExpired).toLowerCase() === "true";

  const allowedRoles =
    desiredRole === "driver"
      ? ["driver", "both"]
      : desiredRole === "medic"
        ? ["medic", "both"]
        : ["driver", "medic", "both"];

  const toMin = (hhmm?: string) => {
    if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return null;
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };
  const sReq = toMin(startTime);
  const eReq = toMin(endTime);

  const overlap = (
    aStartMin: number | null,
    aEndMin: number | null,
    bStartMin: number | null,
    bEndMin: number | null,
  ) => {
    const Astart = aStartMin ?? 0;
    const Aend = aEndMin ?? 24 * 60;
    const Bstart = bStartMin ?? 0;
    const Bend = bEndMin ?? 24 * 60;
    return Astart < Bend && Bstart < Aend;
  };

  try {
    const diensts = await Dienst.find(
      { "assignments.date": date },
      { assignments: 1 },
    ).lean();

    const busyUserIds = new Set<string>();

    for (const d of diensts) {
      for (const a of d.assignments ?? []) {
        if (a.date !== date) continue;

        const aStart = toMin(a.startTime);
        const aEnd = toMin(a.endTime);

        const shouldBlock =
          sReq === null || eReq === null
            ? true
            : overlap(aStart, aEnd, sReq, eReq);

        if (shouldBlock) {
          if (a.driver) busyUserIds.add(String(a.driver));
          if (a.medic) busyUserIds.add(String(a.medic));
        }
      }
    }

    const baseUsers = await User.find({
      _id: { $nin: Array.from(busyUserIds) },
      ambulanceRole: { $in: allowedRoles },
    })
      .sort({ lastName: 1 })
      .lean();

    const dateObj = DateTime.fromISO(date, { zone: ZONE }).startOf("day");

    const available = baseUsers.filter((u: any) => {
      if (desiredRole !== "driver") return true;
      if (includeExpiredBool) return true; // ⬅️ permitir caducados para que la UI los muestre atenuados
      const exp = u.pscheinExpiry
        ? DateTime.fromISO(u.pscheinExpiry, { zone: ZONE })
        : null;
      return !exp || exp.endOf("day") >= dateObj;
    });

    res.json(available);
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
