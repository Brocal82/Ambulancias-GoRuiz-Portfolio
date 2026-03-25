import User from "../models/user.model";
import { Dienst } from "../../diensts";
import { DateTime } from "luxon";
import mongoose from "mongoose";
import VacationRequest from "../../vacation/models/vacation-request.model";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../../../config/env";
import type {
  CreateUserDTO,
  LoginDTO,
  LoginResponseDTO,
} from "../utils/users.payloads";
import { validateEmail } from "../utils/users.validators";

const ZONE = "Europe/Berlin";

export type DesiredRole = "driver" | "medic" | "both";

export interface GetAvailableUsersParams {
  date: string; // YYYY-MM-DD
  desiredRole: DesiredRole;
  startTime?: string; // "HH:mm"
  endTime?: string; // "HH:mm"
  includeExpired?: boolean; // incluir P-Schein caducados en respuesta (driver)
  companyId?: string | null; // filtrar users por empresa
}

function toMin(hhmm?: string): number | null {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function overlap(
  aStartMin: number | null,
  aEndMin: number | null,
  bStartMin: number | null,
  bEndMin: number | null,
) {
  const Astart = aStartMin ?? 0;
  const Aend = aEndMin ?? 24 * 60;
  const Bstart = bStartMin ?? 0;
  const Bend = bEndMin ?? 24 * 60;
  return Astart < Bend && Bstart < Aend;
}

export async function getAvailableUsersForDateService(
  params: GetAvailableUsersParams,
) {
  const { date, desiredRole, startTime, endTime, includeExpired, companyId } = params;

  const allowedRoles =
    desiredRole === "driver"
      ? ["driver", "both"]
      : desiredRole === "medic"
        ? ["medic", "both"]
        : ["driver", "medic", "both"];

  const sReq = toMin(startTime);
  const eReq = toMin(endTime);

  const dienstFilter: Record<string, unknown> = { "assignments.date": date };
  if (companyId) {
    dienstFilter.companyId = new mongoose.Types.ObjectId(companyId);
  } else {
    dienstFilter.$or = [{ companyId: null }, { companyId: { $exists: false } }];
  }
  const diensts = await Dienst.find(dienstFilter, { assignments: 1 }).lean();

  const busyUserIds = new Set<string>();

  for (const d of diensts as any[]) {
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

  const userFilter: Record<string, unknown> = {
    _id: { $nin: Array.from(busyUserIds) },
    ambulanceRole: { $in: allowedRoles },
  };
  if (companyId) {
    userFilter.companyId = new mongoose.Types.ObjectId(companyId);
  } else {
    userFilter.$or = [
      { companyId: null },
      { companyId: { $exists: false } },
    ];
  }
  const baseUsers = await User.find(userFilter)
    .sort({ lastName: 1 })
    .lean();

  const dateObj = DateTime.fromISO(date, { zone: ZONE }).startOf("day");

  const available = (baseUsers as any[]).filter((u) => {
    if (desiredRole !== "driver") return true;
    if (includeExpired) return true;

    const exp = u.pscheinExpiry
      ? DateTime.fromISO(u.pscheinExpiry, { zone: ZONE })
      : null;

    return !exp || exp.endOf("day") >= dateObj;
  });

  return available;
}

// Helper: devuelve si el usuario está de vacaciones HOY y hasta cuándo
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

/**
 * Devuelve usuarios ordenados + flags de vacaciones HOY (no cambia el shape).
 * Si companyId se proporciona, filtra solo usuarios de esa empresa.
 */
export async function getUsersWithTodayVacationInfo(companyId?: string) {
  const filter = companyId
    ? { companyId: new mongoose.Types.ObjectId(companyId) }
    : {};
  const users = await User.find(filter).sort({ lastName: 1 }).lean();

  await Promise.all(
    (users as any[]).map(async (u) => {
      const info = await getTodayVacationInfo(String(u._id));
      u.isOnVacation = info.isOnVacation;
      if (info.isOnVacation) {
        u.vacationUntil = info.vacationUntil;
      }
    }),
  );

  return users;
}

interface UpdateUserInput {
  name?: string;
  lastName?: string;
  email?: string;
  ambulanceRole?: "driver" | "medic" | "both";
  address?: string;
  phone?: string;
  emergencyPhone?: string;
  pscheinExpiry?: string;
  profileImage?: string;
  employeeNumber?: string;
}

export async function updateUserService(
  userId: string,
  data: UpdateUserInput,
) {
  if (!userId) {
    throw new Error("ID de usuario no proporcionado");
  }

  // Solo validar campos que vienen en el update (PATCH parcial)
  if (data.name !== undefined) {
    if (!data.name || !data.name.trim()) {
      throw new Error("El nombre es obligatorio cuando se envía");
    }
  }
  if (data.email !== undefined) {
    if (!data.email || !data.email.trim()) {
      throw new Error("El email es obligatorio cuando se envía");
    }
    if (!validateEmail(data.email)) {
      throw new Error("El formato del email no es válido");
    }
  }

  const updates: Record<string, any> = { ...data };

  // Control explícito de profileImage
  if (data.profileImage === "") {
    updates.profileImage = "";
  } else if (data.profileImage === undefined) {
    delete updates.profileImage;
  }

  const updatedUser = await User.findByIdAndUpdate(userId, updates, {
    new: true,
    runValidators: true,
  });

  if (!updatedUser) {
    throw new Error("Usuario no encontrado");
  }

  return updatedUser;
}

export async function getUserByIdService(userId: string) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("ID de usuario no válido");
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new Error("Usuario no encontrado");
  }

  return user;
}

export async function createUserService(data: CreateUserDTO) {
  const { name, lastName, email, password } = data;
  const role = "worker"; // Siempre worker en registro público. Nunca leer role del cliente.

  if (!name || !lastName || !email) {
    throw new Error("Nombre, apellidos y email son obligatorios");
  }

  if (!password || password.length < 6) {
    throw new Error(
      "La contraseña es obligatoria y debe tener al menos 6 caracteres",
    );
  }

  if (!validateEmail(email)) {
    throw new Error("El formato del email no es válido");
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new Error("Ya existe un usuario con ese email");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = new User({
    name,
    lastName,
    email,
    password: hashedPassword,
    role,
  });

  await newUser.save();
  return newUser;
}

export async function loginUserService(
  data: LoginDTO,
): Promise<LoginResponseDTO> {
  const { email, password } = data;

  if (!email || !password) {
    throw new Error("Email y contraseña son obligatorios");
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new Error("Usuario no encontrado");
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new Error("Contraseña incorrecta");
  }

  const payload: Record<string, unknown> = {
    userId: user._id,
    email: user.email,
    role: user.role,
  };
  if (user.companyId) {
    payload.companyId = String(user.companyId);
  }

  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: "1h" });

  const userResponse: LoginResponseDTO["user"] = {
    _id: String(user._id),
    name: user.name,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    ambulanceRole: user.ambulanceRole,
    pscheinExpiry: user.pscheinExpiry,
    address: user.address,
    phone: user.phone,
    emergencyPhone: user.emergencyPhone,
    profileImage: user.profileImage,
  };
  if (user.companyId) {
    userResponse.companyId = String(user.companyId);
  }

  return {
    message: "Login exitoso",
    token,
    user: userResponse,
  };
}

export async function deleteUserService(userId: string) {
  const deletedUser = await User.findByIdAndDelete(userId);

  if (!deletedUser) {
    throw new Error("Usuario no encontrado");
  }

  return deletedUser;
}
