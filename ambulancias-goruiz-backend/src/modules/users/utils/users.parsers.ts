import type { UpdateUserDTO } from "./users.payloads";
import type { CreateUserDTO } from "./users.payloads";

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

/**
 * Extrae SOLO campos permitidos para UpdateUser.
 * Solo incluye campos presentes en el request.
 * - Ausente → no se incluye (PATCH parcial)
 * - profileImage: "" → borrar; undefined → no tocar
 */
export function parseUpdateUserDTO(body: any): Partial<UpdateUserDTO> {
  const result: Partial<UpdateUserDTO> = {};

  if (body?.name !== undefined) result.name = asString(body.name) ?? "";
  if (body?.lastName !== undefined) result.lastName = asString(body.lastName);
  if (body?.email !== undefined) result.email = asString(body.email) ?? "";

  if (body?.ambulanceRole !== undefined)
    result.ambulanceRole = asString(body.ambulanceRole) as UpdateUserDTO["ambulanceRole"];
  if (body?.address !== undefined) result.address = asString(body.address);
  if (body?.phone !== undefined) result.phone = asString(body.phone);
  if (body?.emergencyPhone !== undefined)
    result.emergencyPhone = asString(body.emergencyPhone);
  if (body?.pscheinExpiry !== undefined) result.pscheinExpiry = asString(body.pscheinExpiry);
  if (body?.profileImage !== undefined) result.profileImage = asString(body.profileImage) ?? "";

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
