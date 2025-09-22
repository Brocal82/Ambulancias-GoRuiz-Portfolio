import axios from './axios';
import type { NotificationItem, NotificationListResponse, NotificationRole, NotificationType } from '../types/notification';

type ListParams = {
  userId?: string;
  role?: NotificationRole;
  unreadOnly?: boolean;
  page?: number;
  limit?: number;
  type?: NotificationType | string;
};

// GET /api/notifications
export async function getNotifications(params: ListParams) {
  const { data } = await axios.get<NotificationListResponse>('/notifications', { params });
  return data;
}

// POST /api/notifications
export async function createNotification(payload: Partial<NotificationItem>) {
  const { data } = await axios.post<NotificationItem>('/notifications', payload);
  return data;
}

// PATCH /api/notifications/:id/read
export async function markNotificationAsRead(id: string) {
  const { data } = await axios.patch<NotificationItem>(`/notifications/${id}/read`);
  return data;
}
