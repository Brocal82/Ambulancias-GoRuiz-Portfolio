import User from "../models/user.model";
import Dienst from "../../../models/Dienst";
import { DateTime } from "luxon";
import mongoose from "mongoose";
import VacationRequest from "../../vacation/models/vacation-request.model";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
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
  const { date, desiredRole, startTime, endTime, includeExpired } = params;

  const allowedRoles =
    desiredRole === "driver"
      ? ["driver", "both"]
      : desiredRole === "medic"
        ? ["medic", "both"]
        : ["driver", "medic", "both"];

  const sReq = toMin(startTime);
  const eReq = toMin(endTime);

  const diensts = await Dienst.find(
    { "assignments.date": date },
    { assignments: 1 },
  ).lean();

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

  const baseUsers = await User.find({
    _id: { $nin: Array.from(busyUserIds) },
    ambulanceRole: { $in: allowedRoles },
  })
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
 */
export async function getUsersWithTodayVacationInfo() {
  const users = await User.find().sort({ lastName: 1 }).lean();

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
  name: string;
  lastName?: string;
  email: string;
  ambulanceRole?: "driver" | "medic" | "both";
  address?: string;
  phone?: string;
  emergencyPhone?: string;
  pscheinExpiry?: string;
  profileImage?: string;
}

export async function updateUserService(
  userId: string,
  data: UpdateUserInput,
) {
  if (!userId) {
    throw new Error("ID de usuario no proporcionado");
  }

  const { name, email } = data;

  if (!name || !email) {
    throw new Error("El nombre y el email son obligatorios");
  }

  if (!validateEmail(email)) {
    throw new Error("El formato del email no es válido");
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
  const { name, lastName, email, password, role = "worker" } = data;

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

  if (role !== "admin" && role !== "worker") {
    throw new Error('Rol no válido. Debe ser "admin" o "worker"');
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

  const token = jwt.sign(
    { userId: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET as string,
    { expiresIn: "1h" },
  );

  return {
    message: "Login exitoso",
    token,
    user: {
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
    },
  };
}

export async function deleteUserService(userId: string) {
  const deletedUser = await User.findByIdAndDelete(userId);

  if (!deletedUser) {
    throw new Error("Usuario no encontrado");
  }

  return deletedUser;
}
