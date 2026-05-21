import User from "../models/user.model";
import UserSessionState from "../models/user-session-state.model";
import { Dienst } from "../../diensts";
import { isDriverEligibleForAssignmentDate } from "../../diensts/utils/dienstValidation";
import { DateTime } from "luxon";
import mongoose from "mongoose";
import VacationRequest from "../../vacation/models/vacation-request.model";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import speakeasy from "speakeasy";
import { env } from "../../../config/env";
import Company from "../../companies/models/company.model";
import type {
  CreateUserDTO,
  LoginDTO,
  LoginResponseDTO,
  UpdateUserDTO,
} from "../utils/users.payloads";
import { validateEmail } from "../utils/users.validators";
import {
  validatePscheinExpiryYmd,
  validatePscheinStoredDocumentPath,
} from "../utils/pschein.validation";
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

  if (data.pscheinExpiry !== undefined) {
    const raw =
      typeof data.pscheinExpiry === "string" ? data.pscheinExpiry.trim() : "";
    if (!raw) {
      updates.pscheinExpiry = "";
    } else {
      const expiryCheck = validatePscheinExpiryYmd(raw);
      if (!expiryCheck.ok) {
        throw new Error(expiryCheck.message);
      }
      updates.pscheinExpiry = expiryCheck.normalized;
    }
  }

  if (data.pscheinDocument !== undefined) {
    if (data.pscheinDocument === null) {
      updates.pscheinDocument = null;
      updates.pscheinConfirmedAt = null;
      updates.pscheinConfirmedBy = null;
      updates.pscheinExpiry = "";
    } else if (typeof data.pscheinDocument === "string") {
      const docCheck = validatePscheinStoredDocumentPath(data.pscheinDocument);
      if (!docCheck.ok) {
        throw new Error(docCheck.message);
      }
      updates.pscheinDocument = docCheck.normalized;
    }
  }

  const hasConfirmationUpdate =
    data.pscheinConfirmedAt !== undefined ||
    data.pscheinConfirmedBy !== undefined;

  if (hasConfirmationUpdate) {
    const existing = await User.findById(userId)
      .select("pscheinDocument pscheinExpiry")
      .lean();
    if (!existing) {
      throw new Error("Usuario no encontrado");
    }

    const confirming =
      data.pscheinConfirmedAt != null ||
      (typeof data.pscheinConfirmedBy === "string" &&
        data.pscheinConfirmedBy.trim() !== "");

    if (confirming) {
      const docPath =
        updates.pscheinDocument !== undefined
          ? updates.pscheinDocument
          : (existing as any).pscheinDocument;
      if (typeof docPath !== "string" || !docPath.trim()) {
        throw new Error(
          "No se puede confirmar el P-Schein sin un documento adjunto",
        );
      }

      const expiryRaw =
        updates.pscheinExpiry !== undefined
          ? String(updates.pscheinExpiry ?? "").trim()
          : String((existing as any).pscheinExpiry ?? "").trim();
      if (!expiryRaw) {
        throw new Error(
          "No se puede confirmar el P-Schein sin una fecha de caducidad válida",
        );
      }
      const expiryCheck = validatePscheinExpiryYmd(expiryRaw);
      if (!expiryCheck.ok) {
        throw new Error(expiryCheck.message);
      }
      if (updates.pscheinExpiry === undefined) {
        updates.pscheinExpiry = expiryCheck.normalized;
      }
    } else if (
      data.pscheinConfirmedAt === null &&
      data.pscheinConfirmedBy === null
    ) {
      updates.pscheinConfirmedAt = null;
      updates.pscheinConfirmedBy = null;
    }
  }

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
    const { enabled: isEnabled, secret } = await resolveSuperadminTotpMaterial(String(user._id));
    if (!isEnabled || !secret) throw new Error("MFA_NOT_ENROLLED");
    if (!mfaCode || !/^\d{6}$/.test(mfaCode.trim())) {
      throw new Error("MFA_REQUIRED");
    }
    const ok = speakeasy.totp.verify({
      secret,
      encoding: "base32",
      token: mfaCode.trim(),
      window: 1,
    });
    if (!ok) {
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

  const empRaw = (user.employeeNumber ?? "").trim();
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
    ...(empRaw.length > 0 ? { employeeNumber: empRaw } : {}),
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

async function resolveSuperadminTotpMaterial(userId: string): Promise<{
  enabled: boolean;
  secret?: string;
  pendingSecret?: string;
}> {
  const user = await User.findById(userId)
    .select("role mfaTotpEnabled +mfaTotpSecret +mfaTotpPendingSecret")
    .lean();
  if (!user) {
    throw new Error("Usuario no encontrado");
  }
  if (user.role !== "superadmin") {
    throw new Error("Solo superadmin puede realizar step-up");
  }

  const enabled = Boolean((user as any).mfaTotpEnabled);
  const secret = (user as any).mfaTotpSecret as string | undefined;
  const pendingSecret = (user as any).mfaTotpPendingSecret as string | undefined;

  // Self-heal legacy/inconsistent state: enabled=true with missing secret but
  // pending secret still present after partial enroll flows.
  if (enabled && !secret && pendingSecret) {
    await User.findByIdAndUpdate(userId, {
      $set: { mfaTotpSecret: pendingSecret, mfaTotpEnabled: true },
      $unset: { mfaTotpPendingSecret: 1 },
    });
    return { enabled: true, secret: pendingSecret };
  }

  // Inconsistent state that cannot be used for TOTP verification.
  if (enabled && !secret) {
    throw new Error("MFA_CONFIG_INVALID");
  }

  return { enabled, secret, pendingSecret };
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

  const secret = speakeasy.generateSecret().base32;
  const issuer = env.SUPERADMIN_MFA_ISSUER;
  const label = `${issuer}:${String(user.email)}`;
  const otpauthUrl = speakeasy.otpauthURL({
    secret,
    label: String(user.email),
    issuer,
    encoding: "base32",
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
  const ok = speakeasy.totp.verify({
    secret: pendingSecret,
    encoding: "base32",
    token: code.trim(),
    window: 1,
  });
  if (!ok) {
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
  const { secret, enabled } = await resolveSuperadminTotpMaterial(userId);
  if (!enabled || !secret) {
    throw new Error("MFA no está habilitado");
  }
  const ok = speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token: code.trim(),
    window: 1,
  });
  if (!ok) {
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
  const resolved = await resolveSuperadminTotpMaterial(userId);
  return {
    required: env.SUPERADMIN_MFA_REQUIRED,
    enabled: Boolean(resolved.enabled && resolved.secret),
    pendingSetup: Boolean(resolved.pendingSecret),
  };
}

export async function verifySuperadminTotpCode(userId: string, code: string) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("ID de usuario no válido");
  }
  const { secret, enabled } = await resolveSuperadminTotpMaterial(userId);
  if (!enabled || !secret) {
    throw new Error("MFA_NOT_ENROLLED");
  }
  if (!/^\d{6}$/.test(code.trim())) {
    throw new Error("MFA_REQUIRED");
  }
  const ok = speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token: code.trim(),
    window: 1,
  });
  if (!ok) {
    throw new Error("MFA_INVALID");
  }
}

type StepUpJwtPayload = {
  typ: "step_up";
  userId: string;
  role: "superadmin";
};

export async function issueSuperadminStepUpSession(userId: string, code: string) {
  await verifySuperadminTotpCode(userId, code);
  const ttlSeconds = env.STEP_UP_SESSION_TTL_SECONDS;
  const token = jwt.sign(
    { typ: "step_up", userId, role: "superadmin" } satisfies StepUpJwtPayload,
    env.JWT_SECRET,
    { expiresIn: `${ttlSeconds}s` as any },
  );
  return {
    stepUpToken: token,
    expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    ttlSeconds,
  };
}

export async function verifySuperadminStepUpSessionToken(userId: string, token: string) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("ID de usuario no válido");
  }
  const decoded = jwt.verify(token, env.JWT_SECRET) as Partial<StepUpJwtPayload>;
  if (decoded.typ !== "step_up") {
    throw new Error("STEP_UP_INVALID");
  }
  if (decoded.role !== "superadmin") {
    throw new Error("STEP_UP_INVALID");
  }
  if (String(decoded.userId ?? "") !== String(userId)) {
    throw new Error("STEP_UP_INVALID");
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
