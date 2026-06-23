/** GET /api/documents/mine — elemento de `deliveries`. */
export interface WorkerDocumentDelivery {
  deliveryId: string;
  documentId: string;
  originalName: string;
  filename: string;
  mimeType: string;
  createdAt: string;
  uploadBatchId: string | null;
  /** When false, opening/reading is enough; confirm action is hidden. */
  requiresAcknowledgment: boolean;
  sentAt: string;
  readAt: string | null;
  acknowledgedAt: string | null;
}

/**
 * P1.1 — Admin Evidence: per-worker delivery detail.
 * GET /api/documents/:documentId/deliveries
 */
export interface AdminDocumentDelivery {
  deliveryId: string;
  workerId: string;
  workerName: string;
  employeeNumber: string | null;
  sentAt: string;
  readAt: string | null;
  acknowledgedAt: string | null;
}

/** P1.2 — Filter values for the document delivery detail view. */
export type DeliveryStatusFilter =
  | "all"
  | "pending"
  | "opened"
  | "not_opened"
  | "acknowledged"
  | "not_acknowledged";
