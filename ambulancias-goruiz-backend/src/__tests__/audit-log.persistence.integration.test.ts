import mongoose from "mongoose";
import { env } from "../config/env";
import { AUDIT_EVENT } from "../security/audit-events";
import { emitAuditLog } from "../security/audit-log";
import SecurityAuditLog from "../security/models/security-audit-log.model";

describe("Security audit log persistence", () => {
  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("persists emitted audit events in MongoDB", async () => {
    const marker = `req-${Date.now()}`;

    emitAuditLog(AUDIT_EVENT.FILE_ACCESS_DENIED, "denied", {
      actorUserId: "user-42",
      actorRole: "superadmin",
      tenantCompanyId: "company-7",
      resourceType: "file",
      resourceId: "f-100",
      httpMethod: "GET",
      path: "/api/files/f-100",
      statusCode: 403,
      requestId: marker,
      reason: "cross-tenant access blocked",
      meta: { testCase: "audit-log.persistence.integration" },
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    const saved = (await SecurityAuditLog.findOne({ requestId: marker }).lean()) as any;
    expect(saved).toBeTruthy();
    expect(saved?.event).toBe(AUDIT_EVENT.FILE_ACCESS_DENIED);
    expect(saved?.outcome).toBe("denied");
    expect(saved?.actorUserId).toBe("user-42");
    expect(saved?.tenantCompanyId).toBe("company-7");
    expect(saved?.at).toBeInstanceOf(Date);
  });
});
