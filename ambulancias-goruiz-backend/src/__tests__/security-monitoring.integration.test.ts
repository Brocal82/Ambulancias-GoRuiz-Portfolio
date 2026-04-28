import mongoose from "mongoose";
import { env } from "../config/env";
import SupportAccessRequest from "../modules/support-access/models/support-access-request.model";
import { buildSupportAccessDailySummary } from "../security/security-monitoring";

describe("Security monitoring daily summary", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("aggregates support-access daily security counters", async () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const oldDate = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const companyId = new mongoose.Types.ObjectId();
    const userA = new mongoose.Types.ObjectId();
    const userB = new mongoose.Types.ObjectId();
    const userC = new mongoose.Types.ObjectId();

    await SupportAccessRequest.create([
      {
        companyId,
        requestedBy: userA,
        reason: "r1",
        ticketId: "T-1",
        durationMinutes: 30,
        status: "pending",
        approvalActors: [userB],
        approvalsRequired: 2,
        approvalsCount: 1,
        reviewedAt: oneHourAgo,
        createdAt: twoHoursAgo,
        updatedAt: oneHourAgo,
      },
      {
        companyId,
        requestedBy: userA,
        reason: "r2",
        ticketId: "T-2",
        durationMinutes: 30,
        status: "approved",
        approvalActors: [userB, userC],
        approvalsRequired: 2,
        approvalsCount: 2,
        reviewedAt: thirtyMinutesAgo,
        expiresAt: new Date(now.getTime() + 30 * 60 * 1000),
        createdAt: twoHoursAgo,
        updatedAt: thirtyMinutesAgo,
      },
      {
        companyId,
        requestedBy: userA,
        reason: "r3",
        ticketId: "T-3",
        durationMinutes: 30,
        status: "denied",
        approvalActors: [],
        approvalsRequired: 2,
        approvalsCount: 0,
        reviewedAt: thirtyMinutesAgo,
        createdAt: twoHoursAgo,
        updatedAt: thirtyMinutesAgo,
      },
      {
        companyId,
        requestedBy: userA,
        reason: "r4",
        ticketId: "T-4",
        durationMinutes: 30,
        status: "revoked",
        approvalActors: [userB, userC],
        approvalsRequired: 2,
        approvalsCount: 2,
        revokedAt: thirtyMinutesAgo,
        createdAt: twoHoursAgo,
        updatedAt: thirtyMinutesAgo,
      },
      {
        companyId,
        requestedBy: userA,
        reason: "r5",
        ticketId: "T-5",
        durationMinutes: 30,
        status: "expired",
        approvalActors: [userB, userC],
        approvalsRequired: 2,
        approvalsCount: 2,
        expiresAt: thirtyMinutesAgo,
        createdAt: twoHoursAgo,
        updatedAt: thirtyMinutesAgo,
      },
      {
        companyId,
        requestedBy: userA,
        reason: "old",
        ticketId: "T-OLD",
        durationMinutes: 30,
        status: "denied",
        approvalActors: [],
        approvalsRequired: 2,
        approvalsCount: 0,
        reviewedAt: oldDate,
        createdAt: oldDate,
        updatedAt: oldDate,
      },
    ]);

    const summary = await buildSupportAccessDailySummary(now);
    expect(summary.requested).toBeGreaterThanOrEqual(5);
    expect(summary.denied).toBeGreaterThanOrEqual(1);
    expect(summary.approvalRecorded).toBeGreaterThanOrEqual(1);
    expect(summary.approvedFinal).toBeGreaterThanOrEqual(1);
    expect(summary.revoked).toBeGreaterThanOrEqual(1);
    expect(summary.expired).toBeGreaterThanOrEqual(1);
  });
});
