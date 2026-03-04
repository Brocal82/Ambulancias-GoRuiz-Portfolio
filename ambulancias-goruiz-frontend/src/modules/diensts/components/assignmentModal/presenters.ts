// src/modules/diensts/components/assignmentModal/presenters.ts
import type { TFunction } from "i18next";
import type { UserRef } from "../../domain/types";
import {
  mergeClasses,
  dimClass,
  driverClass,
  driverPscheinTitle,
  userVacationInfo,
  userSickInfo,
} from "./utils";

type Flags = {
  vacationFlags: Record<string, any>;
  sickFlags: Record<string, any>;
};

// helpers que devuelven strings + metadata (SIN JSX)
// luego los usamos en AssignmentModal para renderizar
export const getUserFlagsMeta = (
  user: UserRef,
  flags: Flags,
  t: TFunction,
) => {
  const vac = userVacationInfo(user, flags.vacationFlags, t);
  const sick = userSickInfo(user, flags.sickFlags, t);
  return { vac, sick };
};

export const getNameClass = (params: {
  user: UserRef;
  isDriver?: boolean;
  dim?: boolean;
}) => {
  const { user, isDriver, dim } = params;
  return mergeClasses(
    isDriver ? driverClass((user as any)?.pscheinExpiry) : "",
    dim ? dimClass : "",
  );
};

export const getNameTitle = (params: {
  user: UserRef;
  isDriver?: boolean;
  t: TFunction;
}) => {
  const { user, isDriver, t } = params;
  if (!isDriver) return undefined;
  return driverPscheinTitle(user, t);
};
