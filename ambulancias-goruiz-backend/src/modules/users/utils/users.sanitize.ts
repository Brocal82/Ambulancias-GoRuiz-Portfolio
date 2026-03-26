import type { IUser } from "../types/user.types";

/**
 * Devuelve una versión segura del usuario para enviar al frontend.
 * Regla: NUNCA incluir password.
 */
export function sanitizeUser(user: any) {
  if (!user) return user;

  // Si viene de mongoose doc, toObject puede existir
  const u = typeof user.toObject === "function" ? user.toObject() : user;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, __v, ...safe } = u;

  if (safe.pscheinConfirmedAt instanceof Date) {
    (safe as Record<string, unknown>).pscheinConfirmedAt =
      safe.pscheinConfirmedAt.toISOString();
  }
  if (safe.pscheinConfirmedBy != null) {
    (safe as Record<string, unknown>).pscheinConfirmedBy = String(
      safe.pscheinConfirmedBy,
    );
  }

  return safe;
}

export function sanitizeUsers(users: any[]) {
  return (users || []).map(sanitizeUser);
}
