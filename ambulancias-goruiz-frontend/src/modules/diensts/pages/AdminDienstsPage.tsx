// src/modules/diensts/pages/AdminDienstsPage.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";

import type { Dienst } from "../index";
import type { DienstAssignment, UpdateAssignment } from "../domain/types";
import {
  getAllDiensts,
  generateDienstsForWeek,
  deleteDienstsForWeek,
  assignTeamToWeek,
  assignUserToWeek,
  assignAmbulanceToWeek,
  clearPeopleForWeek,
} from "../index";
import { dndMoveCrossDienstSameWeek, updateDienstPartial } from "../domain/api";
import { buildUpdateAssignment } from "../components/assignmentModal/buildUpdateAssignment";

import AssignmentModal from "../components/assignmentModal/AssignmentModal";
import TeamAssignModal from "../components/TeamAssignModal";
import UserAssignModal from "../components/UserAssignModal";
import AmbulanceAssignModal from "../components/AmbulanceAssignModal";
import WeeklyAssignmentSummaryModal, {
  type WeeklyAssignmentSummaryData,
} from "../components/WeeklyAssignmentSummaryModal";
import {
  formatPersonLabel,
  getWeekStartsBerlin,
  getWeekDays,
  buildDienstDayCellLines,
  getAssignmentStatus,
  getStatusClass,
} from "../utils";

import { dayKeyToLocalDate, toBerlinDayKey } from "../../../utils/dates/dayKey";
import { isPastDay } from "../../../utils/dates/isPastDay";
import { isTeamIncomplete } from "../utils/assignmentUtils";
import { useAuth } from "../../../hooks/useAuth";
import { useModules } from "../../../hooks/useModules";
import { MODULE_KEYS } from "../../../constants/modules";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { toastT } from "../../../utils/toast";
import { toastAmbulanceConflictOrApiError } from "../utils/ambulanceConflictToast";
import { getPscheinInfoAsOfDate } from "../../../utils/pscheinUtils";
import { isDriverEligibleForAssignment } from "../utils/driverEligibility";
import { emitDienstsChanged } from "../utils/dienstEvents";
import { useDienstsChanged } from "../hooks/useDienstsChanged";

import type { FlexibleAssignment } from "../domain/types/flexibleAssignment";

import { DienstDayCell, WeekBlock } from "../components";
import {
  normalizeAmbulanceIdToString,
  toFlexibleFromDienstAssignment,
} from "../assignments";

function shouldShowWeeklyTeamSummary(
  resp: Awaited<ReturnType<typeof assignTeamToWeek>>,
): boolean {
  if (resp.minimumRestWarning) return true;
  if (resp.hints?.driverExpiredButBoth) return true;
  if ((resp.skippedByMinimumRest?.length ?? 0) > 0) return true;
  if ((resp.skippedByMinimumRestRoles?.length ?? 0) > 0) return true;
  if ((resp.skippedByWeeklyConflict?.length ?? 0) > 0) return true;
  if ((resp.skippedByVacation?.length ?? 0) > 0) return true;
  if ((resp.skippedAbsences?.length ?? 0) > 0) return true;
  if ((resp.daysAssignedDriverOnly?.length ?? 0) > 0) return true;
  if ((resp.daysAssignedMedicOnly?.length ?? 0) > 0) return true;
  return false;
}

function shouldShowWeeklyUserSummary(
  auw: Awaited<ReturnType<typeof assignUserToWeek>>,
): boolean {
  if (auw.minimumRestWarning) return true;
  if ((auw.skippedByMinimumRest?.length ?? 0) > 0) return true;
  if ((auw.skippedByVacation?.length ?? 0) > 0) return true;
  if (
    auw.skippedBreakdown &&
    (auw.skippedBreakdown.sick > 0 ||
      auw.skippedBreakdown.vacation > 0 ||
      auw.skippedBreakdown.both > 0)
  )
    return true;
  return false;
}

/**
 * After create-week, merge API `dienstSummaries[].skippedAbsences` (typed, same as assign-team)
 * when present; otherwise derive partial-day signals from persisted assignments only.
 */
function deriveGeneratedWeekTeamSummaryData(
  dienst: Dienst,
  weekStartISO: string,
  t: TFunction,
  skippedAbsencesFromApi?: Array<{
    date: string;
    role: "driver" | "medic";
    reason: "vacation" | "sick";
  }>,
): WeeklyAssignmentSummaryData | null {
  const assignments = dienst.assignments ?? [];
  if (assignments.length === 0) return null;

  if (skippedAbsencesFromApi && skippedAbsencesFromApi.length > 0) {
    let driverName = "—";
    let medicName = "—";
    for (const a of assignments) {
      if (driverName === "—" && getUserIdFromAssignmentField(a.driver)) {
        driverName = formatPersonLabel(a.driver);
      }
      if (medicName === "—" && getUserIdFromAssignmentField(a.medic)) {
        medicName = formatPersonLabel(a.medic);
      }
      if (driverName !== "—" && medicName !== "—") break;
    }

    const syntheticApi = {
      skippedAbsences: skippedAbsencesFromApi,
    } as Awaited<ReturnType<typeof assignTeamToWeek>>;
    if (!shouldShowWeeklyTeamSummary(syntheticApi)) return null;

    return {
      kind: "team",
      dienstNumber: dienst.dienstNumber,
      weekStartDate: weekStartISO,
      driverName,
      medicName,
      message: t(
        "pages.diensts.adminPage.generatedWeekSummaryMessage",
        "Diensts creados para la semana; revisa las asignaciones con incidencias.",
      ),
      updatedCount: assignments.length,
      skippedAbsences: skippedAbsencesFromApi,
    };
  }

  /** Fully empty week: no team to attribute skips to (avoids false-positive vacation rows). */
  const hasAnyPersonInWeek = assignments.some(
    (a) =>
      getUserIdFromAssignmentField(a.driver) ||
      getUserIdFromAssignmentField(a.medic),
  );
  if (!hasAnyPersonInWeek) return null;

  const skippedByVacation: Array<{ date: string; role: "driver" | "medic" }> =
    [];
  const daysAssignedDriverOnly: string[] = [];
  const daysAssignedMedicOnly: string[] = [];

  for (const a of assignments) {
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(a.date ?? "").trim());
    const date = m ? m[1]! : toBerlinDayKey(String(a.date));
    const hasDriver = Boolean(getUserIdFromAssignmentField(a.driver));
    const hasMedic = Boolean(getUserIdFromAssignmentField(a.medic));

    if (hasDriver && !hasMedic) {
      daysAssignedDriverOnly.push(date);
      skippedByVacation.push({ date, role: "medic" });
    } else if (hasMedic && !hasDriver) {
      daysAssignedMedicOnly.push(date);
      skippedByVacation.push({ date, role: "driver" });
    }
  }

  const synthetic = {
    skippedByVacation,
    daysAssignedDriverOnly,
    daysAssignedMedicOnly,
  } as Awaited<ReturnType<typeof assignTeamToWeek>>;

  if (!shouldShowWeeklyTeamSummary(synthetic)) return null;

  let driverName = "—";
  let medicName = "—";
  for (const a of assignments) {
    if (driverName === "—" && getUserIdFromAssignmentField(a.driver)) {
      driverName = formatPersonLabel(a.driver);
    }
    if (medicName === "—" && getUserIdFromAssignmentField(a.medic)) {
      medicName = formatPersonLabel(a.medic);
    }
    if (driverName !== "—" && medicName !== "—") break;
  }

  return {
    kind: "team",
    dienstNumber: dienst.dienstNumber,
    weekStartDate: weekStartISO,
    driverName,
    medicName,
    message: t(
      "pages.diensts.adminPage.generatedWeekSummaryMessage",
      "Diensts creados para la semana; revisa las asignaciones con incidencias.",
    ),
    updatedCount: assignments.length,
    daysAssignedDriverOnly,
    daysAssignedMedicOnly,
    skippedByVacation,
  };
}

