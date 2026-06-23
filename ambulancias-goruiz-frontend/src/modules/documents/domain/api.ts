import api from "../../../api/axios";
import type { AdminDocumentDelivery, WorkerDocumentDelivery } from "./types";

// ─── Admin API ────────────────────────────────────────────────────────────────

export const listAdminDocuments = async <T = unknown>(): Promise<T[]> => {
  const res = await api.get<T[]>("/documents");
  return res.data;
};

export const uploadDocumentsBatch = async (
  formData: FormData,
): Promise<void> => {
  await api.post("/documents/upload/batch", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const deleteDocument = async (
  id: string,
): Promise<void> => {
  await api.delete(`/documents/${id}`);
};

export const deleteDocumentBatch = async (
  uploadBatchId: string,
): Promise<{ message: string; deletedCount?: number }> => {
  const res = await api.delete<{ message: string; deletedCount?: number }>(
    `/documents/batch/${uploadBatchId}`,
  );
  return res.data;
};

export const listMyDocumentDeliveries = async (): Promise<
  WorkerDocumentDelivery[]
> => {
  const res = await api.get<{ deliveries: WorkerDocumentDelivery[] }>(
    "/documents/mine",
  );
  return res.data.deliveries;
};

export const markMyDocumentDeliveryRead = async (
  deliveryId: string,
): Promise<{ deliveryId: string; readAt: string }> => {
  const res = await api.patch<{ deliveryId: string; readAt: string }>(
    `/documents/deliveries/${deliveryId}/read`,
  );
  return res.data;
};

/**
 * P1.1 — Admin Evidence: fetch per-worker deliveries for a document.
 * Optional status filter: pending | opened | not_opened | acknowledged | not_acknowledged
 */
export const listDocumentDeliveries = async (
  documentId: string,
  status?: string,
): Promise<AdminDocumentDelivery[]> => {
  const params = status && status !== "all" ? `?status=${status}` : "";
  const res = await api.get<{ deliveries: AdminDocumentDelivery[] }>(
    `/documents/${documentId}/deliveries${params}`,
  );
  return res.data.deliveries;
};

export const acknowledgeMyDocumentDelivery = async (
  deliveryId: string,
  password: string,
): Promise<{
  deliveryId: string;
  readAt: string | null;
  acknowledgedAt: string;
}> => {
  const res = await api.post<{
    deliveryId: string;
    readAt: string | null;
    acknowledgedAt: string;
  }>(`/documents/deliveries/${deliveryId}/acknowledge`, { password });
  return res.data;
};
