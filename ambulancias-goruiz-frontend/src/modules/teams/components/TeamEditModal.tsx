// src/modules/teams/components/TeamEditModal.tsx
import { useTranslation } from "react-i18next";

import type { Team, UpdateTeamPayload } from "../domain";
import { useTeamForm } from "../hooks";
import TeamFormFields from "./TeamFormFields";

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

export default function TeamEditModal({
  isOpen,
  team,
  onClose,
  onConfirm,
}: TeamEditModalProps) {
  const { t } = useTranslation();

  const {
    value,
    setValue,
    rotationMode,
    setRotationMode,
    fixedDienstNumber,
    setFixedDienstNumber,
    ambulanceId,
    setAmbulanceId,
    ambulances,
    loadingAmbulances,
    submitting,
    setSubmitting,
    samePerson,
    isFixed,
    fixedValid,
  } = useTeamForm({
    isOpen,
    team,
  });

  if (!isOpen) return null;

  const canSave = !!value.driver && !!value.medic && !samePerson && fixedValid;

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
    } catch {
      // Error ya notificado con toast por el padre; el modal permanece abierto
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

        <TeamFormFields
          mode="edit"
          value={value}
          onValueChange={setValue}
          samePerson={samePerson}
          ambulanceId={ambulanceId}
          onAmbulanceChange={setAmbulanceId}
          ambulances={ambulances}
          loadingAmbulances={loadingAmbulances}
          rotationMode={rotationMode}
          onRotationModeChange={setRotationMode}
          fixedDienstNumber={fixedDienstNumber}
          onFixedDienstNumberChange={setFixedDienstNumber}
          fixedValid={fixedValid}
          submitting={submitting}
        />

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