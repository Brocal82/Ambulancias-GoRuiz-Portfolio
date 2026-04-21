import type { TFunction } from "i18next";

/** Human-readable manual daily entry status (Phase 4 QA). */
export function labelPraemienManualStatus(t: TFunction, status: string): string {
  return t(`pages.praemien.status.${status}`, { defaultValue: status });
}
