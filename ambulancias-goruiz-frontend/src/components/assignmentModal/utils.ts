import { getPscheinInfo, getPscheinWarningTitle } from "../../utils/pscheinUtils";
import { fmtDDMM } from "../../utils/timeUtils";
import type { UserRef } from "../../modules/diensts";
import type { TFunction } from "i18next";
import type { SickFlag } from "../../api/sickLeaves";
import type { VacFlag } from "../../api/vacation";

export const mergeClasses = (...classes: (string | false | null | undefined)[]) =>
  classes.filter(Boolean).join(" ");

export const dimClass = "text-slate-400";

// ===== Helpers visuales coherentes con UserAssignModal =====
export const driverClass = (pschein?: string | null) => {
  if (!pschein) return "";
  const info = getPscheinInfo(pschein);
  if (info.status === "expired") return "text-red-600 font-medium";
  if (info.status === "warning") return "text-yellow-600 font-medium";
  return "";
};

export const driverExpired = (u: UserRef) => {
  const info = getPscheinInfo((u as any)?.pscheinExpiry);
  return info.status === "expired";
};

export const driverPscheinTitle = (u: UserRef | null | undefined, t: TFunction) => {
  if (!u) return undefined;
  const expiry = (u as any)?.pscheinExpiry as string | undefined;
  const info = getPscheinInfo(expiry);
  if (info.status === "warning" || info.status === "expired") {
    return getPscheinWarningTitle(expiry, t);
  }
  return undefined;
};

export const userVacationInfo = (
  u: UserRef | null | undefined,
  vacationFlags: Record<string, VacFlag>,
  t: TFunction,
) => {
  if (!u || !u._id) return { has: false, title: undefined as string | undefined };

  const vf = vacationFlags[u._id];
  const has = !!vf?.hasVacationInRange;
  if (!has) return { has: false, title: undefined as string | undefined };

  const fromFull = vf?.vacationStartFull;
  const toFull = vf?.vacationUntilFull;

  let title: string | undefined;
  if (fromFull && toFull) {
    title = `🏖️ ${t("pages.diensts.weekModals.vacations", "Vacaciones")}: ${fmtDDMM(
      fromFull,
    )} → ${fmtDDMM(toFull)}`;
  } else {
    title = `🏖️ ${t("pages.diensts.weekModals.vacations", "Vacaciones")}`;
  }

  return { has: true, title };
};

export const userSickInfo = (
  u: UserRef | null | undefined,
  sickFlags: Record<string, SickFlag>,
  t: TFunction,
) => {
  if (!u || !u._id) return { has: false, title: undefined as string | undefined };

  const sf = sickFlags[u._id];
  const has = !!sf?.hasSickInRange;
  if (!has) return { has: false, title: undefined as string | undefined };

  const fromFull = sf?.sickStartFull || sf?.sickStartInRange;
  const toFull = sf?.sickUntilFull || sf?.sickUntilInRange;

  let title: string | undefined;
  if (fromFull && toFull) {
    title = `🤒 ${t("pages.sick.tooltip.full", "Baja médica")}: ${fmtDDMM(fromFull)} → ${fmtDDMM(
      toFull,
    )}`;
  } else {
    title = `🤒 ${t("pages.sick.tooltip.full", "Baja médica")}`;
  }

  return { has: true, title };
};
