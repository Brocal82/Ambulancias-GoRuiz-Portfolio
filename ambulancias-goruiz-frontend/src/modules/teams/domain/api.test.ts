import { describe, it, expect, vi, beforeEach } from "vitest";
import api from "../../../api/axios";
import { getUsedTeamsForWeek } from "./api";

vi.mock("../../../api/axios", () => ({
  default: {
    get: vi.fn(),
  },
}));

describe("teams domain api", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
  });

  it("getUsedTeamsForWeek envía weekStartDate y devuelve usedTeamIds", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { usedTeamIds: ["t1", "t2"] },
    });

    const ids = await getUsedTeamsForWeek({
      weekStartDate: "2030-01-06",
      dienstNumber: 2,
    });

    expect(ids).toEqual(["t1", "t2"]);
    expect(api.get).toHaveBeenCalledWith("/teams/used-for-week", {
      params: {
        weekStartDate: "2030-01-06",
        dienstNumber: 2,
      },
    });
  });

  it("getUsedTeamsForWeek devuelve array vacío si la API no trae ids", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: {} });
    const ids = await getUsedTeamsForWeek({
      weekStartDate: "2030-01-06",
      dienstNumber: 1,
    });
    expect(ids).toEqual([]);
  });
});
