import { parsePraemienYearMonth, PraemienValidationError } from "../modules/praemien/utils/parsePraemienYearMonth";

describe("parsePraemienYearMonth", () => {
  it("parses valid integer year and month", () => {
    expect(parsePraemienYearMonth("2033", "4")).toEqual({ year: 2033, month: 4 });
    expect(parsePraemienYearMonth(2033, 12)).toEqual({ year: 2033, month: 12 });
  });

  it("rejects missing year or month (no silent fallback)", () => {
    expect(() => parsePraemienYearMonth(undefined, 4)).toThrow(PraemienValidationError);
    expect(() => parsePraemienYearMonth(2033, undefined)).toThrow(PraemienValidationError);
    expect(() => parsePraemienYearMonth("", "4")).toThrow(PraemienValidationError);
  });

  it("rejects non-integer and out-of-range values", () => {
    expect(() => parsePraemienYearMonth("2033.5", "4")).toThrow(PraemienValidationError);
    expect(() => parsePraemienYearMonth("abc", "4")).toThrow(PraemienValidationError);
    expect(() => parsePraemienYearMonth("2033", "0")).toThrow(PraemienValidationError);
    expect(() => parsePraemienYearMonth("2033", "13")).toThrow(PraemienValidationError);
    expect(() => parsePraemienYearMonth("1969", "1")).toThrow(PraemienValidationError);
  });
});
