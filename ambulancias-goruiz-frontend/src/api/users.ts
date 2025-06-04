import axios from './axios';
import type { User } from '../types/user';

// ✅ Obtener todos los usuarios completos (para Admin)
export const getAllUsers = async (token: string): Promise<User[]> => {
  try {
    const response = await axios.get<User[]>('/users', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    throw error;
  }
};

// ✅ Obtener usuarios disponibles por fecha y rol
export const getAvailableUsersForDate = async (
  date: string,
  desiredRole: 'driver' | 'medic' | 'both',
  token: string
): Promise<User[]> => {
  const response = await axios.get(`/users/available?date=${date}&desiredRole=${desiredRole}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

// ✅ Obtener perfil de usuario por ID
export const getUserById = async (userId: string, token: string): Promise<User> => {
  try {
    const response = await axios.get<User>(`/users/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error("Error al obtener el perfil:", error);
    throw error;
  }
};

// ✅ Actualizar perfil de usuario
export const updateUserProfile = async (
  userId: string,
  updatedData: Partial<User>,
  token: string
): Promise<User> => {
  try {
    const response = await axios.patch<User>(`/users/${userId}`, updatedData, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error("Error al actualizar el perfil:", error);
    throw error;
  }
};

// ✅ Eliminar usuario
export const deleteUser = async (userId: string, token: string): Promise<void> => {
  await axios.delete(`/users/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

