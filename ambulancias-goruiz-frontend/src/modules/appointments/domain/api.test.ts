import { describe, it, expect, vi, beforeEach } from "vitest";
import api from "../../../api/axios";
import {
  getOpenAppointments,
  getCalendarAppointments,
  getAppointmentsPendingCount,
  requestAppointment,
  proposeSlots,
  selectSlot,
  acceptCancellation,
  updateAppointment,
} from "./api";

vi.mock("../../../api/axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("appointments domain api", () => {
  const token = "test-token";

  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
    vi.mocked(api.patch).mockReset();
  });

  it("getOpenAppointments usa /appointments/open", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] });
    await getOpenAppointments(token);
    expect(api.get).toHaveBeenCalledWith("/appointments/open", {
      headers: { Authorization: `Bearer ${token}` },
    });
  });

  it("getCalendarAppointments codifica from/to en query", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] });
    const from = "2030-01-01T00:00:00.000Z";
    const to = "2030-12-31T23:59:59.999Z";
    await getCalendarAppointments(from, to, token);
    expect(api.get).toHaveBeenCalledWith(
      `/appointments/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
  });

  it("getAppointmentsPendingCount usa /appointments/count con status pending", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { count: 3 } });
    const count = await getAppointmentsPendingCount(token);
    expect(count).toBe(3);
    expect(api.get).toHaveBeenCalledWith("/appointments/count", {
      headers: { Authorization: `Bearer ${token}` },
      params: { status: "pending" },
    });
  });

  it("requestAppointment usa POST /appointments/requests", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { _id: "a1" } });
    await requestAppointment({ reason: "R", details: "D" }, token);
    expect(api.post).toHaveBeenCalledWith(
      "/appointments/requests",
      { reason: "R", details: "D" },
      { headers: { Authorization: `Bearer ${token}` } },
    );
  });

  it("proposeSlots usa POST /appointments/:id/propose", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    const slots = [{ start: "2030-01-01T10:00:00.000Z", end: "2030-01-01T11:00:00.000Z" }];
    await proposeSlots("id1", { proposedSlots: slots }, token);
    expect(api.post).toHaveBeenCalledWith(
      "/appointments/id1/propose",
      { proposedSlots: slots },
      { headers: { Authorization: `Bearer ${token}` } },
    );
  });

  it("selectSlot usa POST /appointments/:id/select", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    const slot = { start: "2030-01-01T10:00:00.000Z", end: "2030-01-01T11:00:00.000Z" };
    await selectSlot("id1", { selectedSlot: slot }, token);
    expect(api.post).toHaveBeenCalledWith(
      "/appointments/id1/select",
      { selectedSlot: slot },
      { headers: { Authorization: `Bearer ${token}` } },
    );
  });

  it("acceptCancellation usa POST /appointments/:id/accept-cancel", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    await acceptCancellation("id1", token);
    expect(api.post).toHaveBeenCalledWith(
      "/appointments/id1/accept-cancel",
      {},
      { headers: { Authorization: `Bearer ${token}` } },
    );
  });

  it("updateAppointment usa PATCH /appointments/:id", async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: {} });
    await updateAppointment("id1", { reason: "Updated" }, token);
    expect(api.patch).toHaveBeenCalledWith(
      "/appointments/id1",
      { reason: "Updated" },
      { headers: { Authorization: `Bearer ${token}` } },
    );
  });
});
