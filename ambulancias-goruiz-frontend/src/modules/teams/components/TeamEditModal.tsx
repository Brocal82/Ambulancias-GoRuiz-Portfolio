// src/modules/teams/components/TeamEditModal.tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import TeamPicker from "../../../components/common/TeamPicker";
import type { TeamPickerValue } from "../../../components/common/TeamPicker";

import { useAuth } from "../../../hooks/useAuth";

import type { Team, UpdateTeamPayload } from "../domain";
import CancelButton from "../../../components/common/actions/CancelButton";
import SaveIconButton from "../../../components/common/actions/SaveIconButton";

interface TeamEditModalProps {
  isOpen: boolean;
  team: Team;
  onClose: () => void;
  onConfirm: (
    teamId: string,
    payload: UpdateTeamPayload,
  ) => Promise<void> | void;
}

type AmbulanceLite = {
  _id: string;
  ambulanceNumber: string;
};

export default function TeamEditModal({
  isOpen,
  team,
  onClose,
  onConfirm,
}: TeamEditModalProps) {
  const { t } = useTranslation();
  const { token } = useAuth();

  // 👤 Selección de personas
  const [value, setValue] = useState<TeamPickerValue>({
    driver: team.driver?._id || "",
    medic: team.medic?._id || "",
  });

  // 🔁 Configuración de rotación
  const [rotationMode, setRotationMode] = useState<
    "rotating" | "fixed" | "none"
  >(team.rotationMode ?? "rotating");
  const [fixedDienstNumber, setFixedDienstNumber] = useState<number | "">(
    team.rotationMode === "fixed" && team.fixedDienstNumber != null
      ? team.fixedDienstNumber
      : "",
  );

  // 🚑 Ambulancia fija opcional
  const [ambulances, setAmbulances] = useState<AmbulanceLite[]>([]);
  const [ambulanceId, setAmbulanceId] = useState<string>(
    (team.ambulanceId as any)?._id || "",
  );
  const [loadingAmbulances, setLoadingAmbulances] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  // Sincronizar estado cuando cambie el team (por si se reabre con otro)
  useEffect(() => {
    setValue({
      driver: team.driver?._id || "",
      medic: team.medic?._id || "",
    });

    setRotationMode(team.rotationMode ?? "rotating");
    setFixedDienstNumber(
      team.rotationMode === "fixed" && team.fixedDienstNumber != null
        ? team.fixedDienstNumber
        : "",
    );
    setAmbulanceId((team.ambulanceId as any)?._id || "");
  }, [team]);

  // 🔁 Cargar ambulancias cuando se abra el modal
  useEffect(() => {
    if (!isOpen || !token) return;

    let cancelled = false;

    (async () => {
      try {
        setLoadingAmbulances(true);
        const res = await fetch("/api/ambulances", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          console.error("❌ Error HTTP al cargar ambulancias:", res.status);
          return;
        }
        const data = (await res.json()) as AmbulanceLite[];
        if (!cancelled) {
          setAmbulances(
            Array.isArray(data)
              ? data.sort((a, b) =>
                (a.ambulanceNumber || "").localeCompare(
                  b.ambulanceNumber || "",
                  "es",
                ),
              )
              : [],
          );
        }
      } catch (e) {
        console.error("❌ Error al cargar ambulancias en TeamEditModal:", e);
      } finally {
        if (!cancelled) setLoadingAmbulances(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, token]);

  if (!isOpen) return null;

  const samePerson = !!value.driver && value.driver === value.medic;
  const isFixed = rotationMode === "fixed";
  const fixedValid =
    !isFixed || (fixedDienstNumber !== "" && Number(fixedDienstNumber) > 0);

  const canSave = !!value.driver && !!value.medic && !samePerson && fixedValid;

  // Utilidad sencilla para clases
  const cx = (...classes: (string | false | null | undefined)[]) =>
    classes.filter(Boolean).join(" ");

  const handleSave = async () => {
    if (!canSave) return;

    try {
      setSubmitting(true);

      const payload: UpdateTeamPayload = {
        driver: value.driver,
        medic: value.medic,
        rotationMode,
        fixedDienstNumber:
          isFixed && fixedDienstNumber !== ""
            ? Number(fixedDienstNumber)
            : null,
        ambulanceId: ambulanceId || null,
      };

      await onConfirm(team._id, payload);
      // El cierre lo hace el padre al terminar bien
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Fondo oscuro */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />

      {/* Tarjeta modal */}
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {t("pages.adminTeams.editModal.title", "Editar equipo")}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {t(
                "pages.adminTeams.editModal.subtitle",
                "Modifica miembros, ambulancia y modo de rotación.",
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            aria-label={t("common.close", "Cerrar")}
          >
            ✕
          </button>
        </div>

        {/* 👤 Picker con las reglas */}
        <section className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {t("pages.adminTeams.editModal.members", "Miembros del equipo")}
          </p>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-3">
            <TeamPicker value={value} onChange={setValue} />
          </div>

          {samePerson && (
            <p className="mt-1 text-xs text-rose-600">
              {t(
                "pages.adminTeams.validation.samePerson",
                "El conductor y el sanitario no pueden ser la misma persona",
              )}
            </p>
          )}
        </section>

        {/* 🚑 Ambulancia fija opcional */}
        <section className="mt-4 space-y-2">
          <label
            htmlFor="teamEditAmbulance"
            className="text-xs font-medium uppercase tracking-wide text-slate-500"
          >
            {t(
              "pages.adminTeams.modal.ambulanceSection",
              "Ambulancia fija (opcional)",
            )}
          </label>

          <select
            id="teamEditAmbulance"
            value={ambulanceId}
            onChange={(e) => setAmbulanceId(e.target.value)}
            disabled={submitting || loadingAmbulances}
            className="w-full rounded-xl border border-slate-300 ring-1 ring-slate-200 px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50"
          >
            <option value="">
              {loadingAmbulances
                ? t("common.loading", "Cargando...")
                : t(
                  "pages.adminTeams.modal.ambulancePlaceholder",
                  "Sin ambulancia fija",
                )}
            </option>
            {ambulances.map((amb) => (
              <option key={amb._id} value={amb._id}>
                {amb.ambulanceNumber}
              </option>
            ))}
          </select>

          <p className="text-[11px] text-slate-500">
            {t(
              "pages.adminTeams.modal.ambulanceHelp",
              "Si este equipo suele trabajar siempre con la misma ambulancia, puedes seleccionarla aquí.",
            )}
          </p>
        </section>

        {/* 🔁 Configuración de rotación del equipo */}
        <section className="mt-4 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {t("pages.adminTeams.rotation.sectionTitle", "Modo de rotación")}
          </p>

          {/* Botones de modo compactos */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setRotationMode("rotating")}
              disabled={submitting}
              className={cx(
                "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition",
                rotationMode === "rotating"
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
              )}
            >
              <span>🔁</span>
              <span>
                {t("pages.adminTeams.rotation.badgeRotatingShort", "Rotación")}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setRotationMode("fixed")}
              disabled={submitting}
              className={cx(
                "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition",
                rotationMode === "fixed"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
              )}
            >
              <span>📌</span>
              <span>
                {t("pages.adminTeams.rotation.badgeFixedShort", "Dienst fijo")}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setRotationMode("none")}
              disabled={submitting}
              className={cx(
                "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition",
                rotationMode === "none"
                  ? "border-amber-500 bg-amber-50 text-amber-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
              )}
            >
              <span>✋</span>
              <span>
                {t("pages.adminTeams.rotation.badgeNoneShort", "Manual")}
              </span>
            </button>
          </div>

          {/* Número de Dienst fijo solo cuando rotationMode === 'fixed' */}
          {rotationMode === "fixed" && (
            <div className="mt-2">
              <label className="block text-xs font-medium text-slate-600">
                {t(
                  "pages.adminTeams.rotation.fixedDienstNumber",
                  "Número de Dienst fijo",
                )}
              </label>
              <input
                type="number"
                min={1}
                value={fixedDienstNumber}
                onChange={(e) =>
                  setFixedDienstNumber(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
                disabled={submitting}
                className="mt-1 w-32 rounded-xl border border-slate-300 ring-1 ring-slate-200 px-3 py-1.5 text-xs bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50"
                placeholder={
                  t(
                    "pages.adminTeams.rotation.fixedDienstPlaceholder",
                    "Ej: 7",
                  ) as string
                }
              />
              {!fixedValid && (
                <p className="mt-1 text-[11px] text-rose-600">
                  {t(
                    "pages.adminTeams.rotation.fixedDienstError",
                    "Indica un número de Dienst válido mayor que 0",
                  )}
                </p>
              )}
            </div>
          )}

          <p className="mt-1 text-[11px] text-slate-500">
            {t(
              "pages.adminTeams.rotation.editHelp",
              "Los cambios afectarán a la lógica de rotación en semanas futuras.",
            )}
          </p>
        </section>

        {/* Footer botones */}
        <div className="mt-3 flex items-center justify-end gap-2">
          <CancelButton onClick={onClose} disabled={submitting}>
            {t("common.cancel", "Cancelar")}
          </CancelButton>

          <SaveIconButton
            onClick={handleSave}
            disabled={!canSave || submitting}
            title={
              submitting
                ? t("common.saving", "Guardando...")
                : t("common.saveChanges", "Guardar cambios")
            }
          />
        </div>

      </div>
    </div>
  );
}