const DND_MIME = "application/x-dienst-admin-dnd+json";

type DienstAdminDndPayload = {
  v: 1;
  dienstId: string;
  role: "driver" | "medic";
  userId: string;
  sourceDate: string;
};

function getUserIdFromAssignmentField(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") {
    const s = v.trim();
    return s.length ? s : null;
  }
  if (typeof v === "object" && v !== null && "_id" in v) {
    const id = (v as { _id?: string })._id;
    return typeof id === "string" && id.trim() ? id : null;
  }
  return null;
}


function getAmbulanceRoleFromAssignmentField(
  v: unknown,
): "driver" | "medic" | "both" | undefined {
  if (typeof v === "object" && v !== null && "ambulanceRole" in v) {
    const r = (v as { ambulanceRole?: string }).ambulanceRole;
    if (r === "driver" || r === "medic" || r === "both") return r;
  }
  return undefined;
}

/** Alineado con isAmbulanceRoleValidForSlot (backend): both cubre ambos slots. */
function canDraggedFillTargetSlot(
  ar: "driver" | "medic" | "both" | undefined,
  slot: "driver" | "medic",
): boolean {
  if (!ar) return false;
  if (ar === "both") return true;
  return ar === slot;
}

/**
 * Conductor / sanitario solo pueden ir a su puesto. El rol efectivo de destino
 * no depende de la línea o sub-zona donde soltó el cursor (drop en slot o celda).
 * Rol "both" o ausente: se respeta el objetivo pedido (misma lógica que antes).
 */
function resolveEffectiveTargetRole(
  requestedTargetRole: "driver" | "medic",
  draggedAmbulanceRole: "driver" | "medic" | "both" | undefined,
): "driver" | "medic" {
  if (draggedAmbulanceRole === "driver") return "driver";
  if (draggedAmbulanceRole === "medic") return "medic";
  return requestedTargetRole;
}

function getDraggedUserAmbulanceRole(
  sourceAssignment: DienstAssignment,
  payload: DienstAdminDndPayload,
): "driver" | "medic" | "both" | undefined {
  if (payload.role === "driver") {
    if (
      getUserIdFromAssignmentField(sourceAssignment.driver) === payload.userId
    ) {
      return getAmbulanceRoleFromAssignmentField(sourceAssignment.driver);
    }
  } else {
    if (
      getUserIdFromAssignmentField(sourceAssignment.medic) === payload.userId
    ) {
      return getAmbulanceRoleFromAssignmentField(sourceAssignment.medic);
    }
  }
  return undefined;
}

/** Compare assignment `date` strings that may be YYYY-MM-DD or ISO datetimes. */
function assignmentDayKey(date: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(date.trim());
  if (m) return m[1]!;
  return toBerlinDayKey(date);
}

/**
 * Browsers often merge default drag text into `text/plain`, breaking JSON.parse(raw).
 * Recover a JSON object substring when possible.
 */
function extractJsonObjectFromText(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (t.startsWith("{") && t.endsWith("}")) return t;
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) return t.slice(start, end + 1);
  return null;
}

function parseDndPayload(e: DragEvent): DienstAdminDndPayload | null {
  const raw =
    e.dataTransfer.getData(DND_MIME) || e.dataTransfer.getData("text/plain");
  if (!raw?.trim()) return null;

  let o: unknown;
  try {
    o = JSON.parse(raw);
  } catch {
    const extracted = extractJsonObjectFromText(raw);
    if (!extracted) return null;
    try {
      o = JSON.parse(extracted);
    } catch {
      return null;
    }
  }

  if (!o || typeof o !== "object") return null;
  const p = o as Record<string, unknown>;
  if (p.v !== 1) return null;
  if (p.role !== "driver" && p.role !== "medic") return null;

  const dienstId =
    typeof p.dienstId === "string" && p.dienstId.trim()
      ? p.dienstId.trim()
      : null;
  const userId =
    typeof p.userId === "string" && p.userId.trim()
      ? p.userId.trim()
      : null;
  const sourceDate =
    typeof p.sourceDate === "string" && p.sourceDate.trim()
      ? p.sourceDate.trim()
      : null;

  if (!dienstId || !userId || !sourceDate) return null;

  return {
    v: 1,
    dienstId,
    role: p.role as "driver" | "medic",
    userId,
    sourceDate,
  };
}

function buildRowFromSlotIds(params: {
  assignment: DienstAssignment;
  driverId: string;
  medicId: string;
}): UpdateAssignment {
  const { assignment, driverId, medicId } = params;
  return buildUpdateAssignment({
    date: assignment.date,
    startTime: assignment.startTime,
    endTime: assignment.endTime,
    selectedDriverId: driverId,
    selectedMedicId: medicId,
    ambulanceId: normalizeAmbulanceIdToString(assignment.ambulanceId),
    assignment: toFlexibleFromDienstAssignment(assignment),
  });
}

type AdminDndPreparedCtx = {
  payload: DienstAdminDndPayload;
  sourceDienst: Dienst;
  sourceAssignment: DienstAssignment;
  targetAssignment: DienstAssignment;
  td: string;
  tm: string;
  draggedAmbulanceRole: "driver" | "medic" | "both" | undefined;
  /** Mismo Dienst, mismo día (misma fila de asignación): movimiento o intercambio entre conductor/medic. */
  intraCellSameAssignment: boolean;
};

type PrepareAdminDndResult =
  | { ok: false; kind: "silent" }
  | { ok: false; kind: "toast"; message: string }
  | { ok: true; ctx: AdminDndPreparedCtx };

