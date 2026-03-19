// src/modules/messages/domain/api.ts
import axios from "../../../api/axios";
import type { Message } from "./types";
// ✅ Obtener mensajes del trabajador autenticado
//    - unreadOnly: true (por defecto) → solo no leídos
//    - unreadOnly: false → TODOS (leídos + no leídos)
export const getMyMessages = async (
  opts?: { unreadOnly?: boolean },
): Promise<Message[]> => {
  const unreadOnly = opts?.unreadOnly ?? true;
  const response = await axios.get<Message[]>("/messages", {
    params: { unreadOnly: String(unreadOnly) },
  });
  return response.data;
};

// ✅ Enviar un mensaje (solo admin)
export const sendMessage = async (
  messageData: {
    subject: string;
    body: string;
    recipients: string[]; // uno o varios IDs de usuarios
    toAllWorkers?: boolean; // ← ✅ nuevo campo opcional
  },
): Promise<Message> => {
  const response = await axios.post("/messages", messageData);
  return response.data;
};

export const sendMessageMultipart = async (formData: FormData) => {
  // OJO: NO pongas 'Content-Type' manualmente; el navegador añade el boundary.
  const res = await axios.post("/messages", formData);
  return res.data;
};

// ✅ Obtener mensajes enviados por el admin (solo mensajes masivos)
export const getSentMessages = async (): Promise<Message[]> => {
  const response = await axios.get("/messages/sent");
  return response.data;
};

// ✅ Obtener mensajes que el admin ha enviado a un worker concreto
export const getMessagesForUserAsAdmin = async (
  userId: string,
): Promise<Message[]> => {
  const res = await axios.get<Message[]>(`/messages/user/${userId}`);
  return res.data;
};

// ✅ Marcar mensaje como leído o borrado (solo el usuario)
export const deleteMessageForUser = async (
  messageId: string,
): Promise<void> => {
  await axios.patch(`/messages/${messageId}/remove`, null);
};

export const deleteMessage = async (id: string) => {
  const res = await axios.delete(`/messages/${id}`);
  return res.data;
};

export const markMessageAsRead = async (
  messageId: string,
): Promise<void> => {
  await axios.patch(`/messages/${messageId}/read`, null);
};
