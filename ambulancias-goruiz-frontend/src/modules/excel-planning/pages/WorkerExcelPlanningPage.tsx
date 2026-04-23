import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { getApiErrorMessage } from "../../../utils/toast";
import { toBerlinDayKey, type DayKey } from "../../../utils/dates/dayKey";
import { isPastDay } from "../../../utils/dates/isPastDay";
import PageShell from "../../../components/common/PageShell";
import {
  WeekBlock,
  DienstDayCell,
  WEEK_GRID_CLASS,
} from "../../diensts/components";
import {
  addDaysToDayKey,
  getWeekDays,
  mondayOfISOWeek,
  getStatusClass,
  getOffDayStatusClass,
  getAssignmentStatus,
  buildDienstDayCellLines,
  resolveUserAbsenceForFreeDay,
} from "../../diensts/utils";
import { useModules } from "../../../hooks/useModules";
import { MODULE_KEYS } from "../../../constants/modules";
import { getUserVacationRequests } from "../../vacation/domain/api";
import type { IVacationRequest } from "../../vacation/domain/types";
import { listMySickLeaves } from "../../sick/domain/api";
import type { SickLeave } from "../../sick/domain/types";
import {
  getMyExcelPlanningWeek,
  type ExcelPlanRow,
} from "../domain/api";
import {
  buildExcelCellLinesForLayout,
  DEFAULT_WORKER_CARD_LAYOUT,
  normalizeWorkerCardLayout,
  type WorkerCardLayout,
} from "../domain/workerCardLayout";

/** Soporta "06:45-14:45" sin espacios alrededor del guion. */
function parseExcelTimeRange(text?: string): { start?: string; end?: string } {
  const t = text?.trim();
  if (!t) return {};
  const parts = t.split(/\s*[-–—]\s*/);
  if (parts.length >= 2) {
    return {
      start: parts[0].trim(),
      end: parts[parts.length - 1].trim(),
    };
  }
  return {};
}

/** Texto compacto: franja horaria (Früh/Spät) + número(s) de Dienst. */
function aggregatePartnerNames(rows: ExcelPlanRow[]): string {
  return [
    ...new Set(
      rows.map((r) => r.displayPartnerNameFromExcel?.trim()).filter(Boolean),
    ),
  ].join(" · ");
}

type AmbulanceRoleLite = "driver" | "medic" | "both" | undefined;

/** Coloca conductor / sanitario según perfiles y texto del Excel (línea principal vs compañero). */
function resolveDriverMedicLabels(rows: ExcelPlanRow[]): {
  driverLabel: string;
  medicLabel: string;
} {
  if (!rows.length) return { driverLabel: "", medicLabel: "" };
  const first = rows[0];
  const primaryName = first.displayNameFromExcel?.trim() ?? "";
  const partnerStr = aggregatePartnerNames(rows);
  const pr = first.primaryAmbulanceRole as AmbulanceRoleLite;
  const xr = first.partnerAmbulanceRole as AmbulanceRoleLite;

  if (!partnerStr) {
    if (pr === "medic") {
      return { driverLabel: "", medicLabel: primaryName };
    }
    return { driverLabel: primaryName, medicLabel: "" };
  }

  if (pr === "medic" && xr === "driver") {
    return { driverLabel: partnerStr, medicLabel: primaryName };
  }
  if (pr === "driver" && xr === "medic") {
    return { driverLabel: primaryName, medicLabel: partnerStr };
  }
  if (pr === "medic") {
    return { driverLabel: partnerStr, medicLabel: primaryName };
  }
  if (pr === "driver") {
    return { driverLabel: primaryName, medicLabel: partnerStr };
  }
  if (xr === "medic") {
    return { driverLabel: primaryName, medicLabel: partnerStr };
  }
  if (xr === "driver") {
    return { driverLabel: partnerStr, medicLabel: primaryName };
  }
  return { driverLabel: primaryName, medicLabel: partnerStr };
}

