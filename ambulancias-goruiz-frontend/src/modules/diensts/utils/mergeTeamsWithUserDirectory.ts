import type { Team } from "../../teams/domain/types";
import type { User } from "../../users/domain/types";

/**
 * GET /teams often returns reduced driver/medic fields. Merge full `/users` rows by id
 * so eligibility checks see `pscheinConfirmedAt` and complete P-Schein fields.
 */
export function mergeTeamsWithUserDirectory(
  teams: Team[],
  directory: User[],
): Team[] {
  const byId = new Map(directory.map((u) => [u._id, u]));
  return teams.map((t) => {
    const dId =
      t.driver && typeof t.driver === "object" && "_id" in t.driver
        ? (t.driver as User)._id
        : undefined;
    const mId =
      t.medic && typeof t.medic === "object" && "_id" in t.medic
        ? (t.medic as User)._id
        : undefined;
    const fullD = dId ? byId.get(dId) : undefined;
    const fullM = mId ? byId.get(mId) : undefined;
    return {
      ...t,
      driver: fullD ? { ...t.driver, ...fullD } : t.driver,
      medic: fullM ? { ...t.medic, ...fullM } : t.medic,
    };
  });
}
