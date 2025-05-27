import axios from './axios';
import type { UserRef } from '../types/dienst';

export const getAllUsers = async (token: string): Promise<UserRef[]> => {
  const response = await axios.get<UserRef[]>('/users', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};