function excelRowsToAssignment(rows: ExcelPlanRow[]): {
  startTime?: string;
  endTime?: string;
  driver?: string;
  medic?: string;
  ambulanceNumber?: string;
} | null {
  if (!rows.length) return null;
  const first = rows[0];
  const { start, end } = parseExcelTimeRange(first.timeText);
  const { driverLabel, medicLabel } = resolveDriverMedicLabels(rows);
  const vehicles = [...new Set(rows.map((r) => r.vehicleCode).filter(Boolean))];
  const ambulanceNumber =
    vehicles.length > 0 ? vehicles.join(" · ") : undefined;
  return {
    startTime: start,
    endTime: end,
    driver: driverLabel.trim() || "—",
    medic: medicLabel.trim() || "—",
    ambulanceNumber,
  };
}

type ExcelRowGroup = {
  key: string;
  dienstNumber: string;
  rowLabel?: string;
  byDay: Map<DayKey, ExcelPlanRow[]>;
};

/** Un solo bloque por semana: no se listan varios Dienst (Früh / Spät) por separado. */
function mergeWorkerExcelRowGroupsForWeek(
  groups: ExcelRowGroup[],
): ExcelRowGroup[] {
  if (groups.length === 0) return groups;

  const byDay = new Map<DayKey, ExcelPlanRow[]>();
  for (const g of groups) {
    for (const [dk, arr] of g.byDay) {
      const cur = byDay.get(dk) ?? [];
      cur.push(...arr);
      byDay.set(dk, cur);
    }
  }

  for (const [dk, arr] of byDay) {
    arr.sort((a, b) => {
      const na = parseInt(String(a.dienstNumber), 10);
      const nb = parseInt(String(b.dienstNumber), 10);
      const aNum = Number.isFinite(na);
      const bNum = Number.isFinite(nb);
      if (aNum && bNum && na !== nb) return na - nb;
      const cmp = String(a.dienstNumber).localeCompare(String(b.dienstNumber), undefined, {
        numeric: true,
      });
      if (cmp !== 0) return cmp;
      return String(a.rowLabel ?? "").localeCompare(String(b.rowLabel ?? ""));
    });
    byDay.set(dk, arr);
  }

  return [
    {
      key: "__worker_week_merged__",
      dienstNumber: "",
      rowLabel: undefined,
      byDay,
    },
  ];
}

function buildExcelRowGroupsForWeek(
  rows: ExcelPlanRow[],
  weekDates: DayKey[],
): ExcelRowGroup[] {
  const inWeek = new Set(weekDates);
  const map = new Map<string, ExcelRowGroup>();

  for (const r of rows) {
    const dk = toBerlinDayKey(new Date(r.dayDate));
    if (!inWeek.has(dk)) continue;

    const key = `${r.dienstNumber}\t${r.rowLabel ?? ""}`;
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        dienstNumber: r.dienstNumber,
        rowLabel: r.rowLabel,
        byDay: new Map(),
      };
      map.set(key, g);
    }
    const arr = g.byDay.get(dk) ?? [];
    arr.push(r);
    g.byDay.set(dk, arr);
  }

  const list = [...map.values()];
  list.sort((a, b) => {
    const na = parseInt(String(a.dienstNumber), 10);
    const nb = parseInt(String(b.dienstNumber), 10);
    const aNum = Number.isFinite(na);
    const bNum = Number.isFinite(nb);
    if (aNum && bNum && na !== nb) return na - nb;
    const cmp = String(a.dienstNumber).localeCompare(String(b.dienstNumber), undefined, {
      numeric: true,
    });
    if (cmp !== 0) return cmp;
    return String(a.rowLabel ?? "").localeCompare(String(b.rowLabel ?? ""));
  });
  return list;
}

type WeekBundle = {
  rows: ExcelPlanRow[];
  published: boolean;
  cardLayout: WorkerCardLayout;
};

function publishedFromApi(data: {
  published?: boolean;
  rows?: ExcelPlanRow[];
}): boolean {
  return typeof data.published === "boolean"
    ? data.published
    : Boolean(data.rows?.length);
}

