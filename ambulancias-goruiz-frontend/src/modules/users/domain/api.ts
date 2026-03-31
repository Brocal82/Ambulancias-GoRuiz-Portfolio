// frontend/src/modules/users/domain/api.ts
import api from "../../../api/axios";
import type { User } from "./types";
import type { UpdateUserPayload, UploadUserFilesPayload } from "./payloads";



// ✅ Obtener todos los usuarios completos (para Admin)
export const getAllUsers = async (): Promise<User[]> => {
  const response = await api.get<User[]>("/users");
  return response.data;
};

// ✅ Obtener usuarios disponibles por fecha
export const getAvailableUsersForDate = async (
  date: string,
  desiredRole: "driver" | "medic" | "both",
  opts?: { startTime?: string; endTime?: string; includeExpired?: boolean },
): Promise<User[]> => {
  const response = await api.get<User[]>("/users/available", {
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

export const getUserById = async (userId: string): Promise<User> => {
  const response = await api.get<User>(`/users/${userId}`);
  return response.data;
};

export const updateUserProfile = async (
  userId: string,
  updatedData: UpdateUserPayload,
): Promise<User> => {

  const response = await api.patch<User>(`/users/${userId}`, updatedData);
  return response.data;
};

export const deleteUser = async (userId: string): Promise<void> => {
  await api.delete(`/users/${userId}`);
};

export const deleteUserDocument = async (
  filePath: string,
): Promise<{ pscheinDocument?: string | null; pscheinExpiry?: string | null }> => {
  const response = await api.delete("/users/me/document", {
    data: { filePath },
  });
  return response.data;
};

/** Admin elimina documento de otro usuario */
export const deleteUserDocumentForUser = async (
  userId: string,
  filePath: string,
): Promise<{ pscheinDocument?: string | null; pscheinExpiry?: string | null }> => {
  const response = await api.delete(`/users/${userId}/document`, {
    data: { filePath },
  });
  return response.data;
};

export const uploadUserFiles = async (
  files: UploadUserFilesPayload,
): Promise<{ profileImage?: string; pscheinDocument?: string } & Partial<User>> => {
  const form = new FormData();

  if (files.profileImage) form.append("profileImage", files.profileImage);

  if (files.documents) {
    const docsArray = Array.isArray(files.documents)
      ? files.documents
      : Array.from(files.documents);
    docsArray.forEach((doc) => form.append("documents", doc));
  }

  const response = await api.post("/users/me/upload", form);

  return response.data;
};

/** Admin sube archivos para otro usuario (evita mezclar con perfil del admin) */
export const uploadUserFilesForUser = async (
  userId: string,
  files: UploadUserFilesPayload,
): Promise<{ profileImage?: string; pscheinDocument?: string } & Partial<User>> => {
  const form = new FormData();

  if (files.profileImage) form.append("profileImage", files.profileImage);

  if (files.documents) {
    const docsArray = Array.isArray(files.documents)
      ? files.documents
      : Array.from(files.documents);
    docsArray.forEach((doc) => form.append("documents", doc));
  }

  const response = await api.post(`/users/${userId}/upload`, form);

  return response.data;
};

