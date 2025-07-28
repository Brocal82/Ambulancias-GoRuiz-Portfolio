// frontend/src/api/messages.ts
import axios from './axios';
import type { Message } from '../types/message';

// ✅ Obtener todos los mensajes del trabajador autenticado
export const getMyMessages = async (token: string): Promise<Message[]> => {
  const response = await axios.get('/messages', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

// ✅ Enviar un mensaje (solo admin)
export const sendMessage = async (
  token: string,
  messageData: {
    subject: string;
    body: string;
    recipients: string[]; // uno o varios IDs de usuarios
    toAllWorkers?: boolean; // ← ✅ nuevo campo opcional
  }
): Promise<Message> => {
  const response = await axios.post('/messages', messageData, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

// ✅ Obtener mensajes enviados por el admin (solo mensajes masivos)
export const getSentMessages = async (token: string): Promise<Message[]> => {
  const response = await axios.get('/messages/sent', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

