// frontend/src/api/users.ts
import api from './axios';
import type { User } from '../types/user';

// ✅ Obtener todos los usuarios completos (para Admin)
export const getAllUsers = async (token: string): Promise<User[]> => {
  try {
    const response = await api.get<User[]>('/users', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    throw error;
  }
};

// ✅ Obtener usuarios disponibles por fecha, rol y (opcional) horas para evitar solapes
export const getAvailableUsersForDate = async (
  date: string,
  desiredRole: 'driver' | 'medic' | 'both',
  token: string,
  opts?: { startTime?: string; endTime?: string; includeExpired?: boolean }
): Promise<User[]> => {
  const response = await api.get(`/users/available`, {
    headers: { Authorization: `Bearer ${token}` },
    params: {
      date,
      desiredRole,
      startTime: opts?.startTime,
      endTime: opts?.endTime,
      includeExpired: opts?.includeExpired ? 'true' : undefined,
    },
  });
  return response.data;
};

// ✅ Obtener usuario por id
export const getUserById = async (token: string, userId: string): Promise<User> => {
  try {
    const response = await api.get<User>(`/users/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error('Error al obtener el perfil:', error);
    throw error;
  }
};

// ✅ Actualizar perfil de usuario (sin sobreescribir profileImage si no viene)
export const updateUserProfile = async (
  userId: string,
  updatedData: Partial<User>,
  token: string
): Promise<User> => {
  try {
    const response = await api.patch<User>(`/users/${userId}`, updatedData, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error('Error al actualizar el perfil:', error);
    throw error;
  }
};

// ✅ Eliminar usuario
export const deleteUser = async (userId: string, token: string): Promise<void> => {
  await api.delete(`/users/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

// ✅ Eliminar documento del usuario (DELETE con body)
export const deleteUserDocument = async (
  filePath: string,
  token: string
): Promise<{ documents: string[] }> => {
  const response = await api.delete('/users/me/document', {
    headers: { Authorization: `Bearer ${token}` },
    data: { filePath },
  });
  return response.data;
};

/**
 * ✅ Subir archivos del usuario (perfil: imagen + documentos) con FormData
 * - Reutilizable desde Profile y desde cualquier otra página (p.ej., Sick Leaves si quisieras)
 * - NO establezcas manualmente 'Content-Type': axios lo hace al enviar FormData (incluye boundary)
 */
export const uploadUserFiles = async (
  token: string,
  files: {
    profileImage?: File | null;
    documents?: FileList | File[] | null;
  }
): Promise<{ profileImage?: string; documents?: string[] }> => {
  const form = new FormData();

  if (files.profileImage) {
    form.append('profileImage', files.profileImage);
  }

  if (files.documents) {
    const docsArray = Array.isArray(files.documents)
      ? files.documents
      : Array.from(files.documents);
    docsArray.forEach((doc) => form.append('documents', doc));
  }

  const response = await api.post<{ profileImage?: string; documents?: string[] }>(
    '/users/me/upload',
    form,
    {
      headers: { Authorization: `Bearer ${token}` },
      // No pongas 'Content-Type': axios lo infiere con boundary al mandar FormData
    }
  );

  return response.data;
};
