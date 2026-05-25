import { parseWeekStartISO, getWeekMongoDateRange, buildWeekDateStrings } from "../utils/time";

describe("time week boundaries (Berlin)", () => {
  it("parseWeekStartISO rechaza formatos inválidos", () => {
    expect(() => parseWeekStartISO("01-06-2030")).toThrow(/YYYY-MM-DD/);
    expect(() => parseWeekStartISO("2030-13-40")).toThrow(/inválida/);
  });

  it("getWeekMongoDateRange devuelve 7 fechas ISO consecutivas", () => {
    const { weekDates, start, end } = getWeekMongoDateRange("2030-01-07");
    expect(weekDates).toHaveLength(7);
    expect(weekDates[0]).toBe("2030-01-07");
    expect(weekDates[6]).toBe("2030-01-13");
    expect(end.getTime() - start.getTime()).toBe(6 * 24 * 60 * 60 * 1000);
  });

  it("buildWeekDateStrings coincide con getWeekMongoDateRange.weekDates", () => {
    const week = "2040-03-04";
    expect(buildWeekDateStrings(week)).toEqual(
      getWeekMongoDateRange(week).weekDates,
    );
  });
});
