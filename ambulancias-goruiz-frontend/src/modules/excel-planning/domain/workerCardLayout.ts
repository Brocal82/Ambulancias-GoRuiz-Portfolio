import type { DienstDayCellLines } from "../../diensts/components";
import { formatCellDateUnified } from "../../../utils/timeUtils";
import { formatPersonLabel } from "../../diensts/utils";
import type { ExcelPlanRow } from "./api";

/** Alineado con el backend: excel-planning.schemas workerCardFieldKeySchema */
export const WORKER_CARD_FIELD_OPTIONS = [
  "app_dayDate",
  "timeText",
  "vehicleCode",
  "dienstNumber",
  "rowLabel",
  "employeeNumber",
  "partnerEmployeeNumber",
  "displayNameFromExcel",
  "displayPartnerNameFromExcel",
  "rawCellText",
  "driver",
  "medic",
] as const;

export type WorkerCardFieldKey = (typeof WORKER_CARD_FIELD_OPTIONS)[number];

export type WorkerCardLayout = {
  dayDateField: WorkerCardFieldKey;
  timeField: WorkerCardFieldKey;
  vehicleField: WorkerCardFieldKey;
  driverField: WorkerCardFieldKey;
  medicField: WorkerCardFieldKey;
};

/** Nombres de referencia (p. ej. jerga del Excel) por parte de la ficha, mismas claves que WorkerCardLayout. */
export type WorkerCardLineNameHints = {
  dayDateField: string;
  timeField: string;
  vehicleField: string;
  driverField: string;
  medicField: string;
};

export const EMPTY_WORKER_CARD_LINE_NAME_HINTS: WorkerCardLineNameHints = {
  dayDateField: "",
  timeField: "",
  vehicleField: "",
  driverField: "",
  medicField: "",
};

export const DEFAULT_WORKER_CARD_LAYOUT: WorkerCardLayout = {
  dayDateField: "app_dayDate",
  timeField: "timeText",
  vehicleField: "vehicleCode",
  driverField: "driver",
  medicField: "medic",
};

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

function aggregatePartnerNames(rows: ExcelPlanRow[]): string {
  return [
    ...new Set(
      rows.map((r) => r.displayPartnerNameFromExcel?.trim()).filter(Boolean),
    ),
  ].join(" · ");
}

type AmbLite = "driver" | "medic" | "both" | undefined;

function resolveDriverMedicLabels(rows: ExcelPlanRow[]): {
  driverLabel: string;
  medicLabel: string;
} {
  if (!rows.length) return { driverLabel: "", medicLabel: "" };
  const first = rows[0];
  const primaryName = first.displayNameFromExcel?.trim() ?? "";
  const partnerStr = aggregatePartnerNames(rows);
  const pr = first.primaryAmbulanceRole as AmbLite;
  const xr = first.partnerAmbulanceRole as AmbLite;

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

function fieldTextFromKey(
  key: WorkerCardFieldKey,
  rows: ExcelPlanRow[],
  opts: { isoDay: string; lang: string },
): string {
  if (key === "app_dayDate") {
    return formatCellDateUnified(opts.isoDay, opts.lang);
  }
  if (key === "driver" || key === "medic") {
    const d = resolveDriverMedicLabels(rows);
    return (key === "driver" ? d.driverLabel : d.medicLabel).trim();
  }
  if (!rows.length) return "—";
  const first = rows[0] as Record<string, unknown>;
  if (key === "timeText") {
    const parsed = rows.map((r) => parseExcelTimeRange(r.timeText));
    const ok = parsed.filter((p) => p.start && p.end);
    if (ok.length === 1 && ok[0].start && ok[0].end) {
      return `${ok[0].start} - ${ok[0].end}`;
    }
    if (ok.length > 1) {
      return ok.map((p) => `${p.start}-${p.end}`).join(" · ");
    }
    const t = (first.timeText as string | undefined)?.trim();
    return t || "—";
  }
  if (key === "vehicleCode") {
    const v = [
      ...new Set(rows.map((r) => r.vehicleCode).filter(Boolean)),
    ] as string[];
    return v.length ? v.join(" · ") : "—";
  }
  const v = first[key as string];
  if (v == null) return "—";
  if (v instanceof Date) {
    return formatCellDateUnified(v.toISOString().slice(0, 10), opts.lang);
  }
  if (typeof v === "string") {
    return v.trim() || "—";
  }
  return String(v);
}

/**
 * Misma forma que DienstDayCell (dateLine, timeLine, …) según la plantilla por campo lógico.
 */
export function buildExcelCellLinesForLayout(
  isoDay: string,
  lang: string,
  rows: ExcelPlanRow[],
  layout: WorkerCardLayout,
): DienstDayCellLines {
  const dateLine = fieldTextFromKey(layout.dayDateField, rows, {
    isoDay,
    lang,
  });

  const timeInner = fieldTextFromKey(layout.timeField, rows, { isoDay, lang });
  const timeLine =
    timeInner && timeInner !== "—" ? `🕒 ${timeInner}` : "🕒 —";

  const carInner = fieldTextFromKey(layout.vehicleField, rows, {
    isoDay,
    lang,
  });
  const ambulanceLine =
    carInner && carInner !== "—" ? `🚑 ${carInner}` : "🚑 —";

  const dInner = fieldTextFromKey(layout.driverField, rows, { isoDay, lang });
  const mInner = fieldTextFromKey(layout.medicField, rows, { isoDay, lang });
  const driverLine =
    dInner && dInner !== "—"
      ? `👨‍✈️ ${formatPersonLabel(dInner)}`
      : "👨‍✈️ —";
  const medicLine =
    mInner && mInner !== "—"
      ? `🧑‍⚕️ ${formatPersonLabel(mInner)}`
      : "🧑‍⚕️ —";

  return {
    dateLine,
    timeLine,
    ambulanceLine,
    driverLine,
    medicLine,
  };
}

export function normalizeWorkerCardLayout(
  input: unknown,
): WorkerCardLayout {
  if (!input || typeof input !== "object") return { ...DEFAULT_WORKER_CARD_LAYOUT };
  const o = input as Record<string, unknown>;
  const pick = (k: keyof WorkerCardLayout) => {
    const v = o[k];
    if (typeof v === "string" && (WORKER_CARD_FIELD_OPTIONS as readonly string[]).includes(v)) {
      return v as WorkerCardFieldKey;
    }
    return DEFAULT_WORKER_CARD_LAYOUT[k];
  };
  return {
    dayDateField: pick("dayDateField"),
    timeField: pick("timeField"),
    vehicleField: pick("vehicleField"),
    driverField: pick("driverField"),
    medicField: pick("medicField"),
  };
}

const NAME_HINT_KEYS: (keyof WorkerCardLineNameHints)[] = [
  "dayDateField",
  "timeField",
  "vehicleField",
  "driverField",
  "medicField",
];

export function normalizeWorkerCardLineNameHints(
  input: unknown,
): WorkerCardLineNameHints {
  if (!input || typeof input !== "object") {
    return { ...EMPTY_WORKER_CARD_LINE_NAME_HINTS };
  }
  const o = input as Record<string, unknown>;
  const out: WorkerCardLineNameHints = { ...EMPTY_WORKER_CARD_LINE_NAME_HINTS };
  for (const k of NAME_HINT_KEYS) {
    const v = o[k];
    out[k] = typeof v === "string" ? v.slice(0, 200) : "";
  }
  return out;
}
