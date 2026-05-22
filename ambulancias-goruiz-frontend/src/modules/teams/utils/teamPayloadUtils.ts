import type { CreateTeamPayload, UpdateTeamPayload } from "../domain/types";

type RotationMode = "rotating" | "fixed" | "none";

type BuildTeamPayloadInput = {
  driver: string;
  medic: string;
  rotationMode: RotationMode;
  fixedDienstNumber: number | "";
  ambulanceId: string;
  ambulancesModuleOn: boolean;
};

export function buildTeamPayload(
  input: BuildTeamPayloadInput,
): CreateTeamPayload | UpdateTeamPayload {
  const payload: CreateTeamPayload = {
    driver: input.driver,
    medic: input.medic,
    rotationMode: input.rotationMode,
  };

  if (input.rotationMode === "fixed" && input.fixedDienstNumber !== "") {
    payload.fixedDienstNumber = Number(input.fixedDienstNumber);
  } else if (input.rotationMode !== "fixed") {
    payload.fixedDienstNumber = null;
  }

  if (input.ambulancesModuleOn && input.ambulanceId) {
    payload.ambulanceId = input.ambulanceId;
  } else if (input.ambulancesModuleOn) {
    payload.ambulanceId = null;
  }

  return payload;
}

export function isTeamApiConflictError(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status;
  return status === 409 || status === 400 || status === 403;
}

export function getTeamApiErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { message?: string } } })?.response
    ?.data;
  return typeof data?.message === "string" && data.message.trim() !== ""
    ? data.message
    : fallback;
}
