import type { UserRef } from "../../modules/diensts";
import { UsersApi } from "../../modules/users";

/**
 * Si selectedId existe y no está en la lista, pide el usuario por ID y lo inyecta.
 * Mantiene el comportamiento actual del modal.
 */
export const ensureSelectedPresent = async (
  list: UserRef[],
  selectedId: string | undefined,
  token: string,
): Promise<UserRef[]> => {
  if (!selectedId) return list;
  if (list.some((u) => u._id === selectedId)) return list;

  try {
    const u = await UsersApi.getUserById(token, selectedId);
    const asRef: UserRef = {
      _id: u._id,
      name: u.name,
      lastName: u.lastName,
      ambulanceRole: u.ambulanceRole,
      pscheinExpiry: u.pscheinExpiry,
    };
    return [asRef, ...list];
  } catch {
    return list;
  }
};