function prepareAdminDndDrop(params: {
  e: DragEvent;
  diensts: Dienst[];
  targetDienst: Dienst;
  day: string;
  token: string | null;
  assignment: DienstAssignment | undefined;
}): PrepareAdminDndResult {
  const { e, diensts, targetDienst, day, token, assignment } = params;
  const payload = parseDndPayload(e);
  const targetAssignment = assignment;
  if (!payload || !targetAssignment || !token) {
    return { ok: false, kind: "silent" };
  }

  const sourceDienst = diensts.find(
    (d) => String(d._id) === String(payload.dienstId),
  );
  if (!sourceDienst) return { ok: false, kind: "silent" };

  if (
    toBerlinDayKey(sourceDienst.weekStartDate) !==
    toBerlinDayKey(targetDienst.weekStartDate)
  ) {
    return {
      ok: false,
      kind: "toast",
      message:
        "Solo se pueden mover asignaciones dentro de la misma semana.",
    };
  }

  const sourceAssignment = sourceDienst.assignments.find(
    (a) => assignmentDayKey(a.date) === assignmentDayKey(payload.sourceDate),
  );
  if (!sourceAssignment) return { ok: false, kind: "silent" };
  if (
    !sourceAssignment.startTime?.trim() ||
    !sourceAssignment.endTime?.trim()
  ) {
    return { ok: false, kind: "silent" };
  }
  if (
    !targetAssignment.startTime?.trim() ||
    !targetAssignment.endTime?.trim()
  ) {
    return { ok: false, kind: "silent" };
  }

  const sourceSlotId =
    payload.role === "driver"
      ? getUserIdFromAssignmentField(sourceAssignment.driver)
      : getUserIdFromAssignmentField(sourceAssignment.medic);
  if (!sourceSlotId || sourceSlotId !== payload.userId) {
    return { ok: false, kind: "silent" };
  }

  const td = getUserIdFromAssignmentField(targetAssignment.driver) ?? "";
  const tm = getUserIdFromAssignmentField(targetAssignment.medic) ?? "";

  const draggedAmbulanceRole = getDraggedUserAmbulanceRole(
    sourceAssignment,
    payload,
  );

  const intraCellSameAssignment =
    String(sourceDienst._id) === String(targetDienst._id) &&
    assignmentDayKey(payload.sourceDate) === assignmentDayKey(day);

  return {
    ok: true,
    ctx: {
      payload,
      sourceDienst,
      sourceAssignment,
      targetAssignment,
      td,
      tm,
      draggedAmbulanceRole,
      intraCellSameAssignment,
    },
  };
}

function validateAdminDndTargetRole(
  targetRole: "driver" | "medic",
  ctx: AdminDndPreparedCtx,
): string | null {
  const {
    payload,
    targetAssignment,
    td,
    tm,
    draggedAmbulanceRole,
    intraCellSameAssignment,
  } = ctx;

  if (intraCellSameAssignment && td && tm) {
    if (payload.role === targetRole) {
      return "No se puede soltar en el mismo puesto.";
    }
    const otherOccupantId =
      targetRole === "driver" ? td : tm;
    if (payload.userId === otherOccupantId) {
      return "No se puede reasignar el mismo usuario en ambos puestos.";
    }
    const otherAr =
      targetRole === "driver"
        ? getAmbulanceRoleFromAssignmentField(targetAssignment.driver)
        : getAmbulanceRoleFromAssignmentField(targetAssignment.medic);
    if (!canDraggedFillTargetSlot(draggedAmbulanceRole, targetRole)) {
      if (draggedAmbulanceRole === undefined) {
        return "No se puede asignar: falta el rol de ambulancia del usuario arrastrado.";
      }
      return "Este usuario no puede cubrir ese puesto en destino.";
    }
    const otherNewRole =
      targetRole === "driver" ? ("medic" as const) : ("driver" as const);
    if (!canDraggedFillTargetSlot(otherAr, otherNewRole)) {
      return "Este usuario no puede cubrir ese puesto en destino.";
    }
    return null;
  }

  if (td && tm) {
    return "El día destino ya tiene conductor y sanitario.";
  }

  if (!canDraggedFillTargetSlot(draggedAmbulanceRole, targetRole)) {
    if (draggedAmbulanceRole === undefined) {
      return "No se puede asignar: falta el rol de ambulancia del usuario arrastrado.";
    }
    return "Este usuario no puede cubrir ese puesto en destino.";
  }

  const structuralDriverSwap =
    targetRole === "driver" &&
    Boolean(td) &&
    !tm &&
    getAmbulanceRoleFromAssignmentField(targetAssignment.driver) === "both";
  const structuralMedicSwap =
    targetRole === "medic" &&
    Boolean(tm) &&
    !td &&
    getAmbulanceRoleFromAssignmentField(targetAssignment.medic) === "both";

  const smartDriverSwap =
    structuralDriverSwap &&
    (draggedAmbulanceRole === "driver" || draggedAmbulanceRole === "both");
  const smartMedicSwap =
    structuralMedicSwap &&
    (draggedAmbulanceRole === "medic" || draggedAmbulanceRole === "both");

  if (structuralDriverSwap && !smartDriverSwap) {
    if (draggedAmbulanceRole === undefined) {
      return "No se puede reordenar: falta el rol de ambulancia del usuario arrastrado.";
    }
    if (draggedAmbulanceRole === "medic") {
      return "Solo se puede reordenar arrastrando un conductor con rol driver.";
    }
  }
  if (structuralMedicSwap && !smartMedicSwap) {
    if (draggedAmbulanceRole === undefined) {
      return "No se puede reordenar: falta el rol de ambulancia del usuario arrastrado.";
    }
    if (draggedAmbulanceRole === "driver") {
      return "Solo se puede reordenar arrastrando un sanitario con rol medic.";
    }
  }

  if (targetRole === "driver" && td && !smartDriverSwap) {
    return "No se puede soltar: el conductor ya está ocupado.";
  }
  if (targetRole === "medic" && tm && !smartMedicSwap) {
    return "No se puede soltar: el sanitario ya está ocupado.";
  }

  if (smartDriverSwap && payload.userId === td) {
    return "No se puede reasignar el mismo usuario en ambos puestos.";
  }
  if (smartMedicSwap && payload.userId === tm) {
    return "No se puede reasignar el mismo usuario en ambos puestos.";
  }

  return null;
}

