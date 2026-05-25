import { buildDienstSearchQuery } from "../modules/diensts/utils/dienstQueryBuilder";
import type { DienstQueryParams } from "../modules/diensts/utils/dienstQueryBuilder";

describe("buildDienstSearchQuery", () => {
  it("returns empty object when no params", () => {
    expect(buildDienstSearchQuery({})).toEqual({});
  });

  it("converts dienstNumber string to number", () => {
    const params: DienstQueryParams = { dienstNumber: "42" };
    expect(buildDienstSearchQuery(params)).toEqual({ dienstNumber: 42 });
  });

  it("omits dienstNumber when invalid (NaN)", () => {
    const params: DienstQueryParams = { dienstNumber: "abc" };
    expect(buildDienstSearchQuery(params)).toEqual({});
  });

  it("adds weekStartDate as Berlin-anchored range", () => {
    const params: DienstQueryParams = { weekStartDate: "2024-01-08" };
    const query = buildDienstSearchQuery(params);
    expect(query.weekStartDate).toEqual(
      expect.objectContaining({
        $gte: expect.any(Date),
        $lte: expect.any(Date),
      }),
    );
    const range = query.weekStartDate as { $gte: Date; $lte: Date };
    expect(range.$lte.getTime() - range.$gte.getTime()).toBe(6 * 24 * 60 * 60 * 1000);
  });

  it("adds assignments.date for date param", () => {
    const params: DienstQueryParams = { date: "2024-01-15" };
    expect(buildDienstSearchQuery(params)).toEqual({
      "assignments.date": "2024-01-15",
    });
  });

  it("adds assignments.driver and assignments.medic", () => {
    const params: DienstQueryParams = {
      driver: "507f1f77bcf86cd799439011",
      medic: "507f1f77bcf86cd799439012",
    };
    expect(buildDienstSearchQuery(params)).toEqual({
      "assignments.driver": "507f1f77bcf86cd799439011",
      "assignments.medic": "507f1f77bcf86cd799439012",
    });
  });

  it("combines all params correctly", () => {
    const params: DienstQueryParams = {
      dienstNumber: "3",
      weekStartDate: "2024-01-08",
      date: "2024-01-10",
      driver: "507f1f77bcf86cd799439011",
      medic: "507f1f77bcf86cd799439012",
    };
    const query = buildDienstSearchQuery(params);
    expect(query.dienstNumber).toBe(3);
    expect(query.weekStartDate).toEqual(
      expect.objectContaining({ $gte: expect.any(Date), $lte: expect.any(Date) }),
    );
    expect(query["assignments.date"]).toBe("2024-01-10");
    expect(query["assignments.driver"]).toBe("507f1f77bcf86cd799439011");
    expect(query["assignments.medic"]).toBe("507f1f77bcf86cd799439012");
  });
});
