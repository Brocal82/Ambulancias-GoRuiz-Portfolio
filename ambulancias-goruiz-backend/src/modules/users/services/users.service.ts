import User from "../models/user.model";
import UserSessionState from "../models/user-session-state.model";
import { Dienst } from "../../diensts";
import { isDriverEligibleForAssignmentDate } from "../../diensts/utils/dienstValidation";
import { DateTime } from "luxon";
import mongoose from "mongoose";
import VacationRequest from "../../vacation/models/vacation-request.model";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { generateSecret, verify, generateURI } from "otplib";
import { env } from "../../../config/env";
import Company from "../../companies/models/company.model";
import type {
  CreateUserDTO,
  LoginDTO,
  LoginResponseDTO,
  UpdateUserDTO,
} from "../utils/users.payloads";
import { validateEmail } from "../utils/users.validators";
import { isSameCompany } from "../../../utils/requireCompany";

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
  const { date, desiredRole, startTime, endTime, companyId } = params;

  const companyStr = typeof companyId === "string" ? companyId.trim() : "";
  if (!companyStr || !mongoose.Types.ObjectId.isValid(companyStr)) {
    return [];
  }

  const allowedRoles =
    desiredRole === "driver"
      ? ["driver", "both"]
      : desiredRole === "medic"
        ? ["medic", "both"]
        : ["driver", "medic", "both"];

  const sReq = toMin(startTime);
  const eReq = toMin(endTime);

  const dienstFilter: Record<string, unknown> = {
    "assignments.date": date,
    companyId: new mongoose.Types.ObjectId(companyStr),
  };
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
    companyId: new mongoose.Types.ObjectId(companyStr),
  };
  const baseUsers = await User.find(userFilter)
    .sort({ lastName: 1 })
    .lean();

  const available = (baseUsers as any[]).filter((u) => {
    if (desiredRole !== "driver") return true;
    return isDriverEligibleForAssignmentDate({
      ambulanceRole: u.ambulanceRole,
      pscheinExpiry: u.pscheinExpiry,
      pscheinConfirmedAt: u.pscheinConfirmedAt,
      assignmentDateISO: date,
    });
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
  const raw = typeof companyId === "string" ? companyId.trim() : "";
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) {
    return [];
  }
  const users = await User.find({
    companyId: new mongoose.Types.ObjectId(raw),
  })
    .sort({ lastName: 1 })
    .lean();

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

export async function updateUserService(
  userId: string,
  data: Partial<UpdateUserDTO>,
  adminCompanyId?: string,
) {
  if (!userId) {
    throw new Error("ID de usuario no proporcionado");
  }

  if (adminCompanyId) {
    const target = await User.findById(userId).select("companyId").lean();
    if (!target || !isSameCompany((target as any).companyId, adminCompanyId)) {
      throw new Error("No tienes permiso para editar este usuario");
    }
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

  if (
    updates.pscheinConfirmedBy != null &&
    typeof updates.pscheinConfirmedBy === "string"
  ) {
    updates.pscheinConfirmedBy = new mongoose.Types.ObjectId(
      updates.pscheinConfirmedBy,
    );
  }

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
  const { email, password, mfaCode } = data;

  if (!email || !password) {
    throw new Error("Email y contraseña son obligatorios");
  }

  // isActive: true filter requires the backfill migration (scripts/backfill-isActive.ts)
  // to have been run before this code is deployed. Documents without the field
  // in MongoDB do NOT match { isActive: true } and would produce a generic auth
  // failure — identical to the response for unknown email, which is intentional.
  const user = await User.findOne({ email, isActive: true });
  const genericAuthFailure = "Email o contraseña incorrectos.";
  if (!user) {
    throw new Error(genericAuthFailure);
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new Error(genericAuthFailure);
  }

  if (
    (user.role === "admin" ||
      user.role === "worker" ||
      user.role === "mecanico" ||
      user.role === "jefe_mecanicos" ||
      user.role === "jefe_logistica") &&
    !user.companyId
  ) {
    throw new Error(
      "No puedes iniciar sesión: la cuenta no está asociada a una empresa.",
    );
  }

  if (
    user.role !== "superadmin" &&
    user.companyId
  ) {
    const company = await Company.findById(user.companyId).select("isActive").lean();
    if (!company || company.isActive !== true) {
      throw new Error(
        "No puedes iniciar sesión: tu empresa no está activa. Contacta con el superadmin.",
      );
    }
  }

  if (user.role === "superadmin" && env.SUPERADMIN_MFA_REQUIRED) {
    const superadmin = await User.findById(user._id)
      .select("+mfaTotpEnabled +mfaTotpSecret")
      .lean();
    const isEnabled = Boolean((superadmin as any)?.mfaTotpEnabled);
    const secret = (superadmin as any)?.mfaTotpSecret as string | undefined;
    if (!isEnabled || !secret) {
      throw new Error("MFA_NOT_ENROLLED");
    }
    if (!mfaCode || !/^\d{6}$/.test(mfaCode.trim())) {
      throw new Error("MFA_REQUIRED");
    }
    const check = await verify({ secret, token: mfaCode.trim() });
    if (!check.valid) {
      throw new Error("MFA_INVALID");
    }
  }

  const payload: Record<string, unknown> = {
    userId: user._id,
    email: user.email,
    role: user.role,
    tokenVersion: 0,
  };
  const sessionState = await UserSessionState.findOne({ userId: user._id })
    .select("tokenVersion")
    .lean();
  payload.tokenVersion = Number((sessionState as any)?.tokenVersion ?? 0);
  if (user.companyId) {
    payload.companyId = String(user.companyId);
  }

  const isPrivileged = user.role === "admin" || user.role === "superadmin";
  const expiresIn = isPrivileged ? "15m" : env.JWT_EXPIRES_IN;
  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: expiresIn as any });

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

export async function startSuperadminTotpEnrollment(userId: string) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("ID de usuario no válido");
  }
  const user = await User.findById(userId).select("email role").lean();
  if (!user) {
    throw new Error("Usuario no encontrado");
  }
  if (user.role !== "superadmin") {
    throw new Error("Solo superadmin puede configurar MFA");
  }

  const secret = generateSecret();
  const issuer = env.SUPERADMIN_MFA_ISSUER;
  const label = `${issuer}:${String(user.email)}`;
  const otpauthUrl = generateURI({
    issuer,
    label: String(user.email),
    secret,
  });

  await User.findByIdAndUpdate(userId, {
    $set: { mfaTotpPendingSecret: secret },
  });

  return { secret, issuer, label, otpauthUrl };
}

