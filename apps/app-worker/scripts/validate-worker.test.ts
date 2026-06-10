import assert from "node:assert/strict";
import test from "node:test";

import {
  assertProductionSafeApiBaseUrl,
  isLocalOrPrivateApiHost,
  normalizeApiBaseUrl,
} from "../src/config/apiBaseUrlPolicy.js";
import { MODULE_KEYS } from "../src/types/auth.js";
import { buildClosureTripRefs } from "../src/utils/closurePayload.js";
import { resolveInitialDocumentsTab } from "../src/utils/documentsTab.js";
import { countUnreadMessages } from "../src/utils/messageBadge.js";
import { resolvePushNavigationTarget } from "../src/utils/notificationNavigation.js";
import {
  isVerifiedPublicImageFilename,
  shouldUseAuthenticatedFileRoute,
} from "../src/utils/secureFileRouting.js";
import {
  crossesMidnight,
  filterSummariesForAssignment,
  isNowWithinDienst,
  resolveTodayAssignment,
  todayDateKey,
  workdayDataDateKey,
} from "../src/utils/workdayAssignment.js";

test("normalizeApiBaseUrl appends /api when missing", () => {
  assert.equal(normalizeApiBaseUrl("https://api.example.com"), "https://api.example.com/api");
  assert.equal(normalizeApiBaseUrl("https://api.example.com/api/"), "https://api.example.com/api");
});

test("production API guard rejects localhost and private hosts", () => {
  assert.equal(isLocalOrPrivateApiHost("localhost"), true);
  assert.equal(isLocalOrPrivateApiHost("192.168.1.10"), true);
  assert.equal(isLocalOrPrivateApiHost("api.example.com"), false);

  assert.throws(
    () => assertProductionSafeApiBaseUrl("http://192.168.1.10:5000/api", "extra"),
    /https/,
  );
  assert.throws(
    () => assertProductionSafeApiBaseUrl("https://192.168.1.10/api", "env"),
    /private networks/,
  );
  assert.throws(
    () => assertProductionSafeApiBaseUrl("https://api.example.com/api", "fallback"),
    /requires EXPO_PUBLIC_API_BASE_URL/,
  );
  assert.doesNotThrow(() =>
    assertProductionSafeApiBaseUrl("https://api.example.com/api", "env"),
  );
});

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

test("crossesMidnight detects shifts ending before start hour", () => {
  assert.equal(crossesMidnight("22:00", "06:00"), true);
  assert.equal(crossesMidnight("06:00", "14:00"), false);
});

test("workdayDataDateKey always uses Dienst date", () => {
  assert.equal(
    workdayDataDateKey({ date: "2026-05-28" }),
    "2026-05-28",
  );
  assert.equal(workdayDataDateKey(null), null);
});

test("filterSummariesForAssignment scopes by assignment and Dienst date", () => {
  const assignment = {
    assignmentId: "a1",
    date: "2026-05-28",
  };
  const summaries = [
    { _id: "s1", date: "2026-05-28", assignmentId: "a1", isFinalClosure: false },
    { _id: "s2", date: "2026-05-29", assignmentId: "a1", isFinalClosure: false },
    { _id: "s3", date: "2026-05-28", assignmentId: "other", isFinalClosure: false },
  ];
  const filtered = filterSummariesForAssignment(summaries, assignment);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?._id, "s1");
});

test("resolveTodayAssignment keeps yesterday overnight dienst after midnight", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date(2026, 4, 29, 1, 30, 0, 0) });
  try {
    const days = [
      {
        dienstId: "d1",
        assignmentId: "night-28",
        date: "2026-05-28",
        startTime: "22:00",
        endTime: "06:00",
      },
    ];
    const resolved = resolveTodayAssignment(days);
    assert.equal(resolved?.assignmentId, "night-28");
    assert.equal(workdayDataDateKey(resolved), "2026-05-28");
    assert.notEqual(todayDateKey(), "2026-05-28");
  } finally {
    t.mock.timers.reset();
  }
});

test("resolveTodayAssignment drops overnight dienst after shift ends", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date(2026, 4, 29, 7, 0, 0, 0) });
  try {
    const days = [
      {
        dienstId: "d1",
        assignmentId: "night-28",
        date: "2026-05-28",
        startTime: "22:00",
        endTime: "06:00",
      },
    ];
    assert.equal(resolveTodayAssignment(days), null);
  } finally {
    t.mock.timers.reset();
  }
});

test("isNowWithinDienst respects overnight window", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date(2026, 4, 29, 2, 0, 0, 0) });
  try {
    const dienst = { date: "2026-05-28", startTime: "22:00", endTime: "06:00" };
    assert.equal(isNowWithinDienst(dienst), true);
  } finally {
    t.mock.timers.reset();
  }
});
