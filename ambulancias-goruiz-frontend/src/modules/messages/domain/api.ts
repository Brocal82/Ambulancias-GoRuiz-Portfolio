// frontend/src/api/messages.ts
import axios from "../../../api/axios";
import type { Message } from "../../../types/message";

// ✅ Obtener mensajes del trabajador autenticado
//    - unreadOnly: true (por defecto) → solo no leídos
//    - unreadOnly: false → TODOS (leídos + no leídos)
export const getMyMessages = async (
  token: string,
  opts?: { unreadOnly?: boolean },
): Promise<Message[]> => {
  const unreadOnly = opts?.unreadOnly ?? true;
  const response = await axios.get<Message[]>("/messages", {
    headers: { Authorization: `Bearer ${token}` },
    params: { unreadOnly: String(unreadOnly) },
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
  },
): Promise<Message> => {
  const response = await axios.post("/messages", messageData, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const sendMessageMultipart = async (
  token: string,
  formData: FormData,
) => {
  const res = await axios.post("/messages", formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      // OJO: NO pongas 'Content-Type' manualmente; el navegador añade el boundary.
    },
  });
  return res.data;
};

// ✅ Obtener mensajes enviados por el admin (solo mensajes masivos)
export const getSentMessages = async (token: string): Promise<Message[]> => {
  const response = await axios.get("/messages/sent", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

// ✅ Obtener mensajes que el admin ha enviado a un worker concreto
export const getMessagesForUserAsAdmin = async (
  token: string,
  userId: string,
): Promise<Message[]> => {
  const res = await axios.get<Message[]>(`/messages/user/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

// ✅ Marcar mensaje como leído o borrado (solo el usuario)
export const deleteMessageForUser = async (
  token: string,
  messageId: string,
): Promise<void> => {
  await axios.patch(`/messages/${messageId}/remove`, null, {
    headers: { Authorization: `Bearer ${token}` },
  });
};

export const deleteMessage = async (id: string, token: string) => {
  const res = await axios.delete(`/messages/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

export const markMessageAsRead = async (
  token: string,
  messageId: string,
): Promise<void> => {
  await axios.patch(`/messages/${messageId}/read`, null, {
    headers: { Authorization: `Bearer ${token}` },
  });
};
