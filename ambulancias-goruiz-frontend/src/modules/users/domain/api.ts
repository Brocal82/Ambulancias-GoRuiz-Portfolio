// frontend/src/modules/users/domain/api.ts
import api from "../../../api/axios";
import type { User } from "./types";
import type { UpdateUserPayload, UploadUserFilesPayload } from "./payloads";



// ✅ Obtener todos los usuarios completos (para Admin)
export const getAllUsers = async (token: string): Promise<User[]> => {
  const response = await api.get<User[]>("/users");
  return response.data;
};

// ✅ Obtener usuarios disponibles por fecha
export const getAvailableUsersForDate = async (
  date: string,
  desiredRole: "driver" | "medic" | "both",
  token: string,
  opts?: { startTime?: string; endTime?: string; includeExpired?: boolean },
): Promise<User[]> => {
  const response = await api.get<User[]>("/users/available", {
    headers: { Authorization: `Bearer ${token}` },
    params: {
      date,
      desiredRole,
      startTime: opts?.startTime,
      endTime: opts?.endTime,
      includeExpired: opts?.includeExpired ? "true" : undefined,
    },
  });
  return response.data;
};

export const getUserById = async (
  token: string,
  userId: string,
): Promise<User> => {
  const response = await api.get<User>(`/users/${userId}`);
  return response.data;
};

export const updateUserProfile = async (
  userId: string,
  updatedData: UpdateUserPayload,
  token: string,
): Promise<User> => {

  const response = await api.patch<User>(`/users/${userId}`, updatedData, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const deleteUser = async (
  userId: string,
  token: string,
): Promise<void> => {
  await api.delete(`/users/${userId}`);
};

export const deleteUserDocument = async (
  filePath: string,
  token: string,
): Promise<{ documents: string[] }> => {
  const response = await api.delete("/users/me/document", {
    headers: { Authorization: `Bearer ${token}` },
    data: { filePath },
  });
  return response.data;
};

export const uploadUserFiles = async (
  token: string,
  files: UploadUserFilesPayload,
): Promise<{ profileImage?: string; documents?: string[] }> => {
  const form = new FormData();

  if (files.profileImage) form.append("profileImage", files.profileImage);

  if (files.documents) {
    const docsArray = Array.isArray(files.documents)
      ? files.documents
      : Array.from(files.documents);
    docsArray.forEach((doc) => form.append("documents", doc));
  }

  const response = await api.post("/users/me/upload", form, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return response.data;
};

