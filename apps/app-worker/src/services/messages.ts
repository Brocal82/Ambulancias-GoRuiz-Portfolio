import { apiRequest } from "./http";

export type MessageAttachment = {
  originalName: string;
  filename: string;
  mimetype: string;
  size: number;
  url: string;
};

export type MessageSender = {
  _id: string;
  name: string;
  lastName: string;
};

export type WorkerMessage = {
  _id: string;
  subject: string;
  body: string;
  sender: MessageSender;
  recipients: string[];
  sentAt: string;
  readBy: string[];
  toAllWorkers?: boolean;
  attachments?: MessageAttachment[];
};

type GetMyMessagesOptions = {
  unreadOnly?: boolean;
};

export async function getMyMessages(
  options: GetMyMessagesOptions = {},
): Promise<WorkerMessage[]> {
  const unreadOnly = options.unreadOnly ?? true;
  const query = `?unreadOnly=${encodeURIComponent(String(unreadOnly))}`;
  return apiRequest<WorkerMessage[]>(`/messages${query}`, {
    method: "GET",
    requiresAuth: true,
  });
}

export async function markMessageAsRead(messageId: string): Promise<void> {
  await apiRequest(`/messages/${messageId}/read`, {
    method: "PATCH",
    requiresAuth: true,
  });
}

export async function deleteMessageForUser(messageId: string): Promise<void> {
  await apiRequest(`/messages/${messageId}/remove`, {
    method: "PATCH",
    requiresAuth: true,
  });
}