async function executeAdminDndDrop(params: {
  ctx: AdminDndPreparedCtx;
  targetRole: "driver" | "medic";
  targetDienst: Dienst;
  day: string;
  token: string;
  fetchDiensts: () => Promise<void>;
}): Promise<void> {
  const { ctx, targetRole, targetDienst, day, token, fetchDiensts } = params;
  const { payload, sourceAssignment, targetAssignment } = ctx;
  const { td, tm, draggedAmbulanceRole, intraCellSameAssignment } = ctx;

  if (intraCellSameAssignment && td && tm) {
    const mergedRow =
      targetRole === "driver"
        ? buildRowFromSlotIds({
            assignment: targetAssignment,
            driverId: payload.userId,
            medicId: td,
          })
        : buildRowFromSlotIds({
            assignment: targetAssignment,
            driverId: tm,
            medicId: payload.userId,
          });
    try {
      const saved = await updateDienstPartial(
        targetDienst._id,
        { assignments: [mergedRow] },
        token,
      );
      if (saved.minimumRestWarning) {
        toastT.warn(saved.minimumRestWarning.message);
      }
      emitDienstsChanged();
      toastT.success(["toasts.assignments.saveSuccess"]);
      await fetchDiensts();
    } catch (error) {
      console.error("Dienst DnD move:", error);
      toastAmbulanceConflictOrApiError(error, ["toasts.assignments.saveError"]);
    }
    return;
  }

  /**
   * Mismo día/celda con un solo ocupante: mover a la otra plaza sin fila intermedia
   * que repita el mismo userId en driver y medic (el path de dos filas reutilizaba
   * td/tm iniciales y provocaba 409 driver_medic_same_user).
   */
  if (intraCellSameAssignment && !(td && tm)) {
    const mergedRow =
      targetRole === "driver"
        ? buildRowFromSlotIds({
            assignment: targetAssignment,
            driverId: payload.userId,
            medicId: "",
          })
        : buildRowFromSlotIds({
            assignment: targetAssignment,
            driverId: "",
            medicId: payload.userId,
          });
    try {
      const saved = await updateDienstPartial(
        targetDienst._id,
        { assignments: [mergedRow] },
        token,
      );
      if (saved.minimumRestWarning) {
        toastT.warn(saved.minimumRestWarning.message);
      }
      emitDienstsChanged();
      toastT.success(["toasts.assignments.saveSuccess"]);
      await fetchDiensts();
    } catch (error) {
      console.error("Dienst DnD move:", error);
      toastAmbulanceConflictOrApiError(error, ["toasts.assignments.saveError"]);
    }
    return;
  }

  const structuralDriverSwap =
    targetRole === "driver" &&
    Boolean(td) &&
    !tm &&
    getAmbulanceRoleFromAssignmentField(targetAssignment.driver) === "both";
  const structuralMedicSwap =
    targetRole === "medic" &&
    Boolean(tm) &&
    !td &&
    getAmbulanceRoleFromAssignmentField(targetAssignment.medic) === "both";

  const smartDriverSwap =
    structuralDriverSwap &&
    (draggedAmbulanceRole === "driver" || draggedAmbulanceRole === "both");
  const smartMedicSwap =
    structuralMedicSwap &&
    (draggedAmbulanceRole === "medic" || draggedAmbulanceRole === "both");

  const sd = getUserIdFromAssignmentField(sourceAssignment.driver) ?? "";
  const sm = getUserIdFromAssignmentField(sourceAssignment.medic) ?? "";

  let sourceRow: UpdateAssignment;
  let targetRow: UpdateAssignment;

  if (payload.role === "driver") {
    sourceRow = buildRowFromSlotIds({
      assignment: sourceAssignment,
      driverId: "",
      medicId: sm,
    });
  } else {
    sourceRow = buildRowFromSlotIds({
      assignment: sourceAssignment,
      driverId: sd,
      medicId: "",
    });
  }

  if (smartDriverSwap) {
    targetRow = buildRowFromSlotIds({
      assignment: targetAssignment,
      driverId: payload.userId,
      medicId: td,
    });
  } else if (smartMedicSwap) {
    targetRow = buildRowFromSlotIds({
      assignment: targetAssignment,
      driverId: tm,
      medicId: payload.userId,
    });
  } else if (targetRole === "driver") {
    targetRow = buildRowFromSlotIds({
      assignment: targetAssignment,
      driverId: payload.userId,
      medicId: tm,
    });
  } else {
    targetRow = buildRowFromSlotIds({
      assignment: targetAssignment,
      driverId: td,
      medicId: payload.userId,
    });
  }

  if (smartDriverSwap || smartMedicSwap) {
    const reorderMsg = smartDriverSwap
      ? "El conductor actual tiene rol Both y pasará al puesto de sanitario. El trabajador arrastrado quedará como conductor. ¿Confirmar?"
      : "El sanitario actual tiene rol Both y pasará al puesto de conductor. El trabajador arrastrado quedará como sanitario. ¿Confirmar?";
    if (!window.confirm(reorderMsg)) {
      return;
    }
  }

  const crossDienst = String(payload.dienstId) !== String(targetDienst._id);

  try {
    if (crossDienst) {
      const dndRes = await dndMoveCrossDienstSameWeek(
        {
          sourceDienstId: String(payload.dienstId),
          sourceDate: assignmentDayKey(payload.sourceDate),
          targetDienstId: String(targetDienst._id),
          targetDate: day,
          role: payload.role,
          targetRole,
          userId: payload.userId,
        },
        token,
      );
      if (dndRes.minimumRestWarning) {
        toastT.warn(dndRes.minimumRestWarning.message);
      }
    } else {
      const saved = await updateDienstPartial(
        targetDienst._id,
        { assignments: [sourceRow, targetRow] },
        token,
      );
      if (saved.minimumRestWarning) {
        toastT.warn(saved.minimumRestWarning.message);
      }
    }
    emitDienstsChanged();
    toastT.success(["toasts.assignments.saveSuccess"]);
    await fetchDiensts();
  } catch (error) {
    console.error("Dienst DnD move:", error);
    toastAmbulanceConflictOrApiError(error, ["toasts.assignments.saveError"]);
  }
}

