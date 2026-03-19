import {
  buildWeekDateStrings,
  computeShiftBounds,
} from "../utils/time";
import { DateTime } from "luxon";

describe("buildWeekDateStrings", () => {
  it("returns 7 consecutive days starting from Monday", () => {
    const result = buildWeekDateStrings("2024-01-08");
    expect(result).toHaveLength(7);
    expect(result[0]).toBe("2024-01-08");
    expect(result[1]).toBe("2024-01-09");
    expect(result[6]).toBe("2024-01-14");
  });

  it("uses lunes (Monday) as first day of week", () => {
    const result = buildWeekDateStrings("2024-01-08");
    const day0 = DateTime.fromISO(result[0], { zone: "Europe/Berlin" });
    expect(day0.weekday).toBe(1);
  });
});

describe("computeShiftBounds", () => {
  it("returns start and end for normal shift same day", () => {
    const { start, end } = computeShiftBounds(
      "2024-01-15",
      "08:00",
      "16:00",
    );
    expect(start.hour).toBe(8);
    expect(start.minute).toBe(0);
    expect(end.hour).toBe(16);
    expect(end.minute).toBe(0);
    expect(start.day).toBe(end.day);
  });

  it("handles midnight crossover by adding one day to end", () => {
    const { start, end } = computeShiftBounds(
      "2024-01-15",
      "22:00",
      "06:00",
    );
    expect(start.hour).toBe(22);
    expect(end.hour).toBe(6);
    expect(end.day).toBe(start.day + 1);
  });
});
