import type { UpdateUserDTO } from "./users.payloads";
import type { CreateUserDTO } from "./users.payloads";
import mongoose from "mongoose";

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function parseOptionalDate(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (v instanceof Date) {
    return isNaN(v.getTime()) ? undefined : v;
  }
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return null;
    const d = new Date(t);
    return isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

/**
 * Extrae SOLO campos permitidos para UpdateUser.
 * Solo incluye campos presentes en el request.
 * - Ausente → no se incluye (PATCH parcial)
 * - profileImage: "" → borrar; undefined → no tocar
 * - email en body: ignorado (no se actualiza vía PATCH)
 */
export function parseUpdateUserDTO(body: any): Partial<UpdateUserDTO> {
  const result: Partial<UpdateUserDTO> = {};

  if (body?.name !== undefined) result.name = asString(body.name) ?? "";
  if (body?.lastName !== undefined) result.lastName = asString(body.lastName);

  if (body?.ambulanceRole !== undefined)
    result.ambulanceRole = asString(body.ambulanceRole) as UpdateUserDTO["ambulanceRole"];
  if (body?.address !== undefined) result.address = asString(body.address);
  if (body?.phone !== undefined) result.phone = asString(body.phone);
  if (body?.emergencyPhone !== undefined)
    result.emergencyPhone = asString(body.emergencyPhone);
  if (body?.pscheinExpiry !== undefined) result.pscheinExpiry = asString(body.pscheinExpiry);
  if (body?.profileImage !== undefined) result.profileImage = asString(body.profileImage) ?? "";
  if (body?.employeeNumber !== undefined)
    result.employeeNumber = asString(body.employeeNumber) ?? "";

  if (body?.pscheinDocument !== undefined) {
    if (body.pscheinDocument === null) {
      result.pscheinDocument = null;
    } else {
      const s = asString(body.pscheinDocument);
      result.pscheinDocument = s === undefined ? undefined : s.trim();
    }
  }
  if (body?.pscheinConfirmedBy !== undefined) {
    const s = asString(body.pscheinConfirmedBy)?.trim();
    if (!s) result.pscheinConfirmedBy = null;
    else if (mongoose.Types.ObjectId.isValid(s)) result.pscheinConfirmedBy = s;
  }
  if (body?.pscheinConfirmedAt !== undefined) {
    result.pscheinConfirmedAt = parseOptionalDate(body.pscheinConfirmedAt);
  }

  return result;
}

export function parseCreateUserDTO(body: any): CreateUserDTO {
  return {
    name: (typeof body?.name === "string" ? body.name : "").trim(),
    lastName: (typeof body?.lastName === "string" ? body.lastName : "").trim(),
    email: (typeof body?.email === "string" ? body.email : "").trim(),
    password: typeof body?.password === "string" ? body.password : "",
    role: "worker", // Ignorar cualquier role enviado por el cliente. Seguridad.
  };
}
