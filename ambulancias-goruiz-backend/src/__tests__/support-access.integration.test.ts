import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { env } from "../config/env";
import {
  createTestAdminWithCompany,
  createTestSuperadmin,
  issueTestStepUpToken,
} from "./test-helpers";
import SupportAccessRequest from "../modules/support-access/models/support-access-request.model";
import SecurityAuditLog from "../security/models/security-audit-log.model";
import { AUDIT_EVENT } from "../security/audit-events";
import { supportAccessRateLimitConfig } from "../middlewares/rateLimit";
import { runSupportAccessExpirationSweep } from "../modules/support-access/services/support-access.service";

const API = "/api";

describe("Support access (JIT/break-glass)", () => {
  let companyId: string;
  let requesterToken: string;
  let requesterId: string;
  let reviewerToken1: string;
  let reviewerId1: string;
  let reviewerToken2: string;
  let reviewerId2: string;
  let adminToken: string;
  let otherCompanyId: string;
  let otherRequesterToken: string;

  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
    const co = await createTestAdminWithCompany();
    companyId = co.companyId;
    adminToken = co.adminToken;
    const otherCo = await createTestAdminWithCompany();
    otherCompanyId = otherCo.companyId;
    const saRequester = await createTestSuperadmin();
    const saReviewer1 = await createTestSuperadmin();
    const saReviewer2 = await createTestSuperadmin();
    const saOtherRequester = await createTestSuperadmin();
    requesterToken = saRequester.superadminToken;
    requesterId = saRequester.superadminId;
    reviewerToken1 = saReviewer1.superadminToken;
    reviewerId1 = saReviewer1.superadminId;
    reviewerToken2 = saReviewer2.superadminToken;
    reviewerId2 = saReviewer2.superadminId;
    otherRequesterToken = saOtherRequester.superadminToken;
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("activates support access after required approvals", async () => {
    const required = env.SUPPORT_ACCESS_APPROVALS_REQUIRED;
    const createRes = await request(app)
      .post(`${API}/support-access/requests`)
      .set("Authorization", `Bearer ${requesterToken}`)
      .send({
        companyId,
        reason: "Debug payroll incident",
        ticketId: "INC-12345",
        durationMinutes: 30,
      })
      .expect(201);

    const requestId = createRes.body._id ?? createRes.body.id;
    expect(createRes.body.status).toBe("pending");
    expect(createRes.body.approvalsRequired).toBe(required);

    if (required >= 2) {
      await request(app)
        .post(`${API}/support-access/requests/${requestId}/review`)
        .set("Authorization", `Bearer ${requesterToken}`)
        .set("x-step-up-token", issueTestStepUpToken(requesterId))
        .send({ approve: true })
        .expect(400);

      const first = await request(app)
        .post(`${API}/support-access/requests/${requestId}/review`)
        .set("Authorization", `Bearer ${reviewerToken1}`)
        .set("x-step-up-token", issueTestStepUpToken(reviewerId1))
        .send({ approve: true, reviewComment: "First approver" })
        .expect(200);
      expect(first.body.status).toBe("pending");
      expect(first.body.approvalsCount).toBe(1);

      const activeMid = await request(app)
        .get(`${API}/support-access/active`)
        .query({ companyId })
        .set("Authorization", `Bearer ${requesterToken}`)
        .expect(200);
      expect(activeMid.body.active).toBe(false);

      await request(app)
        .post(`${API}/support-access/requests/${requestId}/review`)
        .set("Authorization", `Bearer ${reviewerToken2}`)
        .set("x-step-up-token", issueTestStepUpToken(reviewerId2))
        .send({ approve: true, reviewComment: "Second approver" })
        .expect(200);
    } else {
      await request(app)
        .post(`${API}/support-access/requests/${requestId}/review`)
        .set("Authorization", `Bearer ${requesterToken}`)
        .set("x-step-up-token", issueTestStepUpToken(requesterId))
        .send({ approve: true, reviewComment: "Self approval attempt" })
        .expect(400);

      const soloApprove = await request(app)
        .post(`${API}/support-access/requests/${requestId}/review`)
        .set("Authorization", `Bearer ${reviewerToken1}`)
        .set("x-step-up-token", issueTestStepUpToken(reviewerId1))
        .send({ approve: true, reviewComment: "Independent approver" })
        .expect(200);
      expect(soloApprove.body.status).toBe("approved");
      expect(soloApprove.body.approvalsCount).toBe(1);
      expect(soloApprove.body.expiresAt).toBeDefined();
    }

    const activeRes = await request(app)
      .get(`${API}/support-access/active`)
      .query({ companyId })
      .set("Authorization", `Bearer ${requesterToken}`)
      .expect(200);
    expect(activeRes.body.active).toBe(true);

    const revokeRes = await request(app)
      .post(`${API}/support-access/requests/${requestId}/revoke`)
      .set("Authorization", `Bearer ${reviewerToken2}`)
      .set("x-step-up-token", issueTestStepUpToken(reviewerId2))
      .send({ reason: "Incident resolved" })
      .expect(200);
    expect(revokeRes.body.status).toBe("revoked");

    const activeAfterRevoke = await request(app)
      .get(`${API}/support-access/active`)
      .query({ companyId })
      .set("Authorization", `Bearer ${requesterToken}`)
      .expect(200);
    expect(activeAfterRevoke.body.active).toBe(false);
  });

  it("rechaza aprobar JIT sin step-up", async () => {
    const createRes = await request(app)
      .post(`${API}/support-access/requests`)
      .set("Authorization", `Bearer ${requesterToken}`)
      .send({
        companyId,
        reason: "Needs MFA on approve",
        ticketId: "INC-STEPUP",
        durationMinutes: 15,
      })
      .expect(201);
    const requestId = createRes.body._id ?? createRes.body.id;

    const res = await request(app)
      .post(`${API}/support-access/requests/${requestId}/review`)
      .set("Authorization", `Bearer ${reviewerToken1}`)
      .send({ approve: true, reviewComment: "No step-up token" });
    expect([401, 403]).toContain(res.status);
    expect(res.body.code).toBe("STEP_UP_REQUIRED");
  });

  it("blocks non-superadmin roles from support-access endpoints", async () => {
    await request(app)
      .get(`${API}/support-access/requests`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(403);
    await request(app)
      .get(`${API}/support-access/monitoring/daily-summary`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(403);
  });

  it("isolates active support access per actor and company", async () => {
    const createRes = await request(app)
      .post(`${API}/support-access/requests`)
      .set("Authorization", `Bearer ${requesterToken}`)
      .send({
        companyId,
        reason: "Investigate tenant issue",
        ticketId: "INC-23456",
        durationMinutes: 20,
      })
      .expect(201);
    const requestId = createRes.body._id ?? createRes.body.id;

    await request(app)
      .post(`${API}/support-access/requests/${requestId}/review`)
      .set("Authorization", `Bearer ${reviewerToken1}`)
      .set("x-step-up-token", issueTestStepUpToken(reviewerId1))
      .send({ approve: true, reviewComment: "Approved for isolated support" })
      .expect(200);
    if (env.SUPPORT_ACCESS_APPROVALS_REQUIRED >= 2) {
      await request(app)
        .post(`${API}/support-access/requests/${requestId}/review`)
        .set("Authorization", `Bearer ${reviewerToken2}`)
        .set("x-step-up-token", issueTestStepUpToken(reviewerId2))
        .send({ approve: true, reviewComment: "Second approver for activation" })
        .expect(200);
    }

    const ownerActive = await request(app)
      .get(`${API}/support-access/active`)
      .query({ companyId })
      .set("Authorization", `Bearer ${requesterToken}`)
      .expect(200);
    expect(ownerActive.body.active).toBe(true);

    const otherActorSameCompany = await request(app)
      .get(`${API}/support-access/active`)
      .query({ companyId })
      .set("Authorization", `Bearer ${otherRequesterToken}`)
      .expect(200);
    expect(otherActorSameCompany.body.active).toBe(false);

    const ownerOtherCompany = await request(app)
      .get(`${API}/support-access/active`)
      .query({ companyId: otherCompanyId })
      .set("Authorization", `Bearer ${requesterToken}`)
      .expect(200);
    expect(ownerOtherCompany.body.active).toBe(false);
  });

  it("expires approved access and marks request as expired", async () => {
    const createRes = await request(app)
      .post(`${API}/support-access/requests`)
      .set("Authorization", `Bearer ${requesterToken}`)
      .send({
        companyId: otherCompanyId,
        reason: "Temporary forensic access",
        ticketId: "INC-34567",
        durationMinutes: 5,
      })
      .expect(201);
    const requestId = createRes.body._id ?? createRes.body.id;

    await request(app)
      .post(`${API}/support-access/requests/${requestId}/review`)
      .set("Authorization", `Bearer ${reviewerToken1}`)
      .set("x-step-up-token", issueTestStepUpToken(reviewerId1))
      .send({ approve: true, reviewComment: "Approved for short window" })
      .expect(200);
    if (env.SUPPORT_ACCESS_APPROVALS_REQUIRED >= 2) {
      await request(app)
        .post(`${API}/support-access/requests/${requestId}/review`)
        .set("Authorization", `Bearer ${reviewerToken2}`)
        .set("x-step-up-token", issueTestStepUpToken(reviewerId2))
        .send({ approve: true, reviewComment: "Second approver for short window" })
        .expect(200);
    }

    await SupportAccessRequest.findByIdAndUpdate(requestId, {
      $set: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const activeAfterForcedExpiry = await request(app)
      .get(`${API}/support-access/active`)
      .query({ companyId: otherCompanyId })
      .set("Authorization", `Bearer ${requesterToken}`)
      .expect(200);
    expect(activeAfterForcedExpiry.body.active).toBe(false);

    const expired = await SupportAccessRequest.findById(requestId).lean();
    expect(expired?.status).toBe("expired");
  });

  it("returns monitoring snapshot for superadmin", async () => {
    const res = await request(app)
      .get(`${API}/support-access/monitoring/daily-summary`)
      .query({ hours: 12 })
      .set("Authorization", `Bearer ${reviewerToken1}`)
      .expect(200);
    expect(res.body).toHaveProperty("generatedAt");
    expect(res.body).toHaveProperty("windowHours", 12);
    expect(res.body).toHaveProperty("supportAccess");
    expect(res.body.supportAccess).toHaveProperty("requested");
    expect(res.body.supportAccess).toHaveProperty("denied");
  });

  it("blocks self-approval even when approvalsRequired=1", async () => {
    const createRes = await request(app)
      .post(`${API}/support-access/requests`)
      .set("Authorization", `Bearer ${requesterToken}`)
      .send({
        companyId: otherCompanyId,
        reason: "Self approval hardening",
        ticketId: "INC-SELF-1",
        durationMinutes: 15,
      })
      .expect(201);
    const requestId = createRes.body._id ?? createRes.body.id;
    expect(createRes.body.approvalsRequired).toBe(env.SUPPORT_ACCESS_APPROVALS_REQUIRED);

    const selfApprove = await request(app)
      .post(`${API}/support-access/requests/${requestId}/review`)
      .set("Authorization", `Bearer ${requesterToken}`)
      .set("x-step-up-token", issueTestStepUpToken(requesterId))
      .send({ approve: true, reviewComment: "Must not self-approve" })
      .expect(400);
    expect(selfApprove.body.message).toMatch(/distinto al solicitante/i);

    const activeRes = await request(app)
      .get(`${API}/support-access/active`)
      .query({ companyId: otherCompanyId })
      .set("Authorization", `Bearer ${requesterToken}`)
      .expect(200);
    expect(activeRes.body.active).toBe(false);
  });

  it("requires step-up MFA to revoke approved support access", async () => {
    const createRes = await request(app)
      .post(`${API}/support-access/requests`)
      .set("Authorization", `Bearer ${requesterToken}`)
      .send({
        companyId,
        reason: "Revoke step-up test",
        ticketId: "INC-REVOKE-STEPUP",
        durationMinutes: 15,
      })
      .expect(201);
    const requestId = createRes.body._id ?? createRes.body.id;

    await request(app)
      .post(`${API}/support-access/requests/${requestId}/review`)
      .set("Authorization", `Bearer ${reviewerToken1}`)
      .set("x-step-up-token", issueTestStepUpToken(reviewerId1))
      .send({ approve: true, reviewComment: "Approved for revoke test" })
      .expect(200);
    if (env.SUPPORT_ACCESS_APPROVALS_REQUIRED >= 2) {
      await request(app)
        .post(`${API}/support-access/requests/${requestId}/review`)
        .set("Authorization", `Bearer ${reviewerToken2}`)
        .set("x-step-up-token", issueTestStepUpToken(reviewerId2))
        .send({ approve: true, reviewComment: "Second approver for revoke test" })
        .expect(200);
    }

    const withoutStepUp = await request(app)
      .post(`${API}/support-access/requests/${requestId}/revoke`)
      .set("Authorization", `Bearer ${reviewerToken1}`)
      .send({ reason: "Missing step-up" });
    expect([401, 403]).toContain(withoutStepUp.status);
    expect(withoutStepUp.body.code).toBe("STEP_UP_REQUIRED");

    await request(app)
      .post(`${API}/support-access/requests/${requestId}/revoke`)
      .set("Authorization", `Bearer ${reviewerToken1}`)
      .set("x-step-up-token", issueTestStepUpToken(reviewerId1))
      .send({ reason: "With step-up" })
      .expect(200);
  });

  it("audits active support-access checks", async () => {
    const markerCompanyId = new mongoose.Types.ObjectId().toString();
    const before = await SecurityAuditLog.countDocuments({
      event: AUDIT_EVENT.SUPPORT_ACCESS_ACTIVE_CHECKED,
      "meta.companyId": markerCompanyId,
    });

    await request(app)
      .get(`${API}/support-access/active`)
      .query({ companyId: markerCompanyId })
      .set("Authorization", `Bearer ${requesterToken}`)
      .expect(200);

    await new Promise((resolve) => setTimeout(resolve, 50));

    const after = await SecurityAuditLog.countDocuments({
      event: AUDIT_EVENT.SUPPORT_ACCESS_ACTIVE_CHECKED,
      "meta.companyId": markerCompanyId,
    });
    expect(after).toBeGreaterThan(before);
  });

  it("audits revoke attempts and failures", async () => {
    const createRes = await request(app)
      .post(`${API}/support-access/requests`)
      .set("Authorization", `Bearer ${requesterToken}`)
      .send({
        companyId,
        reason: "Revoke audit test",
        ticketId: "INC-REVOKE-AUDIT",
        durationMinutes: 15,
      })
      .expect(201);
    const requestId = createRes.body._id ?? createRes.body.id;

    const deniedBefore = await SecurityAuditLog.countDocuments({
      event: AUDIT_EVENT.SUPPORT_ACCESS_REVOKED,
      outcome: "denied",
      resourceId: requestId,
    });

    await request(app)
      .post(`${API}/support-access/requests/${requestId}/revoke`)
      .set("Authorization", `Bearer ${reviewerToken1}`)
      .set("x-step-up-token", issueTestStepUpToken(reviewerId1))
      .send({ reason: "Not approved yet" })
      .expect(400);

    await new Promise((resolve) => setTimeout(resolve, 50));

    const deniedAfter = await SecurityAuditLog.countDocuments({
      event: AUDIT_EVENT.SUPPORT_ACCESS_REVOKED,
      outcome: "denied",
      resourceId: requestId,
    });
    expect(deniedAfter).toBeGreaterThan(deniedBefore);
  });

  it("executes expiration sweep and marks requests expired", async () => {
    const companyOid = new mongoose.Types.ObjectId();
    const userOid = new mongoose.Types.ObjectId();
    const doc = await SupportAccessRequest.create({
      companyId: companyOid,
      requestedBy: userOid,
      reason: "expiration sweep",
      ticketId: "INC-EXP-SWEEP",
      durationMinutes: 5,
      status: "approved",
      approvalActors: [userOid],
      approvalsRequired: 1,
      approvalsCount: 1,
      expiresAt: new Date(Date.now() - 60_000),
    });

    const expiredCount = await runSupportAccessExpirationSweep("cron");
    expect(expiredCount).toBeGreaterThanOrEqual(1);

    const updated = await SupportAccessRequest.findById(doc._id).lean();
    expect(updated?.status).toBe("expired");

    await new Promise((resolve) => setTimeout(resolve, 50));

    const sweepAudit = await SecurityAuditLog.findOne({
      event: AUDIT_EVENT.SUPPORT_ACCESS_EXPIRATION_EXECUTED,
      "meta.expiredCount": { $gte: 1 },
    })
      .sort({ at: -1 })
      .lean();
    expect(sweepAudit).toBeTruthy();
  });

  it("configures stricter support-access mutation rate limits", () => {
    expect(supportAccessRateLimitConfig.create.max).toBeLessThanOrEqual(
      env.RATE_LIMIT_GLOBAL_MAX,
    );
    expect(supportAccessRateLimitConfig.create.windowMs).toBeGreaterThanOrEqual(
      10 * 60 * 1000,
    );
    expect(supportAccessRateLimitConfig.review.max).toBeGreaterThan(0);
    expect(supportAccessRateLimitConfig.revoke.max).toBeGreaterThan(0);
  });

  it("returns 429 when support-access create rate limit is exceeded", async () => {
    const prevTest = process.env.SUPPORT_ACCESS_RATE_LIMIT_TEST;
    const prevMax = process.env.RATE_LIMIT_SUPPORT_ACCESS_CREATE_MAX;
    process.env.SUPPORT_ACCESS_RATE_LIMIT_TEST = "1";
    process.env.RATE_LIMIT_SUPPORT_ACCESS_CREATE_MAX = "2";
    jest.resetModules();

    const express = await import("express");
    const requestLib = await import("supertest");
    const { rateLimitSupportAccessCreate } = await import("../middlewares/rateLimit");
    const mini = express.default();
    mini.post("/x", rateLimitSupportAccessCreate, (_req, res) => {
      res.sendStatus(201);
    });

    try {
      await requestLib.default(mini).post("/x").expect(201);
      await requestLib.default(mini).post("/x").expect(201);
      await requestLib.default(mini).post("/x").expect(429);
    } finally {
      if (prevTest === undefined) {
        delete process.env.SUPPORT_ACCESS_RATE_LIMIT_TEST;
      } else {
        process.env.SUPPORT_ACCESS_RATE_LIMIT_TEST = prevTest;
      }
      if (prevMax === undefined) {
        delete process.env.RATE_LIMIT_SUPPORT_ACCESS_CREATE_MAX;
      } else {
        process.env.RATE_LIMIT_SUPPORT_ACCESS_CREATE_MAX = prevMax;
      }
      jest.resetModules();
    }
  });
});