const AdminPage = () => {
  const [diensts, setDiensts] = useState<Dienst[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState<{
    date: string;
    assignment?: FlexibleAssignment;
    dienstId: string;
  } | null>(null);

  // ⬇️ estado local para el modal de asignar Team a la semana
  const [weekTeamModal, setWeekTeamModal] = useState<{
    open: boolean;
    dienstNumber: number;
    weekStartISO: string;
  } | null>(null);

  const [weekUserModal, setWeekUserModal] = useState<{
    open: boolean;
    weekStartISO: string;
    dienstNumber: number;
  } | null>(null);

  const [weekAmbulanceModal, setWeekAmbulanceModal] = useState<{
    open: boolean;
    dienstNumber: number;
    weekStartISO: string;
  } | null>(null);

  /** FIFO queue: same modal as manual assign; multiple entries after generate-week. */
  const [weeklySummaryQueue, setWeeklySummaryQueue] = useState<
    WeeklyAssignmentSummaryData[]
  >([]);

  // Estado para colapsar/desplegar semanas (key = weekStartISO)
  const [collapsedWeeks, setCollapsedWeeks] = useState<Record<string, boolean>>(
    {},
  );

  const { token } = useAuth();
  const { hasModule } = useModules();
  const ambulancesModuleOn = hasModule(MODULE_KEYS.AMBULANCES);
  const { t, i18n } = useTranslation();

  const fmtDate = (d: Date) => d.toLocaleDateString(i18n.language);

  const toggleWeekCollapsed = (weekKey: string) => {
    setCollapsedWeeks((prev) => ({
      ...prev,
      [weekKey]: !prev[weekKey],
    }));
  };

  const fetchDiensts = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getAllDiensts(token);

      // ✅ Nos quedamos con todos los Diensts con número >= 1
      //    y los ordenamos por número ascendente.
      const normalized = data
        .filter(
          (d) => typeof d.dienstNumber === "number" && d.dienstNumber >= 1,
        )
        .sort((a, b) => a.dienstNumber - b.dienstNumber);

      setDiensts(normalized);
    } catch (error) {
      console.error("Error al obtener los diensts:", error);
    } finally {
      setIsInitialLoading(false);
    }
  }, [token]);

  const fetchDienstsRef = useRef(fetchDiensts);
  fetchDienstsRef.current = fetchDiensts;

  useDienstsChanged(() => void fetchDienstsRef.current?.());

  useEffect(() => {
    fetchDiensts();
  }, [fetchDiensts]);

  const weekStartKeys = getWeekStartsBerlin(3);

  return (
    <div className="w-full">
      <h2 className="text-2xl font-semibold tracking-tight text-slate-900 text-center mb-4">
        {t("pages.diensts.adminPage.title")}
      </h2>

      {isInitialLoading ? (
        <div className="mb-6 rounded-xl bg-white ring-1 ring-slate-200 p-4 text-sm text-slate-600">
          Cargando diensts...
        </div>
      ) : (
        weekStartKeys.map((weekStartISO) => {
          const weekStart = dayKeyToLocalDate(weekStartISO);

          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);

          const isCollapsed = collapsedWeeks[weekStartISO] ?? false;
          const hasWeekDiensts = diensts.some((d) => {
            if (!d.weekStartDate) return false;
            return toBerlinDayKey(d.weekStartDate) === weekStartISO;
          });

          const title = t("pages.diensts.adminPage.weekRange", {
            from: fmtDate(weekStart),
            to: fmtDate(weekEnd),
          });

          return (
            <WeekBlock
              key={weekStartISO}

              title={title}
              withGrid={false}
              showTitle={false}
              className="mb-5"
            >

              {/* Header de semana */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-300 pb-2 mb-3">
                {hasWeekDiensts ? (
                  // Si hay Diensts: header clicable con flecha 🔼 / 🔽
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900 focus:outline-none"
                    onClick={() => toggleWeekCollapsed(weekStartISO)}
                    aria-expanded={!isCollapsed}
                  >
                    <span>{title}</span>
                    <span className="text-xs">{isCollapsed ? "🔽" : "🔼"}</span>
                  </button>
                ) : (
                  // Si NO hay Diensts: solo texto, sin flecha y sin onClick
                  <h2 className="text-sm font-medium text-slate-700">{title}</h2>
                )}

                <div className="flex flex-wrap gap-2">
                  {/* Mostrar botón Crear solo si NO existen Diensts esa semana */}
                  {!hasWeekDiensts && (
                    <button
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-colors"
                      onClick={async () => {
                        const confirmCreate = confirm(
                          t("pages.diensts.adminPage.confirmCreate", {
                            date: fmtDate(weekStart),
                          }),
                        );
                        if (!confirmCreate || !token) return;

                        try {
                          const gen = await generateDienstsForWeek(
                            weekStartISO,
                            token,
                          );
                          toastT.success([
                            "pages.diensts.adminPage.alerts.createOk",
                          ]);
                          const data = await getAllDiensts(token);
                          const normalized = data
                            .filter(
                              (d) =>
                                typeof d.dienstNumber === "number" &&
                                d.dienstNumber >= 1,
                            )
                            .sort((a, b) => a.dienstNumber - b.dienstNumber);
                          setDiensts(normalized);

                          const weekDiensts = normalized.filter(
                            (d) =>
                              d.weekStartDate &&
                              toBerlinDayKey(d.weekStartDate) === weekStartISO,
                          );
                          const summaries: WeeklyAssignmentSummaryData[] = [];
                          for (const d of weekDiensts) {
                            const fromApi = gen.dienstSummaries?.find(
                              (s) => s.dienstNumber === d.dienstNumber,
                            );
                            const s = deriveGeneratedWeekTeamSummaryData(
                              d,
                              weekStartISO,
                              t,
                              fromApi?.skippedAbsences,
                            );
                            if (s) summaries.push(s);
                          }
                          summaries.sort(
                            (a, b) => a.dienstNumber - b.dienstNumber,
                          );
                          if (summaries.length > 0) {
                            setWeeklySummaryQueue(summaries);
                          }
                        } catch (err) {
                          console.error("Error al crear plantillas:", err);
                          toastT.error([
                            "pages.diensts.adminPage.alerts.createErr",
                          ]);
                        }
                      }}
                    >
                      {t("pages.diensts.adminPage.actions.create")}
                    </button>
                  )}

                  {/* Mostrar botón Borrar solo si EXISTEN Diensts esa semana */}
                  {hasWeekDiensts && (
                    <button
                      className="inline-flex items-center gap-2 rounded-lg bg-rose-500/90 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-200 transition-colors"
                      onClick={async () => {
                        const confirmDelete = confirm(
                          t("pages.diensts.adminPage.confirmDelete", {
                            date: fmtDate(weekStart),
                          }),
                        );
                        if (!confirmDelete || !token) return;

                        try {
                          await deleteDienstsForWeek(weekStartISO, token);
                          toastT.success([
                            "pages.diensts.adminPage.alerts.deleteOk",
                          ]);
                          fetchDiensts();
                        } catch (err) {
                          console.error("Error al eliminar diensts:", err);
                          toastT.error([
                            "pages.diensts.adminPage.alerts.deleteErr",
                          ]);
                        }
                      }}
                    >
                      {t("pages.diensts.adminPage.actions.delete")}
                    </button>
                  )}
                </div>
              </div>

              {/* Listado de diensts de esa semana */}
              {!isCollapsed && (
                <>
                  {/* Cabecera de columnas: lun–dom con fecha, una vez por semana */}
                  {hasWeekDiensts && (
                    <div className="flex gap-3 mb-2">
                      <div className="w-14 shrink-0" />
                      <div className="grid grid-cols-7 gap-2 flex-1">
                        {getWeekDays(weekStartISO).map((day) => {
                          const d = new Date(`${day}T12:00:00`);
                          const dayName = d.toLocaleDateString(i18n.language, { weekday: "short" });
                          const dayDate = d.toLocaleDateString(i18n.language, { day: "2-digit", month: "2-digit" });
                          return (
                            <div key={day} className="text-center px-1">
                              <p className="text-xs font-semibold text-slate-600 capitalize">{dayName}</p>
                              <p className="text-xs text-slate-400">{dayDate}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {diensts
                    .filter((dienst) => {
                      if (!dienst.weekStartDate) return false;
                      return (
                        toBerlinDayKey(dienst.weekStartDate) === weekStartISO
                      );
                    })
                    .map((dienst) => {
                      const weekDates = getWeekDays(weekStartISO);

                      // ✅ Mostrar swap/clear solo si hay alguien asignado en la semana
                      const hasAnyPersonAssigned =
                        Array.isArray(dienst.assignments) &&
                        dienst.assignments.some(
                          (a) =>
                            a?.date &&
                            a?.startTime &&
                            a?.endTime &&
                            (a.driver || a.medic),
                        );

                      return (
                        <div
                          key={`${weekStart.toISOString()}-${dienst.dienstNumber}`}
                          className="mb-4 flex gap-3 items-start"
                        >
                          {/* Sidebar: número de Dienst y acciones */}
                          <div className="w-16 shrink-0 flex flex-col items-stretch gap-0">

                            {/* Grupo superior: identidad (#N + 🧽) — única zona con fondo */}
                            <div className="grid w-full min-h-[26px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-1 rounded-md border border-slate-200/80 bg-slate-50/90 px-1.5 py-1 shadow-sm shadow-slate-900/[0.03]">
                              <span className="text-sm font-bold tabular-nums text-slate-800 leading-none truncate">
                                #{dienst.dienstNumber}
                              </span>

                              {/* 🧽 Limpiar asignaciones (solo si hay alguien asignado) */}
                              {hasAnyPersonAssigned && (
                                <button
                                  className="flex items-center justify-center w-5 h-5 text-slate-500 hover:text-rose-700 transition-transform transform hover:scale-110 focus:outline-none"
                                  title={t(
                                    "pages.diensts.adminPage.clearWeekPeople",
                                  )}
                                  onClick={async () => {
                                    if (!token) return;
                                    const ok = confirm(
                                      t("pages.diensts.adminPage.confirmClear", {
                                        num: dienst.dienstNumber,
                                        date: fmtDate(weekStart),
                                      }) as string,
                                    );
                                    if (!ok) return;

                                    try {
                                      await clearPeopleForWeek(
                                        {
                                          dienstNumber: dienst.dienstNumber,
                                          weekStartDate: weekStartISO,
                                        },
                                        token,
                                      );
                                      toastT.success([
                                        "pages.diensts.adminPage.clearOk",
                                      ]);
                                      fetchDiensts();
                                    } catch (err) {
                                      console.error(err);
                                      toastT.error([
                                        "pages.diensts.adminPage.clearErr",
                                      ]);
                                    }
                                  }}
                                >
                                  <span
                                    aria-hidden
                                    className="block text-[14px] leading-none translate-y-[0.5px]"
                                  >
                                    🧽
                                  </span>
                                  <span className="sr-only">
                                    {t("pages.diensts.adminPage.clearWeekPeople")}
                                  </span>
                                </button>
                              )}
                            </div>

                            {/* Grupo inferior: acciones — sin fondo de panel; separado por línea + espacio */}
                            <div className="grid w-full min-h-[28px] grid-cols-3 place-items-center gap-x-0.5 border-t border-slate-200/60 pt-1.5">
                              {/* 👤 Asignar un trabajador (siempre visible) */}
                              <button
                                className="flex items-center justify-center w-5 h-5 text-slate-500 hover:text-slate-900 transition-transform transform hover:scale-110 focus:outline-none"
                                title={t(
                                  "pages.diensts.adminPage.assignUserToWeek",
                                )}
                                onClick={() =>
                                  setWeekUserModal({
                                    open: true,
                                    dienstNumber: dienst.dienstNumber,
                                    weekStartISO,
                                  })
                                }
                              >
                                <span
                                  aria-hidden
                                  className="block text-[14px] leading-none translate-y-[1px] scale-[0.95]"
                                >
                                  👤
                                </span>
                                <span className="sr-only">
                                  {t("pages.diensts.adminPage.assignUserToWeek")}
                                </span>
                              </button>

                              {/* 👥 Asignar pareja (siempre visible) */}
                              <button
                                className="flex items-center justify-center w-5 h-5 text-slate-500 hover:text-slate-900 transition-transform transform hover:scale-110 focus:outline-none"
                                title={t(
                                  "pages.diensts.adminPage.assignTeamToWeek",
                                )}
                                onClick={() =>
                                  setWeekTeamModal({
                                    open: true,
                                    dienstNumber: dienst.dienstNumber,
                                    weekStartISO,
                                  })
                                }
                              >
                                <span
                                  aria-hidden
                                  className="block text-[15px] leading-none -translate-y-[1px] scale-[1.12]"
                                >
                                  👥
                                </span>
                                <span className="sr-only">
                                  {t("pages.diensts.adminPage.assignTeamToWeek")}
                                </span>
                              </button>

                              {/* 🚑 Asignar ambulancia a la semana */}
                              {ambulancesModuleOn ? (
                                <button
                                  className="flex items-center justify-center w-5 h-5 text-slate-500 hover:text-slate-900 transition-transform transform hover:scale-110 focus:outline-none"
                                  title={t(
                                    "pages.diensts.adminPage.assignAmbulanceToWeek",
                                    "Asignar ambulancia a la semana",
                                  )}
                                  onClick={() =>
                                    setWeekAmbulanceModal({
                                      open: true,
                                      dienstNumber: dienst.dienstNumber,
                                      weekStartISO,
                                    })
                                  }
                                >
                                  <span
                                    aria-hidden
                                    className="block text-[14px] leading-none"
                                  >
                                    🚑
                                  </span>
                                  <span className="sr-only">
                                    {t(
                                      "pages.diensts.adminPage.assignAmbulanceToWeek",
                                      "Asignar ambulancia a la semana",
                                    )}
                                  </span>
                                </button>
                              ) : null}
                            </div>

                          </div>

                          {/* Grid de 7 días */}
                          <div className="grid grid-cols-7 gap-2 flex-1">
                            {weekDates.map((day) => {
                              const assignment = dienst.assignments.find(
                                (a) => a.date === day,
                              );
                              const status = getAssignmentStatus(assignment);
                              const cls = getStatusClass(status);

                              const incompleteBorderClass =
                                assignment && isTeamIncomplete(assignment)
                                  ? "border-2 border-red-500"
                                  : "border border-transparent";

                              const isPast = isPastDay(day);

                              const driverUserId = assignment
                                ? getUserIdFromAssignmentField(assignment.driver)
                                : null;
                              const medicUserId = assignment
                                ? getUserIdFromAssignmentField(assignment.medic)
                                : null;
                              const canDndCell = !isPast && Boolean(assignment);
                              const driverDraggable = canDndCell && Boolean(driverUserId);
                              const medicDraggable = canDndCell && Boolean(medicUserId);
                              const bothIncumbentDriverSwap =
                                Boolean(driverUserId) &&
                                !medicUserId &&
                                getAmbulanceRoleFromAssignmentField(
                                  assignment?.driver,
                                ) === "both";
                              const bothIncumbentMedicSwap =
                                Boolean(medicUserId) &&
                                !driverUserId &&
                                getAmbulanceRoleFromAssignmentField(
                                  assignment?.medic,
                                ) === "both";
                              /** Intercambio mismo día/celda: ambas plazas ocupadas → hace falta zona de drop. */
                              const bothSlotsOccupied =
                                canDndCell &&
                                Boolean(driverUserId) &&
                                Boolean(medicUserId);
                              const driverDropTarget =
                                canDndCell &&
                                (!driverUserId ||
                                  bothIncumbentDriverSwap ||
                                  bothSlotsOccupied);
                              const medicDropTarget =
                                canDndCell &&
                                (!medicUserId ||
                                  bothIncumbentMedicSwap ||
                                  bothSlotsOccupied);

                              const cellDropTarget =
                                canDndCell &&
                                (driverDropTarget || medicDropTarget);

                              const handleDropOnRole = async (
                                targetRole: "driver" | "medic",
                                e: DragEvent,
                              ) => {
                                const prep = prepareAdminDndDrop({
                                  e,
                                  diensts,
                                  targetDienst: dienst,
                                  day,
                                  token,
                                  assignment,
                                });
                                if (!prep.ok) {
                                  if (prep.kind === "toast") {
                                    toastT.error(prep.message);
                                  }
                                  return;
                                }
                                const { ctx } = prep;
                                const effectiveTargetRole = resolveEffectiveTargetRole(
                                  targetRole,
                                  ctx.draggedAmbulanceRole,
                                );
                                if (
                                  ctx.intraCellSameAssignment &&
                                  effectiveTargetRole === ctx.payload.role
                                ) {
                                  return;
                                }
                                const err = validateAdminDndTargetRole(
                                  effectiveTargetRole,
                                  ctx,
                                );
                                if (err) {
                                  toastT.error(err);
                                  return;
                                }
                                if (!token) return;
                                await executeAdminDndDrop({
                                  ctx,
                                  targetRole: effectiveTargetRole,
                                  targetDienst: dienst,
                                  day,
                                  token,
                                  fetchDiensts,
                                });
                              };

                              const handleCellDrop = async (e: DragEvent) => {
                                const prep = prepareAdminDndDrop({
                                  e,
                                  diensts,
                                  targetDienst: dienst,
                                  day,
                                  token,
                                  assignment,
                                });
                                if (!prep.ok) {
                                  if (prep.kind === "toast") {
                                    toastT.error(prep.message);
                                  }
                                  return;
                                }
                                const { ctx } = prep;
                                const ar = ctx.draggedAmbulanceRole;
                                if (ar === "driver" || ar === "medic") {
                                  const tr = ar === "driver" ? "driver" : "medic";
                                  if (
                                    ctx.intraCellSameAssignment &&
                                    tr === ctx.payload.role
                                  ) {
                                    return;
                                  }
                                  const err = validateAdminDndTargetRole(tr, ctx);
                                  if (err) {
                                    toastT.error(err);
                                    return;
                                  }
                                  if (!token) return;
                                  await executeAdminDndDrop({
                                    ctx,
                                    targetRole: tr,
                                    targetDienst: dienst,
                                    day,
                                    token,
                                    fetchDiensts,
                                  });
                                  return;
                                }
                                const order =
                                  ctx.payload.role === "driver"
                                    ? (["driver", "medic"] as const)
                                    : (["medic", "driver"] as const);
                                let firstErr: string | null = null;
                                let tried = false;
                                for (const tr of order) {
                                  if (
                                    ctx.intraCellSameAssignment &&
                                    tr === ctx.payload.role
                                  ) {
                                    continue;
                                  }
                                  if (tr === "driver" && !driverDropTarget) {
                                    continue;
                                  }
                                  if (tr === "medic" && !medicDropTarget) {
                                    continue;
                                  }
                                  tried = true;
                                  const err = validateAdminDndTargetRole(tr, ctx);
                                  if (err === null) {
                                    if (!token) return;
                                    await executeAdminDndDrop({
                                      ctx,
                                      targetRole: tr,
                                      targetDienst: dienst,
                                      day,
                                      token,
                                      fetchDiensts,
                                    });
                                    return;
                                  }
                                  if (firstErr === null) firstErr = err;
                                }
                                if (firstErr) {
                                  toastT.error(firstErr);
                                } else if (tried) {
                                  toastT.error(
                                    "No se puede asignar en ningún puesto disponible.",
                                  );
                                }
                              };

                              const makeDragStartHandler = (
                                role: "driver" | "medic",
                                userId: string,
                              ) => {
                                return (e: DragEvent) => {
                                  const payload: DienstAdminDndPayload = {
                                    v: 1,
                                    dienstId: String(dienst._id),
                                    role,
                                    userId,
                                    sourceDate: day,
                                  };
                                  const json = JSON.stringify(payload);
                                  e.dataTransfer.setData(DND_MIME, json);
                                  e.dataTransfer.setData("text/plain", json);
                                  e.dataTransfer.effectAllowed = "move";
                                };
                              };

                              const driverLine = assignment ? (
                                <>
                                  👨‍✈️{" "}
                                  {(() => {
                                    let drvClass = "";
                                    let drvTitle: string | undefined;

                                    if (typeof assignment.driver === "object" && assignment.driver) {
                                      const drv = assignment.driver as {
                                        ambulanceRole?: string;
                                        pscheinExpiry?: string | null;
                                        pscheinConfirmedAt?: string | Date | null;
                                      };
                                      const eligible = isDriverEligibleForAssignment(
                                        {
                                          ambulanceRole: drv.ambulanceRole as any,
                                          pscheinExpiry: drv.pscheinExpiry,
                                          pscheinConfirmedAt: drv.pscheinConfirmedAt,
                                        },
                                        day,
                                      );

                                      if (!eligible) {
                                        drvClass = "text-red-600 font-medium";
                                        drvTitle = t(
                                          "pages.diensts.adminPage.driverPscheinExpired",
                                          "P-Schein caducado",
                                        );
                                      } else {
                                        const info = getPscheinInfoAsOfDate(
                                          drv.pscheinExpiry ?? undefined,
                                          day,
                                        );
                                        if (info.status === "warning") {
                                          drvClass = "text-amber-600 font-medium";
                                          drvTitle = t(
                                            "pages.diensts.adminPage.driverPscheinWarning",
                                            {
                                              count: info.monthsLeft ?? 0,
                                            },
                                          );
                                        }
                                      }
                                    }

                                    return (
                                      <span className={drvClass} title={drvTitle}>
                                        {formatPersonLabel(assignment.driver)}
                                      </span>
                                    );
                                  })()}
                                </>
                              ) : undefined;

                              return (
                                <DienstDayCell
                                  key={day}
                                  dayISO={day}
                                  statusClass={cls}
                                  incompleteBorderClass={incompleteBorderClass}
                                  isPast={isPast}
                                  isPartial={status === "partial"}
                                  onOpen={() => {
                                    setSelectedAssignment({
                                      date: day,
                                      assignment: toFlexibleFromDienstAssignment(assignment),

                                      dienstId: dienst._id,
                                    });
                                  }}
                                  adminDnd={{
                                    driverDraggable,
                                    medicDraggable,
                                    driverDropTarget,
                                    medicDropTarget,
                                    cellDropTarget,
                                    onDragStartDriver:
                                      driverUserId != null
                                        ? makeDragStartHandler("driver", driverUserId)
                                        : undefined,
                                    onDragStartMedic:
                                      medicUserId != null
                                        ? makeDragStartHandler("medic", medicUserId)
                                        : undefined,
                                    onDropDriver: (e) => handleDropOnRole("driver", e),
                                    onDropMedic: (e) => handleDropOnRole("medic", e),
                                    onDropCell: handleCellDrop,
                                  }}
                                  lines={{
                                    ...buildDienstDayCellLines({
                                      isoDay: day,
                                      lang: i18n.language,
                                      freeLabel: `🌴 ${t("pages.diensts.adminPage.freeDay")}`,
                                      assignment: assignment
                                        ? {
                                          startTime: assignment.startTime,
                                          endTime: assignment.endTime,
                                          ambulanceId: assignment.ambulanceId,
                                          driver: assignment.driver,
                                          medic: assignment.medic,
                                        }
                                        : null,
                                    }),

                                    // ✅ mantenemos tu lógica especial del driver (P-Schein)
                                    ...(assignment ? { driverLine } : {}),
                                    // Fecha fuera de la celda en admin: se muestra en la cabecera semanal
                                    dateLine: undefined,
                                  }}

                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                </>
              )}
            </WeekBlock>
          );
        })
      )}

      {selectedAssignment && (
        <AssignmentModal
          isOpen={true}
          date={selectedAssignment.date}
          assignment={selectedAssignment.assignment}
          dienstId={selectedAssignment.dienstId}
          onClose={() => {
            setSelectedAssignment(null);
          }}
          onUpdate={fetchDiensts}
        />
      )}

      {/* Modal Team semana */}
      {weekTeamModal?.open && (
        <TeamAssignModal
          isOpen={true}
          onClose={() => setWeekTeamModal(null)}
          onConfirm={async (teamId: string, resolvedRoles, displayNames) => {
            if (!token || !weekTeamModal) return;
            try {
              const resp = await assignTeamToWeek(
                {
                  dienstNumber: weekTeamModal.dienstNumber,
                  weekStartDate: weekTeamModal.weekStartISO,
                  teamId,
                  resolvedRoles,
                },
                token,
              );

              toastT.success(["pages.diensts.adminPage.assignWeekOk"]);

              setWeekTeamModal(null);
              emitDienstsChanged();
              fetchDiensts();

              if (shouldShowWeeklyTeamSummary(resp)) {
                setWeeklySummaryQueue([
                  {
                    kind: "team",
                    dienstNumber: weekTeamModal.dienstNumber,
                    weekStartDate: weekTeamModal.weekStartISO,
                    driverName: displayNames?.driverName ?? "—",
                    medicName: displayNames?.medicName ?? "—",
                    message: resp.message,
                    updatedCount: resp.updatedCount,
                    daysAssignedFull: resp.daysAssignedFull,
                    daysAssignedDriverOnly: resp.daysAssignedDriverOnly,
                    daysAssignedMedicOnly: resp.daysAssignedMedicOnly,
                    skippedByMinimumRest: resp.skippedByMinimumRest,
                    skippedByMinimumRestRoles: resp.skippedByMinimumRestRoles,
                    skippedByWeeklyConflict: resp.skippedByWeeklyConflict,
                    skippedByVacation: resp.skippedByVacation,
                    skippedAbsences: resp.skippedAbsences,
                    minimumRestWarning: resp.minimumRestWarning,
                    hints: resp.hints,
                  },
                ]);
              }
            } catch (err: any) {
              const code = err?.response?.data?.code as string | undefined;
              const details = err?.response?.data?.details;

              if (code === "pschein_expired") {
                toastT.error(["pages.diensts.adminPage.errors.pscheinExpired"]);
              } else if (code === "no_assignable_days") {
                toastT.error([
                  "pages.diensts.adminPage.assignUserNoAssignableDays",
                ]);
              } else if (code === "no_assignable_days_minimum_rest") {
                toastT.apiError(err, [
                  "pages.diensts.adminPage.assignWeekErr",
                ]);
              } else if (code === "weekly_conflict") {
                let driverDates = "";
                let medicDates = "";

                if (Array.isArray(details)) {
                  driverDates = details
                    .filter((d: any) => d?.role === "driver")
                    .map((d: any) => d?.date)
                    .filter(Boolean)
                    .join(", ");
                  medicDates = details
                    .filter((d: any) => d?.role === "medic")
                    .map((d: any) => d?.date)
                    .filter(Boolean)
                    .join(", ");
                } else if (details && typeof details === "object") {
                  const drv = Array.isArray(details.driverConf)
                    ? details.driverConf
                    : [];
                  const med = Array.isArray(details.medicConf)
                    ? details.medicConf
                    : [];
                  driverDates = drv
                    .map((d: any) => d?.date)
                    .filter(Boolean)
                    .join(", ");
                  medicDates = med
                    .map((d: any) => d?.date)
                    .filter(Boolean)
                    .join(", ");
                }

                if (driverDates || medicDates) {
                  toastT.error([
                    "pages.diensts.adminPage.teamWeeklyConflictWithDates",
                    { driverDates, medicDates },
                  ]);
                } else {
                  toastT.error(["pages.diensts.adminPage.teamWeeklyConflict"]);
                }
              } else {
                toastT.error(["pages.diensts.adminPage.assignWeekErr"]);
              }

              console.error(
                "assignTeamToWeek error:",
                err?.response?.data || err,
              );
            }
          }}
          weekStartISO={weekTeamModal.weekStartISO}
          dienstNumber={weekTeamModal.dienstNumber}
        />
      )}

      {/* Modal Usuario semana */}
      {weekUserModal?.open && (
        <UserAssignModal
          isOpen={true}
          onClose={() => setWeekUserModal(null)}
          onConfirm={async ({ role, userId, workerName }) => {
            if (!token || !weekUserModal) return;

            try {
              const auw = await assignUserToWeek(
                {
                  dienstNumber: weekUserModal.dienstNumber,
                  weekStartDate: weekUserModal.weekStartISO,
                  role,
                  userId,
                },
                token,
              );

              toastT.success(["pages.diensts.adminPage.assignUserWeekOk"]);

              setWeekUserModal(null);
              emitDienstsChanged();
              fetchDiensts();

              if (shouldShowWeeklyUserSummary(auw)) {
                setWeeklySummaryQueue([
                  {
                    kind: "user",
                    dienstNumber: weekUserModal.dienstNumber,
                    weekStartDate: weekUserModal.weekStartISO,
                    workerName,
                    role,
                    message: auw.message,
                    updatedCount: auw.updatedCount,
                    skippedByMinimumRest: auw.skippedByMinimumRest,
                    skippedByVacation: auw.skippedByVacation,
                    skippedBreakdown: auw.skippedBreakdown,
                    minimumRestWarning: auw.minimumRestWarning,
                  },
                ]);
              }
            } catch (err: any) {
              console.error("❌ Error al asignar usuario a la semana:", err);

              if (err?.response?.data?.code === "weekly_conflict") {
                toastT.error([
                  "pages.diensts.adminPage.assignUserWeekConflict",
                ]);
              } else if (err?.response?.data?.code === "pschein_expired") {
                toastT.error([
                  "pages.diensts.adminPage.assignUserWeekPscheinExpired",
                ]);
              } else if (err?.response?.data?.code === "no_assignable_days") {
                toastT.error([
                  "pages.diensts.adminPage.assignUserNoAssignableDays",
                ]);
              } else if (
                err?.response?.data?.code === "no_assignable_days_minimum_rest"
              ) {
                toastT.apiError(err, [
                  "pages.diensts.adminPage.assignUserWeekErr",
                ]);
              } else {
                toastT.apiError(err, [
                  "pages.diensts.adminPage.assignUserWeekErr",
                ]);
              }
            }
          }}
          weekStartISO={weekUserModal.weekStartISO}
          excludeAsDriver={
            // Users already assigned as medic in this Dienst/week cannot be driver
            [...new Set(
              (diensts.find(
                (d) =>
                  d.dienstNumber === weekUserModal.dienstNumber &&
                  d.weekStartDate.slice(0, 10) === weekUserModal.weekStartISO,
              )?.assignments ?? [])
                .map((a) =>
                  typeof a.medic === "string"
                    ? a.medic
                    : (a.medic as any)?._id,
                )
                .filter((id): id is string => !!id),
            )]
          }
          excludeAsMedic={
            // Users already assigned as driver in this Dienst/week cannot be medic
            [...new Set(
              (diensts.find(
                (d) =>
                  d.dienstNumber === weekUserModal.dienstNumber &&
                  d.weekStartDate.slice(0, 10) === weekUserModal.weekStartISO,
              )?.assignments ?? [])
                .map((a) =>
                  typeof a.driver === "string"
                    ? a.driver
                    : (a.driver as any)?._id,
                )
                .filter((id): id is string => !!id),
            )]
          }
        />
      )}

      {/* Modal Ambulancia semana */}
      {ambulancesModuleOn && weekAmbulanceModal?.open && (
        <AmbulanceAssignModal
          isOpen={true}
          onClose={() => setWeekAmbulanceModal(null)}
          onConfirm={async (ambulanceId: string) => {
            if (!token || !weekAmbulanceModal) return;
            try {
              await assignAmbulanceToWeek(
                {
                  dienstNumber: weekAmbulanceModal.dienstNumber,
                  weekStartDate: weekAmbulanceModal.weekStartISO,
                  ambulanceId,
                },
                token,
              );
              toastT.success(["pages.diensts.adminPage.assignAmbulanceWeekOk"]);
              setWeekAmbulanceModal(null);
              emitDienstsChanged();
              fetchDiensts();
            } catch (err: any) {
              console.error("❌ Error al asignar ambulancia a la semana:", err);
              toastAmbulanceConflictOrApiError(err, [
                "pages.diensts.adminPage.assignAmbulanceWeekErr",
              ]);
            }
          }}
        />
      )}

      {weeklySummaryQueue.length > 0 && (
        <WeeklyAssignmentSummaryModal
          data={weeklySummaryQueue[0]}
          onClose={() =>
            setWeeklySummaryQueue((q) => (q.length <= 1 ? [] : q.slice(1)))
          }
        />
      )}
    </div>
  );
};

export default AdminPage;
