import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  getPraemienRules,
  updatePraemienRules,
  type PraemienRule,
  type PraemienRuleConfig,
} from "../domain/api";
import { toastT, getApiErrorMessage } from "../../../utils/toast";
import { confirmAction } from "../../../utils/confirm";
import CancelButton from "../../../components/common/actions/CancelButton";
import SaveIconButton from "../../../components/common/actions/SaveIconButton";
import CreateIconButton from "../../../components/common/actions/CreateIconButton";
import { withCommonIconButtonInteraction } from "../../../components/common/actions/iconButtonStyles";
import EditIconButton from "../../../components/common/actions/EditIconButton";
import DeleteIconButton from "../../../components/common/actions/DeleteIconButton";
import StatusBadge from "../../../components/common/StatusBadge";
import { APP_NAV_MATCH_TABLE_THEAD_STICKY } from "../../../components/ui/appTableHeader";
import {
  changePraemienRuleType,
  clonePraemienRule,
  clonePraemienRules,
  createPraemienRule,
  DEFAULT_PRAEMIEN_RULES,
  MAX_PRAEMIEN_RULES,
  PRAEMIEN_MULTIPLIER_STEP,
  PRAEMIEN_RULE_TYPES,
  PRAEMIEN_WEEKDAY_OPTIONS,
} from "../utils/praemienRuleFactory";
import {
  formatMultiplierSummary,
  formatRuleEffectiveFrom,
  formatRuleEffectiveTo,
  getRuleConditionChips,
  getRuleDisplayName,
  getRuleTypeLabel,
} from "../utils/praemienRuleSummary";
import {
  getPraemienRuleLifecycleStatus,
  getPraemienRuleLifecycleTone,
} from "../utils/praemienRuleValidity";
import {
  getRuleFieldIssues,
  validatePraemienRuleConfig,
  type PraemienRuleValidationIssue,
} from "../utils/validatePraemienRules";

type RuleModalState =
  | { mode: "create"; sessionKey: number; draft: PraemienRule }
  | { mode: "edit"; sessionKey: number; index: number; draft: PraemienRule };

