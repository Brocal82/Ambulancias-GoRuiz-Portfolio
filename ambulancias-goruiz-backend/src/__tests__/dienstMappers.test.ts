import {
  extractValidDatesFromAssignments,
  mapAssignmentToAssignedDay,
} from "../utils/dienstMappers";

describe("extractValidDatesFromAssignments", () => {
  it("returns empty array when assignments is null or undefined", () => {
    expect(extractValidDatesFromAssignments(null)).toEqual([]);
    expect(extractValidDatesFromAssignments(undefined)).toEqual([]);
  });

  it("returns empty array when assignments is empty", () => {
    expect(extractValidDatesFromAssignments([])).toEqual([]);
  });

  it("returns unique dates for valid assignments", () => {
    const assignments = [
      { date: "2024-01-15", startTime: "08:00", endTime: "16:00" },
      { date: "2024-01-16", startTime: "08:00", endTime: "16:00" },
      { date: "2024-01-15", startTime: "09:00", endTime: "17:00" },
    ];
    expect(extractValidDatesFromAssignments(assignments)).toEqual([
      "2024-01-15",
      "2024-01-16",
    ]);
  });

  it("filters out assignments missing date, startTime or endTime", () => {
    const assignments = [
      { date: "2024-01-15", startTime: "08:00", endTime: "16:00" },
      { date: "2024-01-16", startTime: "08:00" },
      { date: "2024-01-17", endTime: "16:00" },
      { startTime: "08:00", endTime: "16:00" },
    ];
    expect(extractValidDatesFromAssignments(assignments)).toEqual([
      "2024-01-15",
    ]);
  });
});

describe("mapAssignmentToAssignedDay", () => {
  const dienst = {
    _id: "507f1f77bcf86cd799439011",
    dienstNumber: 1,
  };

  it("returns null when user is neither driver nor medic", () => {
    const assignment = {
      _id: "a1",
      date: "2024-01-15",
      startTime: "08:00",
      endTime: "16:00",
      driver: { _id: "user1", name: "A", lastName: "B", pscheinExpiry: "2025-01-01" },
      medic: { _id: "user2", name: "C", lastName: "D" },
    };
    expect(mapAssignmentToAssignedDay(assignment, dienst, "user999")).toBeNull();
  });

  it("returns AssignedDay when user is driver", () => {
    const assignment = {
      _id: "a1",
      date: "2024-01-15",
      startTime: "08:00",
      endTime: "16:00",
      driver: { _id: "user1", name: "A", lastName: "B", pscheinExpiry: "2025-01-01" },
      medic: { _id: "user2", name: "C", lastName: "D" },
    };
    const result = mapAssignmentToAssignedDay(assignment, dienst, "user1");
    expect(result).not.toBeNull();
    expect(result!.dienstId).toBe("507f1f77bcf86cd799439011");
    expect(result!.dienstNumber).toBe(1);
    expect(result!.assignmentId).toBe("a1");
    expect(result!.date).toBe("2024-01-15");
    expect(result!.startTime).toBe("08:00");
    expect(result!.endTime).toBe("16:00");
    expect(result!.driver).toEqual({
      _id: "user1",
      name: "A",
      lastName: "B",
      pscheinExpiry: "2025-01-01",
    });
    expect(result!.medic).toEqual({
      _id: "user2",
      name: "C",
      lastName: "D",
    });
  });

  it("returns AssignedDay when user is medic", () => {
    const assignment = {
      _id: "a2",
      date: "2024-01-16",
      startTime: "09:00",
      endTime: "17:00",
      driver: { _id: "user1", name: "A", lastName: "B" },
      medic: { _id: "user2", name: "C", lastName: "D" },
    };
    const result = mapAssignmentToAssignedDay(assignment, dienst, "user2");
    expect(result).not.toBeNull();
    expect(result!.dienstId).toBe("507f1f77bcf86cd799439011");
    expect(result!.assignmentId).toBe("a2");
    expect(result!.date).toBe("2024-01-16");
  });

  it("extracts ambulanceId and ambulanceNumber when ambulance is populated object", () => {
    const assignment = {
      _id: "a3",
      date: "2024-01-17",
      startTime: "08:00",
      endTime: "16:00",
      driver: { _id: "user1", name: "A", lastName: "B" },
      medic: null,
      ambulanceId: { _id: "amb-1", ambulanceNumber: "A-42" },
    };
    const result = mapAssignmentToAssignedDay(assignment, dienst, "user1");
    expect(result).not.toBeNull();
    expect(result!.ambulanceId).toBe("amb-1");
    expect(result!.ambulanceNumber).toBe("A-42");
  });

  it("extracts ambulanceId when ambulance is string", () => {
    const assignment = {
      _id: "a4",
      date: "2024-01-18",
      startTime: "08:00",
      endTime: "16:00",
      driver: { _id: "user1", name: "A", lastName: "B" },
      medic: null,
      ambulanceId: "amb-string-id",
    };
    const result = mapAssignmentToAssignedDay(assignment, dienst, "user1");
    expect(result).not.toBeNull();
    expect(result!.ambulanceId).toBe("amb-string-id");
    expect(result!.ambulanceNumber).toBeUndefined();
  });
});
