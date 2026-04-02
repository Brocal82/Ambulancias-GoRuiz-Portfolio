import {
  computeDayBlockMapForTeam,
  computeTeamDayAbsenceData,
  type DayBlockMap,
} from "../modules/diensts/utils/dienstValidation";

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

  it("computeTeamDayAbsenceData exposes reason flags aligned with blockMap", async () => {
    const dates = ["2024-01-08"];
    const { blockMap, reasonByDate } = await computeTeamDayAbsenceData({
      driverId: undefined,
      medicId: undefined,
      dates,
    });
    expect(blockMap["2024-01-08"].driver).toBe(false);
    expect(reasonByDate["2024-01-08"].driver.vacation).toBe(false);
    expect(reasonByDate["2024-01-08"].driver.sick).toBe(false);
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
