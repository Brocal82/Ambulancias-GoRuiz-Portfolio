export type PraemienRuleBase = {
  id?: string;
  label?: string;
  enabled: boolean;
  multiplier: number;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
};

export type PraemienKmRule = PraemienRuleBase & {
  type: "km";
  minKm: number;
  maxKm?: number | null;
};

export type PraemienWeekdayRule = PraemienRuleBase & {
  type: "weekday";
  weekdays: number[];
};

export type PraemienDienstStartTimeRule = PraemienRuleBase & {
  type: "dienstStartTime";
  startTimeFrom: string;
  startTimeTo: string;
};

export type PraemienWeekdayDienstStartTimeRule = PraemienRuleBase & {
  type: "weekdayDienstStartTime";
  weekdays: number[];
  startTimeFrom: string;
  startTimeTo: string;
};

export type PraemienWeekdayPickupTimeRule = PraemienRuleBase & {
  type: "weekdayPickupTime";
  weekdays: number[];
  pickupTimeFrom: string;
  pickupTimeTo: string;
};

export type PraemienRule =
  | PraemienKmRule
  | PraemienWeekdayRule
  | PraemienDienstStartTimeRule
  | PraemienWeekdayDienstStartTimeRule
  | PraemienWeekdayPickupTimeRule;

export type PraemienRuleConfig = {
  version: 1;
  rules: PraemienRule[];
  cancelledTripPolicy: "excludeUnlessCountsTrip";
};

type LegacyPraemienRuleConfig = {
  version?: 1;
  kmMultipliers?: Array<{
    minKm?: number;
    maxKm?: number | null;
    multiplier?: number;
  }>;
  weekendAfternoon?: {
    enabled?: boolean;
    startHour?: number;
    endHour?: number;
    multiplier?: number;
  };
};

export const DEFAULT_PRAEMIEN_RULE_CONFIG: PraemienRuleConfig = {
  version: 1,
  rules: [
    {
      id: "legacy-km-15-20",
      type: "km",
      label: "15 a 20 km",
      enabled: true,
      minKm: 15,
      maxKm: 20,
      multiplier: 1.5,
    },
    {
      id: "legacy-km-20-plus",
      type: "km",
      label: "20 km o mas",
      enabled: true,
      minKm: 20,
      maxKm: null,
      multiplier: 2,
    },
    {
      id: "legacy-weekend-afternoon",
      type: "weekdayDienstStartTime",
      label: "Fin de semana Dienst 13-17",
      enabled: true,
      weekdays: [0, 6],
      startTimeFrom: "13:00",
      startTimeTo: "17:00",
      multiplier: 1.5,
    },
  ],
  cancelledTripPolicy: "excludeUnlessCountsTrip",
};

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function normalizeWeekdays(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((day) => Number(day))
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
    ),
  ).sort((a, b) => a - b);
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseOptionalRuleDate(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (validDate(trimmed)) return trimmed;
  return undefined;
}

function normalizeValidityFields(
  raw: Record<string, unknown>,
): Pick<PraemienRuleBase, "effectiveFrom" | "effectiveTo"> | null {
  const validity: Pick<PraemienRuleBase, "effectiveFrom" | "effectiveTo"> = {};

  if ("effectiveFrom" in raw) {
    const parsed = parseOptionalRuleDate(raw.effectiveFrom);
    if (parsed === undefined) return null;
    if (parsed != null) validity.effectiveFrom = parsed;
  }
  if ("effectiveTo" in raw) {
    const parsed = parseOptionalRuleDate(raw.effectiveTo);
    if (parsed === undefined) return null;
    if (parsed != null) validity.effectiveTo = parsed;
  }
  if (
    validity.effectiveFrom &&
    validity.effectiveTo &&
    validity.effectiveTo < validity.effectiveFrom
  ) {
    return null;
  }
  return validity;
}

