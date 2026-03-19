import {
  computeTeamAssignmentsForWeek,
  type TeamRotationInfo,
} from "../utils/teamRotation";

describe("computeTeamAssignmentsForWeek", () => {
  it("assigns only fixed teams to their dienst numbers", () => {
    const teams: TeamRotationInfo[] = [
      { teamId: "team-a", rotationMode: "fixed", fixedDienstNumber: 1 },
      { teamId: "team-b", rotationMode: "fixed", fixedDienstNumber: 2 },
    ];
    const result = computeTeamAssignmentsForWeek({
      dienstNumbers: [1, 2, 3],
      teams,
    });
    expect(result.assignments).toHaveLength(2);
    expect(result.assignments).toContainEqual({
      dienstNumber: 1,
      teamId: "team-a",
    });
    expect(result.assignments).toContainEqual({
      dienstNumber: 2,
      teamId: "team-b",
    });
  });

  it("ignores rotating and none teams", () => {
    const teams: TeamRotationInfo[] = [
      { teamId: "team-fixed", rotationMode: "fixed", fixedDienstNumber: 1 },
      { teamId: "team-rotating", rotationMode: "rotating" },
      { teamId: "team-none", rotationMode: "none" },
    ];
    const result = computeTeamAssignmentsForWeek({
      dienstNumbers: [1, 2, 3],
      teams,
    });
    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0].teamId).toBe("team-fixed");
  });

  it("does not assign fixed team when dienst number not in week", () => {
    const teams: TeamRotationInfo[] = [
      { teamId: "team-a", rotationMode: "fixed", fixedDienstNumber: 99 },
    ];
    const result = computeTeamAssignmentsForWeek({
      dienstNumbers: [1, 2, 3],
      teams,
    });
    expect(result.assignments).toHaveLength(0);
  });

  it("uses first team when multiple fixed for same dienst number", () => {
    const teams: TeamRotationInfo[] = [
      { teamId: "team-first", rotationMode: "fixed", fixedDienstNumber: 1 },
      { teamId: "team-second", rotationMode: "fixed", fixedDienstNumber: 1 },
    ];
    const result = computeTeamAssignmentsForWeek({
      dienstNumbers: [1],
      teams,
    });
    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0].teamId).toBe("team-first");
  });
});