export default function WorkerExcelPlanningPage() {
  const { t, i18n } = useTranslation();
  const { hasModule } = useModules();
  const vacationModuleOn = hasModule(MODULE_KEYS.VACATION);
  const sickLeavesModuleOn = hasModule(MODULE_KEYS.SICK_LEAVES);

  /** Lunes de la primera semana mostrada (la segunda es +7 días). */
  const [firstMonday, setFirstMonday] = useState<DayKey>(() =>
    mondayOfISOWeek(toBerlinDayKey(new Date())),
  );

  const secondMonday = useMemo(
    () => addDaysToDayKey(firstMonday, 7),
    [firstMonday],
  );

  const pairMondays = useMemo(
    () => [firstMonday, secondMonday] as const,
    [firstMonday, secondMonday],
  );

  const [bundleByMonday, setBundleByMonday] = useState<
    Record<string, WeekBundle>
  >({});
  const [loading, setLoading] = useState(true);
  const [vacationRequests, setVacationRequests] = useState<IVacationRequest[]>(
    [],
  );
  const [sickLeaves, setSickLeaves] = useState<SickLeave[]>([]);

  const fmtDate = (d: Date) => d.toLocaleDateString(i18n.language);

  const load = useCallback(async () => {
    setLoading(true);
    const w0 = firstMonday;
    const w1 = secondMonday;
    try {
      const [d0, d1, vacs, sick] = await Promise.all([
        getMyExcelPlanningWeek(w0),
        getMyExcelPlanningWeek(w1),
        vacationModuleOn
          ? getUserVacationRequests()
          : Promise.resolve([] as IVacationRequest[]),
        sickLeavesModuleOn
          ? listMySickLeaves()
          : Promise.resolve([] as SickLeave[]),
      ]);
      setBundleByMonday({
        [w0]: {
          rows: d0.rows ?? [],
          published: publishedFromApi(d0),
          cardLayout: normalizeWorkerCardLayout(d0.cardLayout) ?? {
            ...DEFAULT_WORKER_CARD_LAYOUT,
          },
        },
        [w1]: {
          rows: d1.rows ?? [],
          published: publishedFromApi(d1),
          cardLayout: normalizeWorkerCardLayout(d1.cardLayout) ?? {
            ...DEFAULT_WORKER_CARD_LAYOUT,
          },
        },
      });
      setVacationRequests(Array.isArray(vacs) ? vacs : []);
      setSickLeaves(Array.isArray(sick) ? sick : []);
    } catch (e) {
      toast.error(getApiErrorMessage(e, t("excelPlanning.loadError")));
      setBundleByMonday({});
    } finally {
      setLoading(false);
    }
  }, [
    firstMonday,
    secondMonday,
    t,
    vacationModuleOn,
    sickLeavesModuleOn,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalRowCount = useMemo(
    () =>
      Object.values(bundleByMonday).reduce((n, b) => n + b.rows.length, 0),
    [bundleByMonday],
  );

  const anyPublished = useMemo(
    () => Object.values(bundleByMonday).some((b) => b.published),
    [bundleByMonday],
  );

  const allPublished = useMemo(
    () =>
      pairMondays.every((mk) => bundleByMonday[mk]?.published === true),
    [pairMondays, bundleByMonday],
  );

  const weekRangeTitle = (mk: DayKey) => {
    const weekStart = new Date(`${mk}T12:00:00`);
    const weekEnd = new Date(`${mk}T12:00:00`);
    weekEnd.setDate(weekEnd.getDate() + 6);
    return t("pages.diensts.workerPage.weekRange", {
      from: fmtDate(weekStart),
      to: fmtDate(weekEnd),
    });
  };

  const onPickWeek = (ymd: string) => {
    if (!ymd) return;
    setFirstMonday(
      mondayOfISOWeek(toBerlinDayKey(new Date(`${ymd}T12:00:00`))),
    );
  };

  return (
    <PageShell title={t("excelPlanning.workerTitle")} maxWidthClassName="max-w-6xl">
      <div className="flex justify-end mb-2">
        <Link to="/worker" className="text-sm text-blue-600 hover:underline">
          {t("excelPlanning.backWorker")}
        </Link>
      </div>

      <p className="text-sm text-slate-600 mb-4">{t("excelPlanning.workerIntro")}</p>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <label className="block text-sm">
          {t("excelPlanning.weekPairStartLabel")}
          <input
            type="date"
            className="mt-1 block border rounded px-2 py-1"
            value={firstMonday}
            onChange={(e) => onPickWeek(e.target.value)}
            aria-label={t("excelPlanning.weekPairStartLabel")}
          />
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
            onClick={() => setFirstMonday((k) => addDaysToDayKey(k, -7))}
          >
            {t("excelPlanning.weekPairPrev")}
          </button>
          <button
            type="button"
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
            onClick={() => setFirstMonday((k) => addDaysToDayKey(k, 7))}
          >
            {t("excelPlanning.weekPairNext")}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-slate-600">{t("excelPlanning.loading")}</p>
      ) : (
        <>
          {!allPublished && (
            <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {t("excelPlanning.noPlanPublishedSomeWeeks")}
            </p>
          )}
          {anyPublished && totalRowCount === 0 && (
            <p className="mb-3 text-sm text-slate-600">
              {t("excelPlanning.workerEmpty")}
            </p>
          )}

          <div className="space-y-6">
            {pairMondays.map((mk) => {
              const published = bundleByMonday[mk]?.published ?? false;
              const weekRows = bundleByMonday[mk]?.rows ?? [];
              const weekCardLayout =
                bundleByMonday[mk]?.cardLayout ?? DEFAULT_WORKER_CARD_LAYOUT;
              const weekDates = getWeekDays(mk);
              const rowGroups = mergeWorkerExcelRowGroupsForWeek(
                buildExcelRowGroupsForWeek(weekRows, weekDates),
              );

              return (
                <WeekBlock key={mk} title={weekRangeTitle(mk)} withGrid={false}>
                  {!published ? (
                    <p className="text-sm text-slate-500">
                      {t("excelPlanning.noPlanPublished")}
                    </p>
                  ) : rowGroups.length === 0 ? (
                    <p className="text-sm text-slate-600">
                      {t("excelPlanning.workerEmpty")}
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {rowGroups.map((g) => (
                        <div key={g.key} className="min-w-0">
                          <div className={`${WEEK_GRID_CLASS} min-w-0`}>
                            {weekDates.map((dateStr) => {
                              const dayRows = g.byDay.get(dateStr) ?? [];
                              const isPast = isPastDay(dateStr);

                              if (dayRows.length === 0) {
                                const absence = resolveUserAbsenceForFreeDay(
                                  dateStr,
                                  vacationRequests,
                                  sickLeaves,
                                );
                                const freeLabel =
                                  absence === "vacation"
                                    ? `🏖️ ${t("pages.diensts.workerPage.vacationDay")}`
                                    : absence === "sick"
                                      ? `🤒 ${t("pages.diensts.workerPage.sickDay")}`
                                      : `🌴 ${t("pages.diensts.workerPage.freeDay")}`;
                                const lines = buildDienstDayCellLines({
                                  isoDay: dateStr,
                                  lang: i18n.language,
                                  freeLabel,
                                  assignment: null,
                                });
                                return (
                                  <DienstDayCell
                                    key={dateStr}
                                    dayISO={dateStr}
                                    statusClass={getOffDayStatusClass(absence)}
                                    isPast={isPast}
                                    isPartial={false}
                                    isDisabled={false}
                                    lines={lines}
                                    onOpen={() => {}}
                                  />
                                );
                              }

                              const assignmentLike =
                                excelRowsToAssignment(dayRows);
                              const lines = buildExcelCellLinesForLayout(
                                dateStr,
                                i18n.language,
                                dayRows,
                                weekCardLayout,
                              );
                              const status = getAssignmentStatus(assignmentLike);
                              return (
                                <DienstDayCell
                                  key={dateStr}
                                  dayISO={dateStr}
                                  statusClass={getStatusClass(status)}
                                  isPast={isPast}
                                  isPartial={status === "partial"}
                                  isDisabled={false}
                                  lines={lines}
                                  onOpen={() => {}}
                                />
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </WeekBlock>
              );
            })}
          </div>
        </>
      )}

    </PageShell>
  );
}