function normalizeRule(rule: unknown, index: number): PraemienRule | null {
  if (!rule || typeof rule !== "object") return null;
  const raw = rule as Partial<PraemienRule> & Record<string, unknown>;
  const validity = normalizeValidityFields(raw);
  if (validity == null) return null;

  const base = {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : `rule-${index}`,
    label: typeof raw.label === "string" ? raw.label.trim().slice(0, 80) : "",
    enabled: raw.enabled !== false,
    multiplier: finiteNumber(raw.multiplier) ? raw.multiplier : 1,
    ...validity,
  };
  if (base.multiplier < 0 || base.multiplier > 10) return null;

  if (raw.type === "km") {
    const minKm = (raw as Partial<PraemienKmRule>).minKm;
    const maxKm = (raw as Partial<PraemienKmRule>).maxKm;
    if (!finiteNumber(minKm) || minKm < 0) return null;
    if (maxKm != null && (!finiteNumber(maxKm) || maxKm < minKm)) return null;
    return { ...base, type: "km", minKm, maxKm: maxKm ?? null };
  }

  if (raw.type === "weekday") {
    const weekdays = normalizeWeekdays((raw as Partial<PraemienWeekdayRule>).weekdays);
    if (!weekdays.length) return null;
    return { ...base, type: "weekday", weekdays };
  }

  if (raw.type === "dienstStartTime") {
    const r = raw as Partial<PraemienDienstStartTimeRule>;
    if (!validTime(r.startTimeFrom) || !validTime(r.startTimeTo)) return null;
    if (r.startTimeFrom > r.startTimeTo) return null;
    return {
      ...base,
      type: "dienstStartTime",
      startTimeFrom: r.startTimeFrom,
      startTimeTo: r.startTimeTo,
    };
  }

  if (raw.type === "weekdayDienstStartTime") {
    const r = raw as Partial<PraemienWeekdayDienstStartTimeRule>;
    const weekdays = normalizeWeekdays(r.weekdays);
    if (!weekdays.length) return null;
    if (!validTime(r.startTimeFrom) || !validTime(r.startTimeTo)) return null;
    if (r.startTimeFrom > r.startTimeTo) return null;
    return {
      ...base,
      type: "weekdayDienstStartTime",
      weekdays,
      startTimeFrom: r.startTimeFrom,
      startTimeTo: r.startTimeTo,
    };
  }

  if (raw.type === "weekdayPickupTime") {
    const r = raw as Partial<PraemienWeekdayPickupTimeRule>;
    const weekdays = normalizeWeekdays(r.weekdays);
    if (!weekdays.length) return null;
    if (!validTime(r.pickupTimeFrom) || !validTime(r.pickupTimeTo)) return null;
    if (r.pickupTimeFrom > r.pickupTimeTo) return null;
    return {
      ...base,
      type: "weekdayPickupTime",
      weekdays,
      pickupTimeFrom: r.pickupTimeFrom,
      pickupTimeTo: r.pickupTimeTo,
    };
  }

  return null;
}

function normalizeLegacyConfig(config: LegacyPraemienRuleConfig): PraemienRuleConfig {
  const rules: PraemienRule[] = [];
  if (Array.isArray(config.kmMultipliers)) {
    config.kmMultipliers.forEach((rule, index) => {
      const normalized = normalizeRule(
        {
          type: "km",
          id: `legacy-km-${index}`,
          enabled: true,
          minKm: rule.minKm,
          maxKm: rule.maxKm ?? null,
          multiplier: rule.multiplier,
        },
        index,
      );
      if (normalized) rules.push(normalized);
    });
  }

  const weekend = config.weekendAfternoon;
  if (
    weekend &&
    weekend.enabled !== false &&
    finiteNumber(weekend.startHour) &&
    finiteNumber(weekend.endHour) &&
    finiteNumber(weekend.multiplier)
  ) {
    const normalized = normalizeRule(
      {
        type: "weekdayDienstStartTime",
        id: "legacy-weekend-afternoon",
        label: `Sabado/domingo Dienst ${weekend.startHour}:00-${weekend.endHour}:00`,
        enabled: true,
        weekdays: [0, 6],
        startTimeFrom: `${String(weekend.startHour).padStart(2, "0")}:00`,
        startTimeTo: `${String(weekend.endHour).padStart(2, "0")}:00`,
        multiplier: weekend.multiplier,
      },
      rules.length,
    );
    if (normalized) rules.push(normalized);
  }

  return {
    version: 1,
    rules: rules.length ? rules : DEFAULT_PRAEMIEN_RULE_CONFIG.rules,
    cancelledTripPolicy: "excludeUnlessCountsTrip",
  };
}

export function normalizePraemienRuleConfig(
  config: unknown,
): PraemienRuleConfig {
  if (!config || typeof config !== "object") {
    return DEFAULT_PRAEMIEN_RULE_CONFIG;
  }

  const raw = config as Partial<PraemienRuleConfig> & LegacyPraemienRuleConfig;
  if (!Array.isArray(raw.rules)) {
    return normalizeLegacyConfig(raw);
  }

  const rules = raw.rules
    .map((rule, index) => normalizeRule(rule, index))
    .filter((rule): rule is PraemienRule => rule != null);

  return {
    version: 1,
    rules: rules.length ? rules : DEFAULT_PRAEMIEN_RULE_CONFIG.rules,
    cancelledTripPolicy: "excludeUnlessCountsTrip",
  };
}
