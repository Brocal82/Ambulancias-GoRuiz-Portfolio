export function userIdFromAssignmentField(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "object" && value !== null) {
    const maybeId = (value as { _id?: string })._id;
    return maybeId?.trim() || null;
  }
  return null;
}

export function isAssignmentForUser(
  assignment: { driver?: unknown; medic?: unknown },
  userId: string,
): boolean {
  const normalizedUserId = String(userId);
  const driverId = userIdFromAssignmentField(assignment.driver);
  const medicId = userIdFromAssignmentField(assignment.medic);
  return driverId === normalizedUserId || medicId === normalizedUserId;
}
