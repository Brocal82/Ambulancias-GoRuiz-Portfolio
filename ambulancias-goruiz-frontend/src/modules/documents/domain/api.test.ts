import { describe, it, expect, vi, beforeEach } from "vitest";
import api from "../../../api/axios";
import {
  listAdminDocuments,
  listDocumentDeliveries,
  uploadDocumentsBatch,
  deleteDocument,
  deleteDocumentBatch,
  listMyDocumentDeliveries,
  markMyDocumentDeliveryRead,
  acknowledgeMyDocumentDelivery,
} from "./api";

vi.mock("../../../api/axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("documents domain api", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
    vi.mocked(api.patch).mockReset();
    vi.mocked(api.delete).mockReset();
  });

  it("listAdminDocuments usa GET /documents", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] });
    await listAdminDocuments();
    expect(api.get).toHaveBeenCalledWith("/documents");
  });

  it("uploadDocumentsBatch envía FormData multipart", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    const formData = new FormData();
    formData.append("files", new File(["x"], "a.pdf", { type: "application/pdf" }));
    await uploadDocumentsBatch(formData);
    expect(api.post).toHaveBeenCalledWith("/documents/upload/batch", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  });

  it("deleteDocument usa DELETE /documents/:id", async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: {} });
    await deleteDocument("doc1");
    expect(api.delete).toHaveBeenCalledWith("/documents/doc1");
  });

  it("deleteDocumentBatch usa DELETE /documents/batch/:uploadBatchId", async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: { message: "ok" } });
    await deleteDocumentBatch("batch1");
    expect(api.delete).toHaveBeenCalledWith("/documents/batch/batch1");
  });

  it("listMyDocumentDeliveries devuelve deliveries del body", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { deliveries: [{ deliveryId: "d1" }] },
    });
    const rows = await listMyDocumentDeliveries();
    expect(api.get).toHaveBeenCalledWith("/documents/mine");
    expect(rows).toEqual([{ deliveryId: "d1" }]);
  });

  it("markMyDocumentDeliveryRead usa PATCH read", async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: { deliveryId: "d1", readAt: "t" } });
    await markMyDocumentDeliveryRead("d1");
    expect(api.patch).toHaveBeenCalledWith("/documents/deliveries/d1/read");
  });

  it("acknowledgeMyDocumentDelivery envía password en body", async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { deliveryId: "d1", readAt: "t", acknowledgedAt: "a" },
    });
    await acknowledgeMyDocumentDelivery("d1", "secret");
    expect(api.post).toHaveBeenCalledWith("/documents/deliveries/d1/acknowledge", {
      password: "secret",
    });
  });

  // P1.1 / P1.2 — Admin evidence
  it("listDocumentDeliveries sin filtro usa GET /documents/:id/deliveries", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { deliveries: [] } });
    const result = await listDocumentDeliveries("doc123");
    expect(api.get).toHaveBeenCalledWith("/documents/doc123/deliveries");
    expect(result).toEqual([]);
  });

  it("listDocumentDeliveries con filtro 'all' omite query param", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { deliveries: [] } });
    await listDocumentDeliveries("doc123", "all");
    expect(api.get).toHaveBeenCalledWith("/documents/doc123/deliveries");
  });

  it("listDocumentDeliveries con filtro 'opened' incluye query param", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { deliveries: [{ deliveryId: "d1" }] } });
    const result = await listDocumentDeliveries("doc123", "opened");
    expect(api.get).toHaveBeenCalledWith("/documents/doc123/deliveries?status=opened");
    expect(result).toHaveLength(1);
  });

  it("listDocumentDeliveries con filtro 'not_acknowledged' incluye query param", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { deliveries: [] } });
    await listDocumentDeliveries("doc123", "not_acknowledged");
    expect(api.get).toHaveBeenCalledWith("/documents/doc123/deliveries?status=not_acknowledged");
  });
});
