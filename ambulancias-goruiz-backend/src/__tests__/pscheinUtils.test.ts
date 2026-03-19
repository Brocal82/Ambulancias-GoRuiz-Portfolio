import { getPscheinStatus, getPscheinInfo } from "../utils/pscheinUtils";

describe("getPscheinStatus", () => {
  it("returns no-date when date is undefined", () => {
    expect(getPscheinStatus(undefined)).toBe("no-date");
  });

  it("returns no-date when date is invalid", () => {
    expect(getPscheinStatus("invalid")).toBe("no-date");
  });

  it("returns expired when date is in the past", () => {
    expect(getPscheinStatus("2020-01-01")).toBe("expired");
  });

  it("returns valid when date is far in the future", () => {
    expect(getPscheinStatus("2030-01-01")).toBe("valid");
  });
});

describe("getPscheinInfo", () => {
  it("returns status and structure for expired date", () => {
    const info = getPscheinInfo("2020-01-01");
    expect(info.status).toBe("expired");
    expect(info.monthsLeft).toBe(0);
    expect(info.daysLeft).toBe(0);
    expect(info.isoExpiry).toBeDefined();
  });

  it("returns status no-date when undefined", () => {
    const info = getPscheinInfo(undefined);
    expect(info.status).toBe("no-date");
    expect(info.monthsLeft).toBeUndefined();
  });
});
