/** Backend final closure reloads trips server-side; only `_id` is trusted. */
export type ClosureTripRef = { _id: string };

export function buildClosureTripRefs(
  trips: ReadonlyArray<{ _id: string }>,
): ClosureTripRef[] {
  return trips
    .map((trip) => ({ _id: String(trip._id).trim() }))
    .filter((trip) => trip._id.length > 0);
}
