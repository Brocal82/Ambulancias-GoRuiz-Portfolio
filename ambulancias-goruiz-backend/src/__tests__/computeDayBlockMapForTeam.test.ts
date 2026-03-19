import {
  computeDayBlockMapForTeam,
  type DayBlockMap,
} from "../utils/dienstValidation";

describe("computeDayBlockMapForTeam", () => {
  it("returns empty object when dates is empty", async () => {
    const result = await computeDayBlockMapForTeam({
      driverId: "507f1f77bcf86cd799439011",
      medicId: "507f1f77bcf86cd799439012",
      dates: [],
    });
    expect(result).toEqual({});
  });

  it("returns driver:false medic:false for all dates when both ids are undefined", async () => {
    const dates = ["2024-01-08", "2024-01-09"];
    const result = await computeDayBlockMapForTeam({
      driverId: undefined,
      medicId: undefined,
      dates,
    });
    const expected: DayBlockMap = {
      "2024-01-08": { driver: false, medic: false },
      "2024-01-09": { driver: false, medic: false },
    };
    expect(result).toEqual(expected);
  });

  it("does not mutate the input dates array", async () => {
    const dates = ["2024-01-08", "2024-01-09"];
    const originalRef = dates;
    await computeDayBlockMapForTeam({
      driverId: undefined,
      medicId: undefined,
      dates,
    });
    expect(dates).toBe(originalRef);
    expect(dates).toEqual(["2024-01-08", "2024-01-09"]);
  });
});
