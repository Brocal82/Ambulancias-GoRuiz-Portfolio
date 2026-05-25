import { describe, it, expect, vi, beforeEach } from "vitest";
import api from "../../../api/axios";
import {
  generateDienstsForWeek,
  deleteDienstsForWeek,
  assignTeamToWeek,
  assignAmbulanceToWeek,
  clearPeopleForWeek,
} from "./api";

vi.mock("../../../api/axios", () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

describe("diensts domain api", () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset();
  });

  it("generateDienstsForWeek envía weekStartDate en el body", async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { message: "ok", count: 2, dienstSummaries: [] },
    });

    await generateDienstsForWeek("2030-01-06", "token-1");

    expect(api.post).toHaveBeenCalledWith(
      "/diensts/generate-week",
      { weekStartDate: "2030-01-06" },
      { headers: { Authorization: "Bearer token-1" } },
    );
  });

  it("deleteDienstsForWeek propaga errores 409 del backend", async () => {
    const err = {
      response: {
        status: 409,
        data: {
          message: "conflict",
          sources: ["trips"],
          counts: { trips: 1 },
        },
      },
    };
    vi.mocked(api.post).mockRejectedValue(err);

    await expect(deleteDienstsForWeek("2030-01-06", "token-1")).rejects.toEqual(
      err,
    );
  });

  it("assignTeamToWeek envía payload completo", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { updatedCount: 3 } });
    await assignTeamToWeek(
      {
        dienstNumber: 1,
        weekStartDate: "2030-01-06",
        teamId: "507f1f77bcf86cd799439011",
      },
      "tok",
    );
    expect(api.post).toHaveBeenCalledWith(
      "/diensts/assign-team-to-week",
      {
        dienstNumber: 1,
        weekStartDate: "2030-01-06",
        teamId: "507f1f77bcf86cd799439011",
      },
      { headers: { Authorization: "Bearer tok" } },
    );
  });

  it("assignAmbulanceToWeek usa ruta con módulo ambulances en backend", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { updatedCount: 1 } });
    await assignAmbulanceToWeek(
      {
        dienstNumber: 2,
        weekStartDate: "2030-01-06",
        ambulanceId: "507f1f77bcf86cd799439012",
      },
      "tok",
    );
    expect(api.post).toHaveBeenCalledWith(
      "/diensts/assign-ambulance-to-week",
      expect.objectContaining({ ambulanceId: "507f1f77bcf86cd799439012" }),
      expect.any(Object),
    );
  });

  it("clearPeopleForWeek devuelve respuesta del servidor", async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        message: "ok",
        clearedCount: 5,
        dienstId: "abc",
        weekStartDate: "2030-01-06",
      },
    });
    const res = await clearPeopleForWeek(
      { dienstNumber: 1, weekStartDate: "2030-01-06" },
      "tok",
    );
    expect(res.clearedCount).toBe(5);
  });
});
