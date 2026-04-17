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
