import { useEffect, useMemo, useState } from "react";
import {
  getPraemienRules,
  updatePraemienRules,
  type PraemienRule,
  type PraemienRuleConfig,
} from "../domain/api";
import { toastT, getApiErrorMessage } from "../../../utils/toast";
import SaveIconButton from "../../../components/common/actions/SaveIconButton";

const WEEKDAYS = [
  { value: 1, label: "L" },
  { value: 2, label: "M" },
  { value: 3, label: "X" },
  { value: 4, label: "J" },
  { value: 5, label: "V" },
  { value: 6, label: "S" },
  { value: 0, label: "D" },
];

const DEFAULT_RULES: PraemienRuleConfig = {
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
      id: "legacy-weekend",
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

function cloneRules(rules: PraemienRuleConfig): PraemienRuleConfig {
  return {
    version: 1,
    rules: rules.rules.map((rule) => ({ ...rule })),
    cancelledTripPolicy: "excludeUnlessCountsTrip",
  };
}

function sameRules(a: PraemienRuleConfig, b: PraemienRuleConfig): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function newRule(type: PraemienRule["type"]): PraemienRule {
  const id = `rule-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  if (type === "km") {
    return {
      id,
      type,
      label: "Nueva regla km",
      enabled: true,
      minKm: 30,
      maxKm: null,
      multiplier: 3,
    };
  }
  if (type === "weekday") {
    return {
      id,
      type,
      label: "Nueva regla por dia",
      enabled: true,
      weekdays: [1],
      multiplier: 1.5,
    };
  }
  if (type === "dienstStartTime") {
    return {
      id,
      type,
      label: "Nueva regla por hora",
      enabled: true,
      startTimeFrom: "12:00",
      startTimeTo: "14:00",
      multiplier: 1.5,
    };
  }
  if (type === "weekdayPickupTime") {
    return {
      id,
      type,
      label: "Nueva regla dia y recogida",
      enabled: true,
      weekdays: [1],
      pickupTimeFrom: "12:00",
      pickupTimeTo: "14:00",
      multiplier: 1.5,
    };
  }
  return {
    id,
    type,
    label: "Nueva regla dia y hora",
    enabled: true,
    weekdays: [1],
    startTimeFrom: "12:00",
    startTimeTo: "14:00",
    multiplier: 1.5,
  };
}

export function AdminPraemienRulesPanel() {
  const [rules, setRules] = useState<PraemienRuleConfig>(DEFAULT_RULES);
  const [initialRules, setInitialRules] = useState<PraemienRuleConfig>(DEFAULT_RULES);
  const [addingType, setAddingType] = useState<PraemienRule["type"]>("km");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getPraemienRules();
        if (cancelled) return;
        setRules(cloneRules(data));
        setInitialRules(cloneRules(data));
      } catch (error) {
        if (!cancelled) {
          toastT.error(getApiErrorMessage(error, "No se pudieron cargar las reglas"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasChanges = !sameRules(rules, initialRules);
  const activeCount = useMemo(
    () => rules.rules.filter((rule) => rule.enabled).length,
    [rules.rules],
  );

  const updateRule = (index: number, nextRule: PraemienRule) => {
    setRules((prev) => ({
      ...prev,
      rules: prev.rules.map((rule, i) => (i === index ? nextRule : rule)),
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const saved = await updatePraemienRules(rules);
      setRules(cloneRules(saved));
      setInitialRules(cloneRules(saved));
      toastT.success("Reglas de Prämien guardadas");
    } catch (error) {
      toastT.error(getApiErrorMessage(error, "No se pudieron guardar las reglas"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-600">Cargando reglas...</p>;
  }

  return (
    <section className="space-y-3 border-b border-slate-200 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Reglas de Prämien</h2>
          <p className="text-sm text-slate-600">
            {activeCount} activas. Si varias aplican al mismo viaje, se usa el multiplicador mas alto.
          </p>
          <p className="text-sm text-slate-600">
            Solo afectan a cierres de jornada nuevos; los meses ya guardados no se recalculan.
          </p>
        </div>
        <SaveIconButton
          type="button"
          onClick={save}
          disabled={!hasChanges || saving || rules.rules.length === 0}
          title={
            saving
              ? "Guardando..."
              : hasChanges
                ? "Guardar reglas"
                : "Sin cambios por guardar"
          }
        />
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-md border border-slate-200 p-3">
        <label className="text-xs font-medium text-slate-700">
          Añadir regla
          <select
            value={addingType}
            onChange={(e) => setAddingType(e.target.value as PraemienRule["type"])}
            className="mt-1 h-9 rounded border border-slate-300 bg-white px-2 text-sm"
          >
            <option value="km">Kilometros</option>
            <option value="weekday">Dia de semana</option>
            <option value="dienstStartTime">Hora inicio Dienst</option>
            <option value="weekdayDienstStartTime">Dia + hora inicio Dienst</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() =>
            setRules((prev) => ({ ...prev, rules: [...prev.rules, newRule(addingType)] }))
          }
          className="h-9 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Añadir
        </button>
      </div>

      <div className="space-y-2">
        {rules.rules.map((rule, index) => (
          <RuleEditor
            key={rule.id ?? index}
            rule={rule}
            onChange={(nextRule) => updateRule(index, nextRule)}
            onRemove={() =>
              setRules((prev) => ({
                ...prev,
                rules: prev.rules.filter((_, i) => i !== index),
              }))
            }
          />
        ))}
      </div>
    </section>
  );
}

function RuleEditor(props: {
  rule: PraemienRule;
  onChange: (rule: PraemienRule) => void;
  onRemove: () => void;
}) {
  const { rule, onChange } = props;
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="grid gap-2 md:grid-cols-[1.4fr_1fr_1fr_auto_auto]">
        <label className="text-xs text-slate-600">
          Nombre
          <input
            value={rule.label ?? ""}
            onChange={(e) => onChange({ ...rule, label: e.target.value })}
            className="mt-1 h-8 w-full rounded border border-slate-300 px-2 text-sm"
          />
        </label>
        <label className="text-xs text-slate-600">
          Tipo
          <select
            value={rule.type}
            onChange={(e) => onChange(newRule(e.target.value as PraemienRule["type"]))}
            className="mt-1 h-8 w-full rounded border border-slate-300 bg-white px-2 text-sm"
          >
            <option value="km">Kilometros</option>
            <option value="weekday">Dia de semana</option>
            <option value="dienstStartTime">Hora inicio Dienst</option>
            <option value="weekdayDienstStartTime">Dia + hora inicio Dienst</option>
          </select>
        </label>
        <NumberField
          label="Multiplicador"
          value={rule.multiplier}
          step={0.1}
          max={10}
          onChange={(value) => onChange({ ...rule, multiplier: value })}
        />
        <label className="text-xs text-slate-600">
          Activa
          <input
            type="checkbox"
            checked={rule.enabled}
            onChange={(e) => onChange({ ...rule, enabled: e.target.checked })}
            className="mt-2 block"
          />
        </label>
        <button
          type="button"
          onClick={props.onRemove}
          className="h-8 self-end rounded-md border border-rose-200 px-3 text-sm font-medium text-rose-700 hover:bg-rose-50"
        >
          Quitar
        </button>
      </div>

      <div className="mt-3">
        {rule.type === "km" && <KmFields rule={rule} onChange={onChange} />}
        {rule.type === "weekday" && <WeekdayFields rule={rule} onChange={onChange} />}
        {rule.type === "dienstStartTime" && (
          <DienstTimeFields rule={rule} onChange={onChange} />
        )}
        {rule.type === "weekdayDienstStartTime" && (
          <div className="grid gap-3 md:grid-cols-2">
            <WeekdayFields rule={rule} onChange={onChange} />
            <DienstTimeFields rule={rule} onChange={onChange} />
          </div>
        )}
        {rule.type === "weekdayPickupTime" && (
          <div className="grid gap-3 md:grid-cols-2">
            <WeekdayFields rule={rule} onChange={onChange} />
            <PickupTimeFields rule={rule} onChange={onChange} />
          </div>
        )}
      </div>
    </div>
  );
}

function NumberField(props: {
  label: string;
  value: number;
  step?: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="text-xs text-slate-600">
      {props.label}
      <input
        type="number"
        min={0}
        max={props.max ?? 10000}
        step={props.step ?? 1}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="mt-1 h-8 w-full rounded border border-slate-300 px-2 text-sm text-slate-900"
      />
    </label>
  );
}

function KmFields(props: {
  rule: Extract<PraemienRule, { type: "km" }>;
  onChange: (rule: PraemienRule) => void;
}) {
  return (
    <div className="grid gap-2 md:grid-cols-3">
      <NumberField
        label="Km desde"
        value={props.rule.minKm}
        onChange={(value) => props.onChange({ ...props.rule, minKm: value })}
      />
      <NumberField
        label="Km hasta"
        value={props.rule.maxKm ?? 0}
        onChange={(value) =>
          props.onChange({ ...props.rule, maxKm: value === 0 ? null : value })
        }
      />
      <p className="self-end text-xs text-slate-500">
        Usa 0 en hasta para dejar la regla sin limite superior.
      </p>
    </div>
  );
}

function WeekdayFields(props: {
  rule: Extract<
    PraemienRule,
    { type: "weekday" | "weekdayDienstStartTime" | "weekdayPickupTime" }
  >;
  onChange: (rule: PraemienRule) => void;
}) {
  const toggle = (weekday: number) => {
    const current = new Set(props.rule.weekdays);
    if (current.has(weekday)) current.delete(weekday);
    else current.add(weekday);
    props.onChange({ ...props.rule, weekdays: Array.from(current).sort() });
  };

  return (
    <div>
      <p className="text-xs text-slate-600">Dias</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {WEEKDAYS.map((day) => (
          <button
            key={day.value}
            type="button"
            onClick={() => toggle(day.value)}
            className={`h-8 min-w-8 rounded border px-2 text-xs font-medium ${
              props.rule.weekdays.includes(day.value)
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border-slate-200 bg-white text-slate-600"
            }`}
          >
            {day.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function DienstTimeFields(props: {
  rule: Extract<
    PraemienRule,
    { type: "dienstStartTime" | "weekdayDienstStartTime" }
  >;
  onChange: (rule: PraemienRule) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="text-xs text-slate-600">
        Dienst desde
        <input
          type="time"
          value={props.rule.startTimeFrom}
          onChange={(e) =>
            props.onChange({ ...props.rule, startTimeFrom: e.target.value })
          }
          className="mt-1 h-8 w-full rounded border border-slate-300 px-2 text-sm"
        />
      </label>
      <label className="text-xs text-slate-600">
        Dienst hasta
        <input
          type="time"
          value={props.rule.startTimeTo}
          onChange={(e) =>
            props.onChange({ ...props.rule, startTimeTo: e.target.value })
          }
          className="mt-1 h-8 w-full rounded border border-slate-300 px-2 text-sm"
        />
      </label>
    </div>
  );
}

function PickupTimeFields(props: {
  rule: Extract<PraemienRule, { type: "weekdayPickupTime" }>;
  onChange: (rule: PraemienRule) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="text-xs text-slate-600">
        Recogida desde
        <input
          type="time"
          value={props.rule.pickupTimeFrom}
          onChange={(e) =>
            props.onChange({ ...props.rule, pickupTimeFrom: e.target.value })
          }
          className="mt-1 h-8 w-full rounded border border-slate-300 px-2 text-sm"
        />
      </label>
      <label className="text-xs text-slate-600">
        Recogida hasta
        <input
          type="time"
          value={props.rule.pickupTimeTo}
          onChange={(e) =>
            props.onChange({ ...props.rule, pickupTimeTo: e.target.value })
          }
          className="mt-1 h-8 w-full rounded border border-slate-300 px-2 text-sm"
        />
      </label>
    </div>
  );
}
