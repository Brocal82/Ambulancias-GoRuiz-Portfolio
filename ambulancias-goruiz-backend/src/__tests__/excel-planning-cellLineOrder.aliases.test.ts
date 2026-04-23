import {
  excelPlanningMappingSchema,
  resolveCellLineRoleToCanonical,
} from "../modules/excel-planning/schemas/excel-planning.schemas";

describe("cellLineOrder aliases (per-company names in mapping JSON)", () => {
  it("resolves autoid and vehicle to vehicle", () => {
    expect(resolveCellLineRoleToCanonical("autoid")).toBe("vehicle");
    expect(resolveCellLineRoleToCanonical("vehicle")).toBe("vehicle");
  });

  it("rejects unknown tokens in schema", () => {
    expect(() =>
      excelPlanningMappingSchema.parse({
        sheetIndex: 0,
        requireWeekFromSheet: false,
        dataStartRow: 0,
        dienstNumberColumn: 0,
        dayColumns: [0, 1, 2, 3, 4, 5, 6],
        lineDelimiter: "\n",
        cellLineOrder: ["time", "no_such_role", "employeeNumber"],
        nameMatching: "employee_number_only",
      }),
    ).toThrow();
  });

  it("accepts alias array in mapping and preserves stored strings", () => {
    const parsed = excelPlanningMappingSchema.parse({
      sheetIndex: 0,
      requireWeekFromSheet: false,
      dataStartRow: 0,
      dienstNumberColumn: 0,
      dayColumns: [0, 1, 2, 3, 4, 5, 6],
      lineDelimiter: "\n",
      cellLineOrder: ["time", "autoid", "employeeNumber", "name", "partnerName"],
      nameMatching: "employee_number_only",
    });
    expect(parsed.cellLineOrder[1]).toBe("autoid");
  });
});
