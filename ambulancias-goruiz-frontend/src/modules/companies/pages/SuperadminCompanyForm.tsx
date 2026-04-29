import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  createCompany,
  updateCompany,
  getCompanyById,
} from "../domain/api";
import { toastT, getApiErrorMessage } from "../../../utils/toast";
import {
  ALL_MODULE_KEYS,
  MODULE_KEYS,
  MODULE_LABELS,
  V1_LOCKED_ON_MODULES,
} from "../../../constants/modules";
import type { UpdateCompanyInput } from "../domain/types";
import {
  getCurrentCalendarMonth,
  getNextCalendarMonth,
  shouldAttachPraemienEffectiveFromOnCompanyEdit,
} from "../utils/praemienScheduleEdit";
import SaveIconButton from "../../../components/common/actions/SaveIconButton";
import EditIconButton from "../../../components/common/actions/EditIconButton";

const MODULE_ICONS: Record<string, string> = {
  [MODULE_KEYS.HOSPITALS]: "🏥",
  [MODULE_KEYS.AMBULANCES]: "🚑",
  [MODULE_KEYS.TEAMS]: "👥",
  [MODULE_KEYS.SCHEDULING]: "🗓️",
  [MODULE_KEYS.WORKDAY]: "🚨",
  [MODULE_KEYS.MECHANICS]: "🔧",
  [MODULE_KEYS.APPOINTMENTS]: "📕",
  [MODULE_KEYS.MESSAGES]: "📨",
  [MODULE_KEYS.VACATION]: "🏖️",
  [MODULE_KEYS.SICK_LEAVES]: "🤒",
  [MODULE_KEYS.PRAEMIEN]: "🎖",
  [MODULE_KEYS.PAYROLL]: "🛠",
  [MODULE_KEYS.DOCUMENTS]: "📄",
  [MODULE_KEYS.EXCEL_PLANNING]: "📊",
};

