import axios from './axios';

export const getDienstByUser = async (userId: string) => {
  try {
    const response = await axios.get(`/diensts/user/${userId}`);
    return response.data;
  } catch (error) {
    console.error("Error al obtener los diensts del usuario:", error);
    throw error;
  }
};
