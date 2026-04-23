import { useEffect, useState } from "react";
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

export default function SuperadminCompanyForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isCreate = !id;

  const [name, setName] = useState("");
  const [emailDomain, setEmailDomain] = useState("");
  const [isActive, setIsActive] = useState(true);
  // Default: all V1 modules pre-selected
  const [selectedModules, setSelectedModules] = useState<Set<string>>(
    new Set(ALL_MODULE_KEYS),
  );
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

  useEffect(() => {
    if (!isCreate) return;
    setPraemienMode("automatic");
    setInitialPraemienMode(null);
    setLoadedEffectiveFrom(null);
    setPraemienScheduleTouched(false);
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
        // Load existing module selection, falling back to all modules
        const modules =
          Array.isArray(company.enabledModules) &&
          company.enabledModules.length > 0
            ? company.enabledModules
            : ALL_MODULE_KEYS;
        setSelectedModules(new Set(modules));
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
    setSelectedModules((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        if (key === MODULE_KEYS.WORKDAY) {
          next.delete(MODULE_KEYS.PRAEMIEN);
        }
      } else {
        next.add(key);
        if (key === MODULE_KEYS.PRAEMIEN) {
          next.add(MODULE_KEYS.WORKDAY);
        }
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const domainTrim = emailDomain.trim();
      const enabledModules = Array.from(selectedModules);
      const hasPraemien = enabledModules.includes(MODULE_KEYS.PRAEMIEN);
      if (isCreate) {
        await createCompany({
          name: name.trim(),
          ...(domainTrim ? { emailDomain: domainTrim.toLowerCase() } : {}),
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
          emailDomain: domainTrim ? domainTrim.toLowerCase() : null,
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
        await updateCompany(id, payload);
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
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">
        {isCreate ? "Nueva empresa" : "Editar empresa"}
      </h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="company-name"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Nombre
          </label>
          <input
            id="company-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
            required
          />
        </div>
        <div>
          <label
            htmlFor="company-email-domain"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Dominio de correo (opcional)
          </label>
          <input
            id="company-email-domain"
            value={emailDomain}
            onChange={(e) => setEmailDomain(e.target.value)}
            placeholder="@empresa.com"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
          />
          <p className="text-xs text-slate-500 mt-1">
            Debe empezar por @. Se usa al crear administradores e invitaciones.
          </p>
        </div>
        {!isCreate && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span className="text-sm text-slate-700">Empresa activa</span>
          </label>
        )}

        {/* Module selection */}
        <fieldset className="border border-slate-200 rounded-lg p-4">
          <legend className="text-sm font-semibold text-slate-700 px-1">
            Módulos habilitados
          </legend>
          <p className="text-xs text-slate-500 mb-3">
            El módulo bloqueado (🔒) —planificación (diensts)— es operativo
            esencial en V1. Jornada y viajes (workday) se pueden desactivar si
            la empresa no usa jornada digital; Prämien requiere jornada.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ALL_MODULE_KEYS.map((key) => {
              const isLocked = V1_LOCKED_ON_MODULES.has(key);
              const isChecked = selectedModules.has(key);
              return (
                <label
                  key={key}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm
                    ${isLocked
                      ? "bg-slate-100 text-slate-500 cursor-not-allowed"
                      : "cursor-pointer hover:bg-slate-50"
                    }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={isLocked}
                    onChange={() => toggleModule(key)}
                    className="rounded border-slate-300 disabled:opacity-50"
                  />
                  <span>
                    {isLocked && (
                      <span className="mr-1" aria-label="bloqueado">🔒</span>
                    )}
                    {MODULE_LABELS[key]}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {selectedModules.has(MODULE_KEYS.PRAEMIEN) && (
          <fieldset className="border border-slate-200 rounded-lg p-4">
            <legend className="text-sm font-semibold text-slate-700 px-1">
              Prämien — modo de cálculo
            </legend>
            <p className="text-xs text-slate-500 mb-3">
              Si cambias entre automático y manual, el nuevo modo aplica desde
              el <strong>primer día del mes siguiente</strong> al guardar. La
              fase manual completa llegará en una versión posterior.
            </p>
            {!isCreate && loadedEffectiveFrom && (
              <p className="text-xs text-amber-800 bg-amber-50 rounded px-2 py-1.5 mb-3">
                Cambio de modo programado: desde{" "}
                {String(loadedEffectiveFrom.month).padStart(2, "0")}/
                {loadedEffectiveFrom.year}
              </p>
            )}
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="praemienMode"
                checked={praemienMode === "automatic"}
                onChange={() => {
                  setPraemienScheduleTouched(true);
                  setPraemienMode("automatic");
                }}
                className="border-slate-300"
              />
              <span>Automático (comportamiento actual)</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer mt-2">
              <input
                type="radio"
                name="praemienMode"
                checked={praemienMode === "manual"}
                onChange={() => {
                  setPraemienScheduleTouched(true);
                  setPraemienMode("manual");
                }}
                className="border-slate-300"
              />
              <span>Manual (solo guardado; sin flujo todavía)</span>
            </label>
          </fieldset>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? "Guardando…" : "Guardar"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/superadmin/companies")}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
