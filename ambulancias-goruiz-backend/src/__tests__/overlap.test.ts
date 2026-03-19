import { shiftsOverlap } from "../utils/overlap";

describe("shiftsOverlap", () => {
  it("returns true when shifts overlap same day", () => {
    const a = { date: "2024-01-15", startTime: "08:00", endTime: "12:00" };
    const b = { date: "2024-01-15", startTime: "10:00", endTime: "14:00" };
    expect(shiftsOverlap(a, b)).toBe(true);
  });

  it("returns false when shifts do not overlap same day", () => {
    const a = { date: "2024-01-15", startTime: "08:00", endTime: "12:00" };
    const b = { date: "2024-01-15", startTime: "13:00", endTime: "17:00" };
    expect(shiftsOverlap(a, b)).toBe(false);
  });

  it("returns false when shifts are on different dates", () => {
    const a = { date: "2024-01-15", startTime: "08:00", endTime: "20:00" };
    const b = { date: "2024-01-16", startTime: "08:00", endTime: "20:00" };
    expect(shiftsOverlap(a, b)).toBe(false);
  });

  it("returns true when one shift crosses midnight and overlaps", () => {
    const a = { date: "2024-01-15", startTime: "22:00", endTime: "06:00" };
    const b = { date: "2024-01-15", startTime: "23:00", endTime: "01:00" };
    expect(shiftsOverlap(a, b)).toBe(true);
  });

  it("returns false when shift a has missing fields", () => {
    const a = { date: "", startTime: "08:00", endTime: "12:00" };
    const b = { date: "2024-01-15", startTime: "10:00", endTime: "14:00" };
    expect(shiftsOverlap(a, b)).toBe(false);
  });
});
