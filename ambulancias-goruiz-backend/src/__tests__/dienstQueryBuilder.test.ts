import { buildDienstSearchQuery } from "../utils/dienstQueryBuilder";
import type { DienstQueryParams } from "../utils/dienstQueryBuilder";

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

  it("adds weekStartDate", () => {
    const params: DienstQueryParams = { weekStartDate: "2024-01-08" };
    expect(buildDienstSearchQuery(params)).toEqual({
      weekStartDate: "2024-01-08",
    });
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
      driver: "abc123",
      medic: "def456",
    };
    expect(buildDienstSearchQuery(params)).toEqual({
      dienstNumber: 3,
      weekStartDate: "2024-01-08",
      "assignments.date": "2024-01-10",
      "assignments.driver": "abc123",
      "assignments.medic": "def456",
    });
  });
});
