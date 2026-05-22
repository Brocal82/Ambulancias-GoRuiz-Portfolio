type AmbulanceRole = "driver" | "medic" | "both";

type WithAmbulanceRole = {
  ambulanceRole?: AmbulanceRole;
};

export function isDriverCandidate(user: WithAmbulanceRole): boolean {
  return user.ambulanceRole === "driver" || user.ambulanceRole === "both";
}

export function isMedicCandidate(user: WithAmbulanceRole): boolean {
  return user.ambulanceRole === "medic" || user.ambulanceRole === "both";
}

export function filterDriverCandidates<T extends WithAmbulanceRole>(
  users: T[],
): T[] {
  return users.filter(isDriverCandidate);
}

export function filterMedicCandidates<T extends WithAmbulanceRole>(
  users: T[],
): T[] {
  return users.filter(isMedicCandidate);
}
