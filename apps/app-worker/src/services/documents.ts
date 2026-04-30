import { apiRequest } from "./http";

export type WorkerDocumentDelivery = {
  deliveryId: string;
  documentId: string;
  originalName: string;
  filename: string;
  mimeType: string;
  createdAt: string;
  uploadBatchId: string | null;
  requiresAcknowledgment: boolean;
  sentAt: string;
  readAt: string | null;
  acknowledgedAt: string | null;
};

export async function getMyDocumentDeliveries(): Promise<WorkerDocumentDelivery[]> {
  const response = await apiRequest<{ deliveries: WorkerDocumentDelivery[] }>(
    "/documents/mine",
    {
      method: "GET",
      requiresAuth: true,
    },
  );
  return response.deliveries;
}

export async function markDocumentDeliveryAsRead(
  deliveryId: string,
): Promise<{ deliveryId: string; readAt: string }> {
  return apiRequest<{ deliveryId: string; readAt: string }>(
    `/documents/deliveries/${deliveryId}/read`,
    {
      method: "PATCH",
      requiresAuth: true,
    },
  );
}

export async function acknowledgeDocumentDelivery(
  deliveryId: string,
  password: string,
): Promise<{ deliveryId: string; readAt: string | null; acknowledgedAt: string }> {
  return apiRequest<{ deliveryId: string; readAt: string | null; acknowledgedAt: string }>(
    `/documents/deliveries/${deliveryId}/acknowledge`,
    {
      method: "POST",
      requiresAuth: true,
      body: JSON.stringify({ password }),
    },
  );
}
