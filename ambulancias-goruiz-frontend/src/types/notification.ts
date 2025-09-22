export type NotificationRole = 'admin' | 'worker';
export type NotificationType = 'info' | 'warning' | 'critical' | 'message' | 'report' | 'summary';

export interface NotificationItem {
  _id: string;
  title: string;
  message: string;
  recipientId?: string;      // si se envía a un usuario concreto
  role?: NotificationRole;   // si se envía a un rol entero
  isRead: boolean;
  type: NotificationType;
  createdAt: string;         // ISO
  updatedAt: string;         // ISO
}

export interface NotificationListResponse {
  items: NotificationItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
