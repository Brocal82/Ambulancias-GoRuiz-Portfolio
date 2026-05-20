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

  it("requires two independent approvals before access becomes active", async () => {
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

    await request(app)
      .post(`${API}/support-access/requests/${requestId}/review`)
      .set("Authorization", `Bearer ${requesterToken}`)
      .set("x-step-up-token", issueTestStepUpToken(requesterId))
      .send({ approve: true })
      .expect(400);

    const approveRes = await request(app)
      .post(`${API}/support-access/requests/${requestId}/review`)
      .set("Authorization", `Bearer ${reviewerToken1}`)
      .set("x-step-up-token", issueTestStepUpToken(reviewerId1))
      .send({ approve: true, reviewComment: "Approved for incident support" })
      .expect(200);
    expect(approveRes.body.status).toBe("pending");
    expect(approveRes.body.approvalsCount).toBe(1);
    expect(approveRes.body.expiresAt).toBeFalsy();

    const activeAfterOneApproval = await request(app)
      .get(`${API}/support-access/active`)
      .query({ companyId })
      .set("Authorization", `Bearer ${requesterToken}`)
      .expect(200);
    expect(activeAfterOneApproval.body.active).toBe(false);

    const secondApprove = await request(app)
      .post(`${API}/support-access/requests/${requestId}/review`)
      .set("Authorization", `Bearer ${reviewerToken2}`)
      .set("x-step-up-token", issueTestStepUpToken(reviewerId2))
      .send({ approve: true, reviewComment: "Second approver confirms" })
      .expect(200);
    expect(secondApprove.body.status).toBe("approved");
    expect(secondApprove.body.approvalsCount).toBe(2);
    expect(secondApprove.body.expiresAt).toBeDefined();

    const activeRes = await request(app)
      .get(`${API}/support-access/active`)
      .query({ companyId })
      .set("Authorization", `Bearer ${requesterToken}`)
      .expect(200);
    expect(activeRes.body.active).toBe(true);

    const revokeRes = await request(app)
      .post(`${API}/support-access/requests/${requestId}/revoke`)
      .set("Authorization", `Bearer ${reviewerToken2}`)
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
    await request(app)
      .post(`${API}/support-access/requests/${requestId}/review`)
      .set("Authorization", `Bearer ${reviewerToken2}`)
      .set("x-step-up-token", issueTestStepUpToken(reviewerId2))
      .send({ approve: true, reviewComment: "Second approver for activation" })
      .expect(200);

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
    await request(app)
      .post(`${API}/support-access/requests/${requestId}/review`)
      .set("Authorization", `Bearer ${reviewerToken2}`)
      .set("x-step-up-token", issueTestStepUpToken(reviewerId2))
      .send({ approve: true, reviewComment: "Second approver for short window" })
      .expect(200);

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
});
