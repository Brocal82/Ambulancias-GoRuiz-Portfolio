import { describe, it, expect } from "vitest";
import {
  filterDriverCandidates,
  filterMedicCandidates,
  isDriverCandidate,
  isMedicCandidate,
} from "./teamPickerUtils";

const users = [
  { _id: "1", ambulanceRole: "driver" as const, name: "A", lastName: "A" },
  { _id: "2", ambulanceRole: "medic" as const, name: "B", lastName: "B" },
  { _id: "3", ambulanceRole: "both" as const, name: "C", lastName: "C" },
  { _id: "4", ambulanceRole: undefined, name: "D", lastName: "D" },
];

describe("teamPickerUtils", () => {
  it("filtra conductores (driver|both)", () => {
    const drivers = filterDriverCandidates(users);
    expect(drivers.map((u) => u._id)).toEqual(["1", "3"]);
    expect(isDriverCandidate(users[1])).toBe(false);
    expect(isDriverCandidate(users[2])).toBe(true);
  });

  it("filtra sanitarios (medic|both)", () => {
    const medics = filterMedicCandidates(users);
    expect(medics.map((u) => u._id)).toEqual(["2", "3"]);
    expect(isMedicCandidate(users[0])).toBe(false);
    expect(isMedicCandidate(users[2])).toBe(true);
  });
});
