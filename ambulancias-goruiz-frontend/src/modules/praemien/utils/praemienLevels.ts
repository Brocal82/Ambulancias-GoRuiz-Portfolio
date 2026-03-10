export type PraemieLevel = 0 | 7 | 8 | 9 | 10;

export function getPraemieLevelFromAverage(averagePatients: number): PraemieLevel {
  if (averagePatients >= 10) return 10;
  if (averagePatients >= 9) return 9;
  if (averagePatients >= 8) return 8;
  if (averagePatients >= 7) return 7;
  return 0;
}

export function getPraemieI18nKey(level: PraemieLevel): string {
  switch (level) {
    case 10:
      return "pages.praemien.levels.10";
    case 9:
      return "pages.praemien.levels.9";
    case 8:
      return "pages.praemien.levels.8";
    case 7:
      return "pages.praemien.levels.7";
    default:
      return "pages.praemien.levels.none";
  }
}
