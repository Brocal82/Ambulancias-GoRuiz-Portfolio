import {
  weekStartDateBodySchema,
  assignTeamToWeekSchema,
  assignUserToWeekSchema,
  assignAmbulanceToWeekSchema,
  clearWeekPeopleSchema,
} from "../modules/diensts/schemas/shared.schema";
import {
  dienstTemplateCreateSchema,
  dienstTemplateUpdateSchema,
} from "../modules/dienst-templates/schemas/dienstTemplate.schema";

describe("diensts shared Zod schemas", () => {
  it("weekStartDateBodySchema acepta YYYY-MM-DD válido", () => {
    expect(
      weekStartDateBodySchema.parse({ weekStartDate: "2030-01-06" }),
    ).toEqual({ weekStartDate: "2030-01-06" });
  });

  it("weekStartDateBodySchema rechaza fecha malformada", () => {
    expect(() =>
      weekStartDateBodySchema.parse({ weekStartDate: "2030/01/06" }),
    ).toThrow();
  });

  it("assignTeamToWeekSchema rechaza teamId inválido", () => {
    expect(() =>
      assignTeamToWeekSchema.parse({
        dienstNumber: 1,
        weekStartDate: "2030-01-06",
        teamId: "not-an-objectid",
      }),
    ).toThrow();
  });

  it("assignUserToWeekSchema exige role driver|medic", () => {
    expect(() =>
      assignUserToWeekSchema.parse({
        dienstNumber: 1,
        weekStartDate: "2030-01-06",
        userId: "507f1f77bcf86cd799439011",
        role: "admin",
      }),
    ).toThrow();
  });

  it("assignAmbulanceToWeekSchema coerce dienstNumber", () => {
    const parsed = assignAmbulanceToWeekSchema.parse({
      dienstNumber: "2",
      weekStartDate: "2030-01-06",
      ambulanceId: "507f1f77bcf86cd799439011",
    });
    expect(parsed.dienstNumber).toBe(2);
  });

  it("clearWeekPeopleSchema rechaza weekStartDate vacía", () => {
    expect(() =>
      clearWeekPeopleSchema.parse({ dienstNumber: 1, weekStartDate: "" }),
    ).toThrow();
  });
});

describe("dienst template Zod schemas", () => {
  const validTemplate = {
    dienstNumber: 1,
    startTime: "08:00",
    endTime: "16:00",
    daysOff: [0, 6],
    isActive: true,
  };

  it("dienstTemplateCreateSchema acepta plantilla válida", () => {
    expect(dienstTemplateCreateSchema.parse(validTemplate)).toMatchObject(
      validTemplate,
    );
  });

  it("dienstTemplateCreateSchema rechaza daysOff duplicados", () => {
    expect(() =>
      dienstTemplateCreateSchema.parse({
        ...validTemplate,
        daysOff: [1, 1],
      }),
    ).toThrow(/duplicados/);
  });

  it("dienstTemplateCreateSchema rechaza dayIndex duplicado en perDaySchedule", () => {
    expect(() =>
      dienstTemplateCreateSchema.parse({
        ...validTemplate,
        perDaySchedule: [
          { dayIndex: 1, isOff: false, startTime: "08:00", endTime: "16:00" },
          { dayIndex: 1, isOff: true },
        ],
      }),
    ).toThrow(/duplicado/);
  });

  it("dienstTemplateUpdateSchema permite parcial", () => {
    expect(
      dienstTemplateUpdateSchema.parse({ isActive: false }),
    ).toEqual({ isActive: false });
  });
});
