import { AuthUser } from "../types/auth";
import { apiRequest } from "./http";

export async function getUserById(userId: string, authToken?: string): Promise<AuthUser> {
  return apiRequest<AuthUser>(`/users/${userId}`, {
    method: "GET",
    requiresAuth: true,
    ...(authToken ? { authToken } : {}),
  });
}
