import api from "../../../api/axios";
import type { WorkerDocumentDelivery } from "./types";

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