export async function confirmSuperadminTotpEnrollment(userId: string, code: string) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("ID de usuario no válido");
  }
  const user = await User.findById(userId)
    .select("role +mfaTotpPendingSecret")
    .lean();
  if (!user) {
    throw new Error("Usuario no encontrado");
  }
  if (user.role !== "superadmin") {
    throw new Error("Solo superadmin puede configurar MFA");
  }
  const pendingSecret = (user as any).mfaTotpPendingSecret as string | undefined;
  if (!pendingSecret) {
    throw new Error("No hay una configuración MFA pendiente");
  }
  const check = await verify({ secret: pendingSecret, token: code.trim() });
  if (!check.valid) {
    throw new Error("Código MFA inválido");
  }

  await User.findByIdAndUpdate(userId, {
    $set: { mfaTotpEnabled: true, mfaTotpSecret: pendingSecret },
    $unset: { mfaTotpPendingSecret: 1 },
  });
}

export async function disableSuperadminTotp(userId: string, code: string) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("ID de usuario no válido");
  }
  const user = await User.findById(userId)
    .select("role +mfaTotpSecret +mfaTotpEnabled")
    .lean();
  if (!user) {
    throw new Error("Usuario no encontrado");
  }
  if (user.role !== "superadmin") {
    throw new Error("Solo superadmin puede desactivar MFA");
  }
  const secret = (user as any).mfaTotpSecret as string | undefined;
  const enabled = Boolean((user as any).mfaTotpEnabled);
  if (!enabled || !secret) {
    throw new Error("MFA no está habilitado");
  }
  const check = await verify({ secret, token: code.trim() });
  if (!check.valid) {
    throw new Error("Código MFA inválido");
  }

  await User.findByIdAndUpdate(userId, {
    $set: { mfaTotpEnabled: false },
    $unset: { mfaTotpSecret: 1, mfaTotpPendingSecret: 1 },
  });
}

export async function getSuperadminTotpStatus(userId: string) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("ID de usuario no válido");
  }
  const user = await User.findById(userId)
    .select("role mfaTotpEnabled +mfaTotpPendingSecret")
    .lean();
  if (!user) {
    throw new Error("Usuario no encontrado");
  }
  if (user.role !== "superadmin") {
    throw new Error("Solo superadmin puede consultar MFA");
  }
  return {
    required: env.SUPERADMIN_MFA_REQUIRED,
    enabled: Boolean((user as any).mfaTotpEnabled),
    pendingSetup: Boolean((user as any).mfaTotpPendingSecret),
  };
}

export async function verifySuperadminTotpCode(userId: string, code: string) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("ID de usuario no válido");
  }
  const user = await User.findById(userId)
    .select("role +mfaTotpSecret +mfaTotpEnabled")
    .lean();
  if (!user) {
    throw new Error("Usuario no encontrado");
  }
  if (user.role !== "superadmin") {
    throw new Error("Solo superadmin puede realizar step-up");
  }
  const secret = (user as any).mfaTotpSecret as string | undefined;
  const enabled = Boolean((user as any).mfaTotpEnabled);
  if (!enabled || !secret) {
    throw new Error("MFA_NOT_ENROLLED");
  }
  if (!/^\d{6}$/.test(code.trim())) {
    throw new Error("MFA_REQUIRED");
  }
  const check = await verify({ secret, token: code.trim() });
  if (!check.valid) {
    throw new Error("MFA_INVALID");
  }
}

export async function deleteUserService(userId: string, adminCompanyId?: string) {
  if (adminCompanyId) {
    const target = await User.findById(userId).select("companyId").lean();
    if (!target || !isSameCompany((target as any).companyId, adminCompanyId)) {
      throw new Error("No tienes permiso para eliminar este usuario");
    }
  }

  const deletedUser = await User.findByIdAndDelete(userId);

  if (!deletedUser) {
    throw new Error("Usuario no encontrado");
  }

  return deletedUser;
}

export async function revokeAllSessionsForUserService(userId: string) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("ID de usuario no válido");
  }
  const userExists = await User.findById(userId).select("_id").lean();
  if (!userExists) {
    throw new Error("Usuario no encontrado");
  }
  const updated = await UserSessionState.findOneAndUpdate(
    { userId: new mongoose.Types.ObjectId(userId) },
    { $inc: { tokenVersion: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
    .select("userId tokenVersion")
    .lean();
  return updated as { userId: unknown; tokenVersion: number };
}
