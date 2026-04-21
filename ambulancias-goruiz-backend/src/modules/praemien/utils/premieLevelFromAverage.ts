/** Same tier labels as save-monthly-praemie.service (stable for snapshots). */
export function getPremieLevelFromAverage(averagePatients: number): string {
  if (averagePatients >= 10) return "\ud83c\udfc6 Pr\u00e4mie 10";
  if (averagePatients >= 9) return "\ud83c\udf96 Pr\u00e4mie 9";
  if (averagePatients >= 8) return "\ud83e\udd48 Pr\u00e4mie 8";
  if (averagePatients >= 7) return "\ud83e\udd49 Pr\u00e4mie 7";
  return "\u274c No alcanza m\u00ednimo";
}