export function AdminPraemienRulesPanel() {
  const { t } = useTranslation();
  const [rules, setRules] = useState<PraemienRuleConfig>(DEFAULT_PRAEMIEN_RULES);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [ruleModal, setRuleModal] = useState<RuleModalState | null>(null);
  const [modalSessionKey, setModalSessionKey] = useState(0);
  const [listExpanded, setListExpanded] = useState(false);

  const beginModalSession = () => {
    const nextKey = modalSessionKey + 1;
    setModalSessionKey(nextKey);
    return nextKey;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getPraemienRules();
        if (cancelled) return;
        setRules(clonePraemienRules(data));
        setLoadError(null);
      } catch (error) {
        if (!cancelled) {
          const message = getApiErrorMessage(
            error,
            t("pages.praemien.adminRules.loadError"),
          );
          setLoadError(message);
          toastT.error(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const modalDraftConfig = useMemo((): PraemienRuleConfig | null => {
    if (!ruleModal) return null;
    if (ruleModal.mode === "create") {
      return {
        ...rules,
        rules: [...rules.rules, ruleModal.draft],
      };
    }
    return {
      ...rules,
      rules: rules.rules.map((rule, index) =>
        index === ruleModal.index ? ruleModal.draft : rule,
      ),
    };
  }, [ruleModal, rules]);

  const modalValidationIssues = useMemo(() => {
    if (!modalDraftConfig || !ruleModal) return [];
    return validatePraemienRuleConfig(modalDraftConfig);
  }, [modalDraftConfig, ruleModal]);

  const modalDraftRuleIndex =
    ruleModal?.mode === "create"
      ? (modalDraftConfig?.rules.length ?? 1) - 1
      : ruleModal?.index ?? 0;

  const persistRules = async (nextConfig: PraemienRuleConfig): Promise<boolean> => {
    const issues = validatePraemienRuleConfig(nextConfig);
    if (issues.length > 0) {
      toastT.error(t(issues[0].messageKey));
      return false;
    }

    setSaving(true);
    try {
      const saved = await updatePraemienRules(nextConfig);
      setRules(clonePraemienRules(saved));
      setRuleModal(null);
      toastT.success(t("pages.praemien.adminRules.saveSuccess"));
      return true;
    } catch (error) {
      toastT.error(
        getApiErrorMessage(error, t("pages.praemien.adminRules.saveError")),
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  const openCreateModal = () => {
    if (rules.rules.length >= MAX_PRAEMIEN_RULES) {
      toastT.error(t("pages.praemien.adminRules.validation.maxRules"));
      return;
    }
    setRuleModal({
      mode: "create",
      sessionKey: beginModalSession(),
      draft: createPraemienRule("km"),
    });
  };

  const openEditModal = (index: number) => {
    const rule = rules.rules[index];
    if (!rule) return;
    setRuleModal({
      mode: "edit",
      sessionKey: beginModalSession(),
      index,
      draft: clonePraemienRule(rule),
    });
  };

  const closeModal = () => {
    if (saving) return;
    setRuleModal(null);
  };

  const saveModal = async () => {
    if (!ruleModal || !modalDraftConfig) return;
    await persistRules(modalDraftConfig);
  };

  const toggleRuleEnabled = async (index: number) => {
    const rule = rules.rules[index];
    if (!rule || saving) return;
    const nextConfig = clonePraemienRules(rules);
    nextConfig.rules[index] = { ...rule, enabled: !rule.enabled };
    await persistRules(nextConfig);
  };

  const removeRule = async (index: number) => {
    if (saving) return;
    if (!(await confirmAction(t("pages.praemien.adminRules.confirmRemove")))) {
      return;
    }
    const nextConfig = clonePraemienRules(rules);
    nextConfig.rules = nextConfig.rules.filter((_, i) => i !== index);
    await persistRules(nextConfig);
  };

  if (loading) {
    return (
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm text-slate-600">
          {t("pages.praemien.adminRules.loading")}
        </p>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="rounded-2xl bg-rose-50 p-5 shadow-sm ring-1 ring-rose-200">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
          {t("pages.praemien.adminRules.title")}
        </h2>
        <p className="mt-2 text-sm text-rose-700">{loadError}</p>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            {t("pages.praemien.adminRules.title")}
          </h2>
          <button
            type="button"
            id="praemien-rules-list-toggle"
            aria-expanded={listExpanded}
            aria-controls="praemien-rules-list"
            aria-label={t("pages.praemien.adminRules.toggleRulesList", {
              count: rules.rules.length,
            })}
            onClick={() => setListExpanded((expanded) => !expanded)}
            className={withCommonIconButtonInteraction(
              "inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-slate-200 bg-white px-2 text-sm font-medium tabular-nums text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400",
            )}
          >
            {rules.rules.length}
          </button>
        </div>
        <CreateIconButton
          onClick={openCreateModal}
          label={t("pages.praemien.adminRules.addRule")}
          disabled={saving || rules.rules.length >= MAX_PRAEMIEN_RULES}
        />
      </div>

      {listExpanded ? (
        <div id="praemien-rules-list">
          {rules.rules.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 py-10 text-center">
              <p className="text-sm text-slate-500">
                {t("pages.praemien.adminRules.empty")}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200">
          <table className="w-full min-w-[56rem] table-auto border-collapse text-sm">
            <colgroup>
              <col className="w-[7rem]" />
              <col />
              <col className="w-[10rem]" />
              <col className="w-[7.5rem]" />
              <col className="w-[7.5rem]" />
              <col />
              <col className="w-[6rem]" />
              <col className="w-[10rem]" />
            </colgroup>
            <thead className={APP_NAV_MATCH_TABLE_THEAD_STICKY}>
              <tr className="text-slate-200">
                <th className="px-3 py-2 text-left font-semibold">
                  {t("pages.praemien.adminRules.table.status")}
                </th>
                <th className="px-3 py-2 text-left font-semibold">
                  {t("pages.praemien.adminRules.table.name")}
                </th>
                <th className="px-3 py-2 text-left font-semibold">
                  {t("pages.praemien.adminRules.table.type")}
                </th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">
                  {t("pages.praemien.adminRules.table.fromDate")}
                </th>
                <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">
                  {t("pages.praemien.adminRules.table.untilDate")}
                </th>
                <th className="px-3 py-2 text-left font-semibold">
                  {t("pages.praemien.adminRules.table.conditions")}
                </th>
                <th className="px-3 py-2 text-left font-semibold">
                  {t("pages.praemien.adminRules.table.effect")}
                </th>
                <th className="px-3 py-2 text-center font-semibold">
                  {t("pages.praemien.adminRules.table.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rules.rules.map((rule, index) => (
                <RuleOverviewRow
                  key={rule.id ?? index}
                  rule={rule}
                  busy={saving}
                  onEdit={() => openEditModal(index)}
                  onToggleEnabled={() => void toggleRuleEnabled(index)}
                  onRemove={() => void removeRule(index)}
                />
              ))}
            </tbody>
          </table>
        </div>
          )}
        </div>
      ) : null}

      {ruleModal ? (
        <PraemienRuleModal
          mode={ruleModal.mode}
          sessionKey={ruleModal.sessionKey}
          draft={ruleModal.draft}
          saving={saving}
          validationIssues={modalValidationIssues}
          draftRuleIndex={modalDraftRuleIndex}
          onDraftChange={(draft) =>
            setRuleModal((current) => (current ? { ...current, draft } : null))
          }
          onClose={closeModal}
          onSave={() => void saveModal()}
        />
      ) : null}
    </section>
  );
}

function RuleOverviewRow(props: {
  rule: PraemienRule;
  busy: boolean;
  onEdit: () => void;
  onToggleEnabled: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const { rule, busy } = props;
  const chips = getRuleConditionChips(rule, t);
  const lifecycle = getPraemienRuleLifecycleStatus(rule);

  return (
    <tr className="even:bg-slate-50/40 hover:bg-blue-50/60 transition-colors">
      <td className="border-t border-slate-200 px-3 py-2 align-middle">
        <StatusBadge
          label={t(`pages.praemien.adminRules.status.${lifecycle}`)}
          tone={getPraemienRuleLifecycleTone(lifecycle)}
        />
      </td>
      <td className="border-t border-slate-200 px-3 py-2 align-middle">
        <span className="font-medium text-slate-900">
          {getRuleDisplayName(rule, t)}
        </span>
      </td>
      <td className="border-t border-slate-200 px-3 py-2 align-middle">
        <span className="text-slate-700">{getRuleTypeLabel(rule.type, t)}</span>
      </td>
      <td className="border-t border-slate-200 px-3 py-2 align-middle whitespace-nowrap">
        <span className="text-slate-700 tabular-nums">
          {formatRuleEffectiveFrom(rule, t)}
        </span>
      </td>
      <td className="border-t border-slate-200 px-3 py-2 align-middle whitespace-nowrap">
        <span className="text-slate-700 tabular-nums">
          {formatRuleEffectiveTo(rule, t)}
        </span>
      </td>
      <td className="border-t border-slate-200 px-3 py-2 align-middle">
        <div className="flex flex-wrap gap-1">
          {chips.length === 0 ? (
            <span className="text-xs text-slate-400">—</span>
          ) : (
            chips.map((chip) => (
              <span
                key={chip.key}
                className="inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700"
              >
                {chip.label}
              </span>
            ))
          )}
        </div>
      </td>
      <td className="border-t border-slate-200 px-3 py-2 align-middle">
        <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800">
          {formatMultiplierSummary(rule.multiplier)}
        </span>
      </td>
      <td className="border-t border-slate-200 px-3 py-2 align-middle">
        <div className="flex items-center justify-center gap-1">
          <EditIconButton
            onClick={props.onEdit}
            disabled={busy}
            title={t("pages.praemien.adminRules.actions.edit")}
          />
          <button
            type="button"
            onClick={props.onToggleEnabled}
            disabled={busy}
            className="inline-flex h-8 items-center rounded-md border border-slate-200 px-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            title={
              rule.enabled
                ? t("pages.praemien.adminRules.actions.disable")
                : t("pages.praemien.adminRules.actions.enable")
            }
          >
            {rule.enabled
              ? t("pages.praemien.adminRules.actions.disableShort")
              : t("pages.praemien.adminRules.actions.enableShort")}
          </button>
          <DeleteIconButton
            onClick={props.onRemove}
            disabled={busy}
            title={t("pages.praemien.adminRules.actions.remove")}
          />
        </div>
      </td>
    </tr>
  );
}

function PraemienRuleModal(props: {
  mode: "create" | "edit";
  sessionKey: number;
  draft: PraemienRule;
  saving: boolean;
  validationIssues: PraemienRuleValidationIssue[];
  draftRuleIndex: number;
  onDraftChange: (draft: PraemienRule) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const { t } = useTranslation();
  const title =
    props.mode === "create"
      ? t("pages.praemien.adminRules.createRule")
      : t("pages.praemien.adminRules.editRule");
  const hasValidationErrors = props.validationIssues.length > 0;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    props.onSave();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-lg ring-1 ring-slate-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="praemien-rule-modal-title"
      >
        <div className="border-b border-slate-200 px-5 py-3">
          <h2 id="praemien-rule-modal-title" className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <RuleEditor
            key={props.sessionKey}
            mode={props.mode}
            rule={props.draft}
            ruleIndex={props.draftRuleIndex}
            validationIssues={props.validationIssues}
            onChange={props.onDraftChange}
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <CancelButton type="button" onClick={props.onClose} disabled={props.saving}>
            {t("pages.praemien.adminRules.modalCancel")}
          </CancelButton>
          <SaveIconButton
            type="submit"
            disabled={props.saving || hasValidationErrors}
            title={
              props.saving
                ? t("pages.praemien.adminRules.saving")
                : t("pages.praemien.adminRules.modalSave")
            }
          />
        </div>
      </form>
    </div>
  );
}

function RuleEditor(props: {
  mode: "create" | "edit";
  rule: PraemienRule;
  ruleIndex: number;
  validationIssues: PraemienRuleValidationIssue[];
  onChange: (rule: PraemienRule) => void;
}) {
  const { t } = useTranslation();
  const { mode, rule, ruleIndex, validationIssues, onChange } = props;

  const fieldError = (field: string) => {
    const issues = getRuleFieldIssues(validationIssues, ruleIndex, field);
    if (!issues.length) return null;
    return t(issues[0].messageKey);
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-[1.4fr_1fr_1fr]">
        <label className="text-xs text-slate-600">
          {t("pages.praemien.adminRules.fields.name")}
          <input
            value={rule.label ?? ""}
            autoComplete="off"
            onChange={(e) => onChange({ ...rule, label: e.target.value })}
            className={`mt-1 h-8 w-full rounded border px-2 text-sm ${
              fieldError("label")
                ? "border-rose-400 bg-rose-50"
                : "border-slate-300"
            }`}
          />
          {fieldError("label") ? (
            <span className="mt-1 block text-xs text-rose-600">
              {fieldError("label")}
            </span>
          ) : null}
        </label>
        <label className="text-xs text-slate-600">
          {t("pages.praemien.adminRules.fields.type")}
          <select
            value={rule.type}
            onChange={(e) =>
              onChange(
                changePraemienRuleType(
                  rule,
                  e.target.value as PraemienRule["type"],
                  mode,
                ),
              )
            }
            className="mt-1 h-8 w-full rounded border border-slate-300 bg-white px-2 text-sm"
          >
            {PRAEMIEN_RULE_TYPES.map((type) => (
              <option key={type} value={type}>
                {getRuleTypeLabel(type, t)}
              </option>
            ))}
          </select>
        </label>
        <NumberField
          label={t("pages.praemien.adminRules.fields.multiplier")}
          value={rule.multiplier}
          step={PRAEMIEN_MULTIPLIER_STEP}
          min={0}
          max={10}
          error={fieldError("multiplier")}
          onChange={(value) => onChange({ ...rule, multiplier: value })}
        />
      </div>

      <div className="grid gap-2 border-t border-slate-100 pt-3 md:grid-cols-2">
        <label className="text-xs text-slate-600">
          {t("pages.praemien.adminRules.fields.startDate")}
          <input
            type="date"
            value={rule.effectiveFrom ?? ""}
            onChange={(e) =>
              onChange({
                ...rule,
                effectiveFrom: e.target.value ? e.target.value : null,
              })
            }
            className={`mt-1 h-8 w-full rounded border px-2 text-sm ${
              fieldError("effectiveFrom")
                ? "border-rose-400 bg-rose-50"
                : "border-slate-300"
            }`}
          />
          {fieldError("effectiveFrom") ? (
            <span className="mt-1 block text-xs text-rose-600">
              {fieldError("effectiveFrom")}
            </span>
          ) : (
            <span className="mt-1 block text-xs text-slate-500">
              {t("pages.praemien.adminRules.fields.startDateHint")}
            </span>
          )}
        </label>
        <label className="text-xs text-slate-600">
          {t("pages.praemien.adminRules.fields.endDate")}
          <input
            type="date"
            value={rule.effectiveTo ?? ""}
            onChange={(e) =>
              onChange({
                ...rule,
                effectiveTo: e.target.value ? e.target.value : null,
              })
            }
            className={`mt-1 h-8 w-full rounded border px-2 text-sm ${
              fieldError("effectiveTo")
                ? "border-rose-400 bg-rose-50"
                : "border-slate-300"
            }`}
          />
          {fieldError("effectiveTo") ? (
            <span className="mt-1 block text-xs text-rose-600">
              {fieldError("effectiveTo")}
            </span>
          ) : (
            <span className="mt-1 block text-xs text-slate-500">
              {t("pages.praemien.adminRules.fields.endDateHint")}
            </span>
          )}
        </label>
      </div>

      <div className="border-t border-slate-100 pt-3">
        {rule.type === "km" ? (
          <KmFields rule={rule} onChange={onChange} issues={validationIssues} ruleIndex={ruleIndex} />
        ) : null}
        {rule.type === "weekday" ? (
          <WeekdayFields rule={rule} onChange={onChange} issues={validationIssues} ruleIndex={ruleIndex} />
        ) : null}
        {rule.type === "dienstStartTime" ? (
          <DienstTimeFields rule={rule} onChange={onChange} issues={validationIssues} ruleIndex={ruleIndex} />
        ) : null}
        {rule.type === "weekdayDienstStartTime" ? (
          <div className="grid gap-3 md:grid-cols-2">
            <WeekdayFields rule={rule} onChange={onChange} issues={validationIssues} ruleIndex={ruleIndex} />
            <DienstTimeFields rule={rule} onChange={onChange} issues={validationIssues} ruleIndex={ruleIndex} />
          </div>
        ) : null}
        {rule.type === "weekdayPickupTime" ? (
          <div className="grid gap-3 md:grid-cols-2">
            <WeekdayFields rule={rule} onChange={onChange} issues={validationIssues} ruleIndex={ruleIndex} />
            <PickupTimeFields rule={rule} onChange={onChange} issues={validationIssues} ruleIndex={ruleIndex} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function NumberField(props: {
  label: string;
  value: number;
  step?: number;
  min?: number;
  max?: number;
  error?: string | null;
  onChange: (value: number) => void;
}) {
  return (
    <label className="text-xs text-slate-600">
      {props.label}
      <input
        type="number"
        min={props.min ?? 0}
        max={props.max ?? 10000}
        step={props.step ?? 1}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className={`mt-1 h-8 w-full rounded border px-2 text-sm text-slate-900 ${
          props.error ? "border-rose-400 bg-rose-50" : "border-slate-300"
        }`}
      />
      {props.error ? (
        <span className="mt-1 block text-xs text-rose-600">{props.error}</span>
      ) : null}
    </label>
  );
}

function useFieldError(
  issues: PraemienRuleValidationIssue[],
  ruleIndex: number,
  field: string,
) {
  const { t } = useTranslation();
  const matched = getRuleFieldIssues(issues, ruleIndex, field);
  return matched.length ? t(matched[0].messageKey) : null;
}

function KmFields(props: {
  rule: Extract<PraemienRule, { type: "km" }>;
  onChange: (rule: PraemienRule) => void;
  issues: PraemienRuleValidationIssue[];
  ruleIndex: number;
}) {
  const { t } = useTranslation();
  const minKmError = useFieldError(props.issues, props.ruleIndex, "minKm");
  const maxKmError = useFieldError(props.issues, props.ruleIndex, "maxKm");

  return (
    <div className="grid gap-2 md:grid-cols-3">
      <NumberField
        label={t("pages.praemien.adminRules.fields.kmFrom")}
        value={props.rule.minKm}
        error={minKmError}
        onChange={(value) => props.onChange({ ...props.rule, minKm: value })}
      />
      <NumberField
        label={t("pages.praemien.adminRules.fields.kmTo")}
        value={props.rule.maxKm ?? 0}
        error={maxKmError}
        onChange={(value) =>
          props.onChange({ ...props.rule, maxKm: value === 0 ? null : value })
        }
      />
      <p className="self-end text-xs text-slate-500">
        {t("pages.praemien.adminRules.fields.kmOpenEndHint")}
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
  issues: PraemienRuleValidationIssue[];
  ruleIndex: number;
}) {
  const { t } = useTranslation();
  const weekdayError = useFieldError(props.issues, props.ruleIndex, "weekdays");

  const toggle = (weekday: number) => {
    const current = new Set(props.rule.weekdays);
    if (current.has(weekday)) current.delete(weekday);
    else current.add(weekday);
    props.onChange({ ...props.rule, weekdays: Array.from(current).sort() });
  };

  return (
    <div>
      <p className="text-xs text-slate-600">
        {t("pages.praemien.adminRules.fields.weekdays")}
      </p>
      <div className="mt-1 flex flex-wrap gap-1">
        {PRAEMIEN_WEEKDAY_OPTIONS.map((day) => (
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
            {t(`pages.praemien.adminRules.weekdayShort.${day.labelKey}`)}
          </button>
        ))}
      </div>
      {weekdayError ? (
        <span className="mt-1 block text-xs text-rose-600">{weekdayError}</span>
      ) : null}
    </div>
  );
}

function DienstTimeFields(props: {
  rule: Extract<
    PraemienRule,
    { type: "dienstStartTime" | "weekdayDienstStartTime" }
  >;
  onChange: (rule: PraemienRule) => void;
  issues: PraemienRuleValidationIssue[];
  ruleIndex: number;
}) {
  const { t } = useTranslation();
  // Both hooks must run on every render (no `??` short-circuit between hook calls).
  const startTimeError = useFieldError(props.issues, props.ruleIndex, "startTime");
  const startTimeToError = useFieldError(props.issues, props.ruleIndex, "startTimeTo");
  const timeError = startTimeError ?? startTimeToError;

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-slate-600">
          {t("pages.praemien.adminRules.fields.dienstFrom")}
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
          {t("pages.praemien.adminRules.fields.dienstTo")}
          <input
            type="time"
            value={props.rule.startTimeTo}
            onChange={(e) =>
              props.onChange({ ...props.rule, startTimeTo: e.target.value })
            }
            className={`mt-1 h-8 w-full rounded border px-2 text-sm ${
              timeError ? "border-rose-400 bg-rose-50" : "border-slate-300"
            }`}
          />
        </label>
      </div>
      {timeError ? (
        <span className="mt-1 block text-xs text-rose-600">{timeError}</span>
      ) : null}
    </div>
  );
}

function PickupTimeFields(props: {
  rule: Extract<PraemienRule, { type: "weekdayPickupTime" }>;
  onChange: (rule: PraemienRule) => void;
  issues: PraemienRuleValidationIssue[];
  ruleIndex: number;
}) {
  const { t } = useTranslation();
  // Both hooks must run on every render (no `??` short-circuit between hook calls).
  const pickupTimeError = useFieldError(props.issues, props.ruleIndex, "pickupTime");
  const pickupTimeToError = useFieldError(props.issues, props.ruleIndex, "pickupTimeTo");
  const timeError = pickupTimeError ?? pickupTimeToError;

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-slate-600">
          {t("pages.praemien.adminRules.fields.pickupFrom")}
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
          {t("pages.praemien.adminRules.fields.pickupTo")}
          <input
            type="time"
            value={props.rule.pickupTimeTo}
            onChange={(e) =>
              props.onChange({ ...props.rule, pickupTimeTo: e.target.value })
            }
            className={`mt-1 h-8 w-full rounded border px-2 text-sm ${
              timeError ? "border-rose-400 bg-rose-50" : "border-slate-300"
            }`}
          />
        </label>
      </div>
      {timeError ? (
        <span className="mt-1 block text-xs text-rose-600">{timeError}</span>
      ) : null}
    </div>
  );
}