export default function SuperadminCompanyForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isCreate = !id;

  const [name, setName] = useState("");
  const [emailDomain, setEmailDomain] = useState("");
  const [isActive, setIsActive] = useState(true);
  // Default on create: all modules off until explicitly enabled
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());
  const [praemienMode, setPraemienMode] = useState<"automatic" | "manual">(
    "automatic",
  );
  const [initialPraemienMode, setInitialPraemienMode] = useState<
    "automatic" | "manual" | null
  >(null);
  const [loadedEffectiveFrom, setLoadedEffectiveFrom] = useState<{
    year: number;
    month: number;
  } | null>(null);
  /** Any Prämien mode radio change this session (fixes M→A→M last-save scheduling). */
  const [praemienScheduleTouched, setPraemienScheduleTouched] = useState(false);
  const [loading, setLoading] = useState(!isCreate);
  const [submitting, setSubmitting] = useState(false);
  const [allowNameEdit, setAllowNameEdit] = useState(isCreate);
  const [allowEmailDomainEdit, setAllowEmailDomainEdit] = useState(isCreate);
  const [initialName, setInitialName] = useState("");
  const [initialEmailDomain, setInitialEmailDomain] = useState("");
  const [initialIsActive, setInitialIsActive] = useState(true);
  const [initialSelectedModules, setInitialSelectedModules] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    if (!isCreate) return;
    setPraemienMode("automatic");
    setInitialPraemienMode(null);
    setLoadedEffectiveFrom(null);
    setPraemienScheduleTouched(false);
    setAllowNameEdit(true);
    setAllowEmailDomainEdit(true);
    setInitialName("");
    setInitialEmailDomain("");
    setInitialIsActive(true);
    setSelectedModules(new Set());
    setInitialSelectedModules(new Set());
  }, [isCreate]);

  useEffect(() => {
    if (isCreate || !id) return;
    let cancelled = false;
    (async () => {
      try {
        const company = await getCompanyById(id);
        if (cancelled) return;
        setName(company.name);
        setEmailDomain(company.emailDomain ?? "");
        setIsActive(company.isActive);
        setInitialName(company.name);
        setInitialEmailDomain(company.emailDomain ?? "");
        setInitialIsActive(company.isActive);
        // Load existing module selection, falling back to all modules
        const modules = Array.isArray(company.enabledModules)
          ? company.enabledModules
          : ALL_MODULE_KEYS;
        setSelectedModules(new Set(modules));
        setInitialSelectedModules(new Set(modules));
        const pm =
          company.praemienMode === "manual" ? "manual" : "automatic";
        setPraemienMode(pm);
        setInitialPraemienMode(pm);
        const ef = company.praemienModeEffectiveFrom;
        setLoadedEffectiveFrom(
          ef &&
            typeof ef.year === "number" &&
            typeof ef.month === "number"
            ? { year: ef.year, month: ef.month }
            : null,
        );
        setPraemienScheduleTouched(false);
        setAllowNameEdit(false);
        setAllowEmailDomainEdit(false);
      } catch (e: unknown) {
        if (!cancelled) {
          toastT.error(getApiErrorMessage(e, "No se pudo cargar la empresa"));
          navigate("/superadmin/companies");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isCreate, navigate]);

  const toggleModule = (key: string) => {
    if (V1_LOCKED_ON_MODULES.has(key as never)) return; // V1 locked — no-op
    if (
      key === MODULE_KEYS.WORKDAY &&
      selectedModules.has(MODULE_KEYS.WORKDAY) &&
      selectedModules.has(MODULE_KEYS.PRAEMIEN) &&
      praemienMode === "automatic"
    ) {
      toastT.warn(
        "Prämien en modo automático usa la jornada digital. Cambia Prämien a «manual» para poder desactivar jornada y viajes (datos en papel).",
      );
      return;
    }
    setSelectedModules((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        if (key === MODULE_KEYS.PRAEMIEN && praemienMode === "automatic") {
          next.add(MODULE_KEYS.WORKDAY);
        }
      }
      return next;
    });
  };

  const hasChanges = useMemo(() => {
    const sameName = name.trim() === initialName.trim();
    const sameDomain = emailDomain.trim().toLowerCase() === initialEmailDomain.trim().toLowerCase();
    const sameActive = isActive === initialIsActive;
    const samePraemienMode = praemienMode === (initialPraemienMode ?? "automatic");
    const sameModules =
      selectedModules.size === initialSelectedModules.size &&
      Array.from(selectedModules).every((key) => initialSelectedModules.has(key));

    return !(sameName && sameDomain && sameActive && samePraemienMode && sameModules);
  }, [
    name,
    initialName,
    emailDomain,
    initialEmailDomain,
    isActive,
    initialIsActive,
    praemienMode,
    initialPraemienMode,
    selectedModules,
    initialSelectedModules,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const domainTrim = emailDomain.trim();
      if (!domainTrim) {
        toastT.error("El dominio de correo es obligatorio");
        return;
      }
      const enabledModules = Array.from(selectedModules);
      const hasPraemien = enabledModules.includes(MODULE_KEYS.PRAEMIEN);
      if (isCreate) {
        await createCompany({
          name: name.trim(),
          emailDomain: domainTrim.toLowerCase(),
          enabledModules,
          ...(hasPraemien
            ? {
                praemienMode,
                praemienModeEffectiveFrom:
                  praemienMode === "manual"
                    ? getCurrentCalendarMonth()
                    : null,
              }
            : {}),
        });
        toastT.success("Empresa creada correctamente");
      } else if (id) {
        const payload: UpdateCompanyInput = {
          name: name.trim(),
          isActive,
          emailDomain: domainTrim.toLowerCase(),
          enabledModules,
        };
        if (hasPraemien) {
          payload.praemienMode = praemienMode;
          if (
            shouldAttachPraemienEffectiveFromOnCompanyEdit({
              initialPraemienMode,
              praemienMode,
              praemienScheduleTouched,
            })
          ) {
            payload.praemienModeEffectiveFrom = getNextCalendarMonth();
          } else if (
            praemienMode === "manual" &&
            !loadedEffectiveFrom
          ) {
            // Empresas creadas antes con manual y sin fecha: vigencia desde el mes en curso.
            payload.praemienModeEffectiveFrom = getCurrentCalendarMonth();
          }
        }
        const stepUpCode = window.prompt(
          "Acción sensible: introduce tu código MFA de 6 dígitos para guardar cambios críticos.",
        );
        if (!stepUpCode) {
          toastT.error("Se canceló el guardado por falta de código MFA.");
          return;
        }
        await updateCompany(id, payload, stepUpCode);
        toastT.success("Empresa actualizada correctamente");
      }
      navigate("/superadmin/companies");
    } catch (err: unknown) {
      toastT.error(getApiErrorMessage(err, "Error al guardar la empresa"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 max-w-md mx-auto">
        <p className="text-slate-600">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">
        {isCreate ? "Nueva empresa" : "Editar empresa"}
      </h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="w-full lg:w-1/2 grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <label
              htmlFor="company-name"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              <span>Nombre</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                id="company-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!allowNameEdit}
                className="h-9 w-full max-w-sm rounded-md border border-slate-300 px-2.5 text-sm text-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
                required
              />
              {!isCreate && (
                <EditIconButton
                  onClick={() => setAllowNameEdit((prev) => !prev)}
                  title={allowNameEdit ? "Bloquear edición de nombre" : "Editar nombre"}
                />
              )}
            </div>
          </div>
          <div>
            <label
              htmlFor="company-email-domain"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              <span>Dominio de correo</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                id="company-email-domain"
                value={emailDomain}
                onChange={(e) => setEmailDomain(e.target.value)}
                placeholder="@empresa.com"
                disabled={!allowEmailDomainEdit}
                className="h-9 w-full max-w-sm rounded-md border border-slate-300 px-2.5 text-sm text-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
                required
              />
              {!isCreate && (
                <EditIconButton
                  onClick={() => setAllowEmailDomainEdit((prev) => !prev)}
                  title={
                    allowEmailDomainEdit
                      ? "Bloquear edición de dominio"
                      : "Editar dominio de correo"
                  }
                />
              )}
            </div>
          </div>
        </div>
        {!isCreate && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsActive((prev) => !prev)}
              aria-pressed={isActive}
              title={isActive ? "Desactivar empresa" : "Activar empresa"}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
                isActive
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
              }`}
            >
              ⏻
            </button>
            <span className="text-sm text-slate-700">
              {isActive ? "Empresa activa" : "Empresa desactivada"}
            </span>
          </div>
        )}

        {/* Module selection */}
        <fieldset className="border border-slate-200 rounded-lg p-4">
          <legend className="text-sm font-semibold text-slate-700 px-1">
            Módulos habilitados
          </legend>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {ALL_MODULE_KEYS.map((key) => {
              const isLocked = V1_LOCKED_ON_MODULES.has(key);
              const isChecked = selectedModules.has(key);
              const isPraemien = key === MODULE_KEYS.PRAEMIEN;
              return (
                <div key={key} className="space-y-1">
                  <div className="px-1 text-xs font-medium leading-snug text-slate-700 text-center">
                    {isLocked && <span className="mr-1">🔒</span>}
                    {MODULE_LABELS[key]}
                  </div>
                  <div
                    role="button"
                    tabIndex={isLocked ? -1 : 0}
                    aria-pressed={isChecked}
                    onClick={() => {
                      if (!isLocked) toggleModule(key);
                    }}
                    onKeyDown={(e) => {
                      if (isLocked) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleModule(key);
                      }
                    }}
                    className={`rounded-lg border px-2 py-2 transition
                      ${isLocked
                        ? "bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed"
                        : isChecked
                          ? "bg-blue-50 border-blue-200 text-slate-900 shadow-sm cursor-pointer hover:shadow-md hover:border-orange-300"
                          : "bg-white border-slate-200 text-slate-700 cursor-pointer hover:bg-blue-50 hover:shadow-md hover:border-orange-300"
                      }`}
                  >
                    <div className="w-full rounded-md px-2 py-2 text-left">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xl leading-none" aria-hidden>
                          {MODULE_ICONS[key] ?? "🧩"}
                        </span>
                        <span
                          className={`text-xs font-semibold ${
                            isChecked ? "text-emerald-700" : "text-slate-500"
                          }`}
                          aria-label={isChecked ? "activado" : "desactivado"}
                        >
                          {isChecked ? "✅" : "❌"}
                        </span>
                      </div>
                    </div>

                    {isPraemien && isChecked && (
                      <div className="mt-2 border-t border-blue-200 pt-2 space-y-2">
                        {!isCreate && loadedEffectiveFrom && (
                          <p className="text-[11px] text-amber-800 bg-amber-50 rounded px-2 py-1">
                            Cambio programado:{" "}
                            {String(loadedEffectiveFrom.month).padStart(2, "0")}/
                            {loadedEffectiveFrom.year}
                          </p>
                        )}
                        <div className="grid grid-cols-2 gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPraemienScheduleTouched(true);
                              setPraemienMode("automatic");
                              setSelectedModules((prev) => {
                                if (!prev.has(MODULE_KEYS.PRAEMIEN)) return prev;
                                const next = new Set(prev);
                                next.add(MODULE_KEYS.WORKDAY);
                                return next;
                              });
                            }}
                            className={`rounded-md px-2 py-1 text-[11px] font-medium border ${
                              praemienMode === "automatic"
                                ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            Automático
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPraemienScheduleTouched(true);
                              setPraemienMode("manual");
                            }}
                            className={`rounded-md px-2 py-1 text-[11px] font-medium border ${
                              praemienMode === "manual"
                                ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            Manual
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </fieldset>

        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate("/superadmin/companies")}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <SaveIconButton
            type="submit"
            disabled={submitting || !hasChanges}
            title={
              submitting
                ? "Guardando..."
                : !hasChanges
                  ? "Sin cambios por guardar"
                  : "Guardar"
            }
            className={hasChanges ? "ring-2 ring-emerald-300 bg-emerald-50" : ""}
          />
        </div>
      </form>
    </div>
  );
}
