export { default as VacationMonthConfig } from "./month-config.model";
export type { IVacationMonthConfig } from "./month-config.model";
export {
  DEFAULT_MAX_PER_DAY,
  findMonthConfig,
  getMaxPerDayForDate,
  getMonthConfigOrDefault,
  toMonthKey,
  upsertMonthConfigRecord,
} from "./month-config.service";
