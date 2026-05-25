/**
 * delete-week: bloqueo 409 si hay referencias downstream (trips, workday, etc.).
 */
import mongoose from "mongoose";
import { env } from "../config/env";
import Dienst from "../modules/diensts/models/dienst.model";
import { Trip } from "../modules/trips/models/trip.model";
import { deleteDienstsForWeek } from "../modules/diensts/templates/services/lifecycle.service";
import { DeleteWeekConflictError } from "../modules/diensts/utils/dienstWeekReferences";
import { getWeekMongoDateRange } from "../utils/time";

describe("deleteDienstsForWeek downstream protection", () => {
  const weekStart = "2099-03-01";
  let companyId: string;
  let adminUserId: mongoose.Types.ObjectId;
  let companyOid: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
    companyId = new mongoose.Types.ObjectId().toString();
    companyOid = new mongoose.Types.ObjectId(companyId);
    adminUserId = new mongoose.Types.ObjectId();
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  afterEach(async () => {
    await Trip.deleteMany({ companyId: companyOid });
    await Dienst.deleteMany({ companyId: companyOid });
  });

  async function seedDienstWithAssignment() {
    const { start } = getWeekMongoDateRange(weekStart);
    const dienst = await Dienst.create({
      dienstNumber: 99001,
      weekStartDate: start,
      companyId: companyOid,
      assignments: [
        {
          date: "2099-03-01",
          startTime: "08:00",
          endTime: "16:00",
          driver: adminUserId,
          medic: adminUserId,
        },
      ],
    });
    const assignmentId = (dienst.assignments[0] as { _id: mongoose.Types.ObjectId })
      ._id;
    return { dienst, assignmentId };
  }

  it("deleteDienstsForWeek lanza DeleteWeekConflictError si hay trips vinculados", async () => {
    const { assignmentId } = await seedDienstWithAssignment();

    await Trip.create({
      date: "2099-03-01",
      assignmentId,
      driver: adminUserId,
      medic: adminUserId,
      companyId: companyOid,
      auftragNumber: "DEL-WEEK-TEST",
      patientName: "Test",
      fromAddress: "A",
      toAddress: "B",
      timeWarning: "08:00",
      wasCancelled: false,
      countsTrip: 1,
      sentInSummary: false,
    });

    await expect(deleteDienstsForWeek(weekStart, companyId)).rejects.toBeInstanceOf(
      DeleteWeekConflictError,
    );

    const remaining = await Dienst.countDocuments({ companyId: companyOid });
    expect(remaining).toBe(1);
  });

  it("deleteDienstsForWeek elimina cuando no hay referencias downstream", async () => {
    await seedDienstWithAssignment();

    const { deletedCount } = await deleteDienstsForWeek(weekStart, companyId);
    expect(deletedCount).toBeGreaterThanOrEqual(1);
  });
});
