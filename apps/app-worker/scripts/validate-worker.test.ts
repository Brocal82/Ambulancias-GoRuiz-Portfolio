import assert from "node:assert/strict";
import test from "node:test";

import { MODULE_KEYS } from "../src/types/auth.js";
import { buildClosureTripRefs } from "../src/utils/closurePayload.js";
import { resolveInitialDocumentsTab } from "../src/utils/documentsTab.js";
import { countUnreadMessages } from "../src/utils/messageBadge.js";
import { resolvePushNavigationTarget } from "../src/utils/notificationNavigation.js";
import {
  isVerifiedPublicImageFilename,
  shouldUseAuthenticatedFileRoute,
} from "../src/utils/secureFileRouting.js";

test("module gating blocks disabled push targets", () => {
  const modules = [MODULE_KEYS.WORKDAY];
  assert.equal(resolvePushNavigationTarget({ screen: "messages" }, modules), null);
  assert.equal(resolvePushNavigationTarget({ screen: "workday" }, modules)?.tab, "workday");
});

test("module gating allows documents when payroll or company docs enabled", () => {
  assert.equal(
    resolvePushNavigationTarget({ screen: "documents" }, [MODULE_KEYS.PAYROLL])?.tab,
    "documents",
  );
  assert.equal(
    resolvePushNavigationTarget({ screen: "documents" }, [MODULE_KEYS.DOCUMENTS])?.tab,
    "documents",
  );
  assert.equal(resolvePushNavigationTarget({ screen: "documents" }, [MODULE_KEYS.WORKDAY]), null);
});

test("secure file routing sends PDFs through authenticated route", () => {
  assert.equal(
    shouldUseAuthenticatedFileRoute({ mimetype: "application/pdf", originalName: "a.pdf" }),
    true,
  );
  assert.equal(
    shouldUseAuthenticatedFileRoute({ mimetype: "image/jpeg", originalName: "photo.jpg" }),
    false,
  );
  assert.equal(
    shouldUseAuthenticatedFileRoute({ mimetype: "text/plain", originalName: "x.txt" }),
    true,
  );
});

test("public image probing only allows verified image extensions", () => {
  assert.equal(isVerifiedPublicImageFilename("avatar.jpg"), true);
  assert.equal(isVerifiedPublicImageFilename("scan.pdf"), false);
  assert.equal(isVerifiedPublicImageFilename("note.txt"), false);
});

test("closure payload sends trip id refs only", () => {
  const refs = buildClosureTripRefs([
    { _id: "507f1f77bcf86cd799439011" },
    { _id: " 507f1f77bcf86cd799439012 " },
    { _id: "" },
  ]);
  assert.deepEqual(refs, [
    { _id: "507f1f77bcf86cd799439011" },
    { _id: "507f1f77bcf86cd799439012" },
  ]);
});

test("documents tab defaults avoid empty module state", () => {
  assert.equal(resolveInitialDocumentsTab(true, false), "payroll");
  assert.equal(resolveInitialDocumentsTab(false, true), "toConfirm");
  assert.equal(resolveInitialDocumentsTab(true, true), "payroll");
});

test("unread badge counts messages not read by current user", () => {
  const total = countUnreadMessages(
    [{ readBy: ["user-a"] }, { readBy: [] }, { readBy: ["user-b", "user-a"] }],
    "user-a",
  );
  assert.equal(total, 1);
});
