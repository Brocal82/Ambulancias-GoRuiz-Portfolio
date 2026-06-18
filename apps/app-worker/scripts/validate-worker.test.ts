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
import {
  isAssignmentForUser,
  userIdFromAssignmentField,
} from "../src/utils/assignmentUserId.js";
import { collectAgendaAssignmentRefs } from "../src/utils/workerAgenda.js";
import type { PraemienRuleConfig } from "../src/services/praemien.js";
import { isPraemienRuleEffectiveOnDate } from "../src/utils/praemienRuleValidity.js";
import {
  calculateEffectivePatientsFromSummaryTrips,
  getWorkdayTripPraemieMultiplier,
} from "../src/utils/workdayTripPraemie.js";
import type { WorkdaySummaryTrip } from "../src/services/workday.js";

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

test("userIdFromAssignmentField handles string and populated user refs", () => {
  assert.equal(userIdFromAssignmentField(" 507f1f77bcf86cd799439011 "), "507f1f77bcf86cd799439011");
  assert.equal(
    userIdFromAssignmentField({ _id: "507f1f77bcf86cd799439012", name: "Ana" }),
    "507f1f77bcf86cd799439012",
  );
  assert.equal(userIdFromAssignmentField(null), null);
});

test("isAssignmentForUser matches driver or medic only", () => {
  const userId = "507f1f77bcf86cd799439011";
  assert.equal(
    isAssignmentForUser({ driver: userId, medic: "other" }, userId),
    true,
  );
  assert.equal(
    isAssignmentForUser({ driver: "other", medic: { _id: userId } }, userId),
    true,
  );
  assert.equal(
    isAssignmentForUser({ driver: "other-a", medic: "other-b" }, userId),
    false,
  );
});

test("collectAgendaAssignmentRefs keeps only rows for current worker", () => {
  const userId = "507f1f77bcf86cd799439011";
  const diensts = [
    {
      _id: "dienst-old",
      assignments: [
        {
          date: "2026-06-18",
          startTime: "08:00",
          driver: "other-driver",
          medic: "other-medic",
        },
      ],
    },
    {
      _id: "dienst-new",
      assignments: [
        {
          date: "2026-06-18",
          startTime: "14:00",
          driver: userId,
          medic: "other-medic",
        },
        {
          date: "2026-06-18",
          startTime: "08:00",
          driver: "other-driver",
          medic: "other-medic-2",
        },
      ],
    },
  ];

  const refs = collectAgendaAssignmentRefs(diensts, userId);
  assert.equal(refs.length, 1);
  assert.deepEqual(refs[0], {
    dienstId: "dienst-new",
    dateKey: "2026-06-18",
    startTime: "14:00",
  });
});

const thursdayDate = "2025-06-12";
const wednesdayDate = "2025-06-11";

const baseTrip: WorkdaySummaryTrip = {
  kmStart: 100,
  kmEnd: 101,
  wasCancelled: false,
  countsTrip: 1,
};

const thursdayX2Rules: PraemienRuleConfig = {
  version: 1,
  cancelledTripPolicy: "excludeUnlessCountsTrip",
  rules: [
    {
      id: "thursday-x2",
      type: "weekday",
      label: "Jueves x2",
      enabled: true,
      weekdays: [4],
      multiplier: 2,
    },
  ],
};

test("Thursday x2 Praemien rule applies on Thursday dienst date", () => {
  assert.equal(
    getWorkdayTripPraemieMultiplier(baseTrip, thursdayDate, "08:00", thursdayX2Rules),
    2,
  );
});

test("Thursday x2 Praemien rule does not apply on Wednesday dienst date", () => {
  assert.equal(
    getWorkdayTripPraemieMultiplier(baseTrip, wednesdayDate, "08:00", thursdayX2Rules),
    1,
  );
});

test("future effectiveFrom is ignored for dienst dates before start", () => {
  const rules: PraemienRuleConfig = {
    ...thursdayX2Rules,
    rules: [
      {
        ...thursdayX2Rules.rules[0]!,
        effectiveFrom: "2025-06-20",
      },
    ],
  };
  assert.equal(
    getWorkdayTripPraemieMultiplier(baseTrip, thursdayDate, "08:00", rules),
    1,
  );
  assert.equal(isPraemienRuleEffectiveOnDate(rules.rules[0]!, thursdayDate), false);
});

test("exact effectiveFrom applies on the boundary dienst date", () => {
  const rules: PraemienRuleConfig = {
    ...thursdayX2Rules,
    rules: [
      {
        ...thursdayX2Rules.rules[0]!,
        effectiveFrom: thursdayDate,
      },
    ],
  };
  assert.equal(
    getWorkdayTripPraemieMultiplier(baseTrip, thursdayDate, "08:00", rules),
    2,
  );
  assert.equal(isPraemienRuleEffectiveOnDate(rules.rules[0]!, thursdayDate), true);
});

test("exact effectiveTo applies on the boundary dienst date", () => {
  const rules: PraemienRuleConfig = {
    ...thursdayX2Rules,
    rules: [
      {
        ...thursdayX2Rules.rules[0]!,
        effectiveTo: thursdayDate,
      },
    ],
  };
  assert.equal(
    getWorkdayTripPraemieMultiplier(baseTrip, thursdayDate, "08:00", rules),
    2,
  );
  assert.equal(isPraemienRuleEffectiveOnDate(rules.rules[0]!, thursdayDate), true);
});

test("expired effectiveTo is ignored after the dienst date", () => {
  const rules: PraemienRuleConfig = {
    ...thursdayX2Rules,
    rules: [
      {
        ...thursdayX2Rules.rules[0]!,
        effectiveTo: "2025-06-11",
      },
    ],
  };
  assert.equal(
    getWorkdayTripPraemieMultiplier(baseTrip, thursdayDate, "08:00", rules),
    1,
  );
  assert.equal(isPraemienRuleEffectiveOnDate(rules.rules[0]!, thursdayDate), false);
});

test("Praemien rules without validity dates keep previous preview behavior", () => {
  const longTrip: WorkdaySummaryTrip = { ...baseTrip, kmStart: 0, kmEnd: 22 };
  assert.equal(
    getWorkdayTripPraemieMultiplier(longTrip, thursdayDate, "08:00", thursdayX2Rules),
    2,
  );
  assert.equal(
    getWorkdayTripPraemieMultiplier(longTrip, wednesdayDate, "08:00", null),
    2,
  );
});

test("disabled Praemien rule is ignored in preview multiplier", () => {
  const rules: PraemienRuleConfig = {
    ...thursdayX2Rules,
    rules: [{ ...thursdayX2Rules.rules[0]!, enabled: false }],
  };
  assert.equal(
    getWorkdayTripPraemieMultiplier(baseTrip, thursdayDate, "08:00", rules),
    1,
  );
});

test("default fallback Praemien rules are preserved when config is null", () => {
  const longTrip: WorkdaySummaryTrip = { ...baseTrip, kmStart: 0, kmEnd: 22 };
  assert.equal(getWorkdayTripPraemieMultiplier(longTrip, thursdayDate, "08:00", null), 2);
  assert.equal(
    calculateEffectivePatientsFromSummaryTrips([longTrip], thursdayDate, "08:00", null),
    2,
  );
});
