import axios from './axios';
import type { UserRef } from '../types/dienst';
import type { User } from '../types/user';

export const getAllUsers = async (token: string): Promise<UserRef[]> => {
  try {
    const response = await axios.get<UserRef[]>('/users', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    throw error;
  }
};

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

