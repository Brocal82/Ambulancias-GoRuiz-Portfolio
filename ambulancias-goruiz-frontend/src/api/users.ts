import axios from './axios';
import type { UserRef } from '../types/dienst';

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

export const getAvailableUsersForDate = async (date: string, token: string): Promise<UserRef[]> => {
  const response = await axios.get(`/users/available?date=${date}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

