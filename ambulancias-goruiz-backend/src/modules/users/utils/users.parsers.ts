import type { UpdateUserDTO } from "./users.payloads";
import type { CreateUserDTO } from "./users.payloads";

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

/**
 * Extrae SOLO campos permitidos para UpdateUser.
 * No valida reglas (eso lo hace el service), aquí solo limpiamos shape.
 */
export function parseUpdateUserDTO(body: any): Partial<UpdateUserDTO> {
  return {
    name: asString(body?.name) ?? "",
    lastName: asString(body?.lastName),
    email: asString(body?.email) ?? "",

    ambulanceRole: asString(body?.ambulanceRole) as any,
    address: asString(body?.address),
    phone: asString(body?.phone),
    emergencyPhone: asString(body?.emergencyPhone),
    pscheinExpiry: asString(body?.pscheinExpiry),
    profileImage: asString(body?.profileImage),
  };
}

export function parseCreateUserDTO(body: any): CreateUserDTO {
  return {
    name: (typeof body?.name === "string" ? body.name : "").trim(),
    lastName: (typeof body?.lastName === "string" ? body.lastName : "").trim(),
    email: (typeof body?.email === "string" ? body.email : "").trim(),
    password: typeof body?.password === "string" ? body.password : "",
    role:
      body?.role === "admin" || body?.role === "worker"
        ? body.role
        : undefined,
  };
}
