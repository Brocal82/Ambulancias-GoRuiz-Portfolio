// src/modules/teams/components/TeamCreateModal.tsx
import { useTranslation } from "react-i18next";

import type { CreateTeamPayload } from "../domain";
import { useTeamForm } from "../hooks";
import TeamFormFields from "./TeamFormFields";

import CancelButton from "../../../components/common/actions/CancelButton";
import SaveIconButton from "../../../components/common/actions/SaveIconButton";

interface TeamCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  // 👇 De momento mantenemos la firma original (driver + medic)
  onConfirm: (payload: {
    driver: string;
    medic: string;
  }) => Promise<void> | void;
}

export default function TeamCreateModal({
  isOpen,
  onClose,
  onConfirm,
}: TeamCreateModalProps) {
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
  });

  if (!isOpen) return null;

  // 🚫 La ambulancia NO entra en la validación: sigue siendo opcional
  const canCreate =
    !!value.driver && !!value.medic && !samePerson && fixedValid;

  const handleCreate = async () => {
    if (!canCreate) return;
    try {
      setSubmitting(true);

      const payload: CreateTeamPayload = {
        driver: value.driver,
        medic: value.medic,
        rotationMode,
        fixedDienstNumber:
          isFixed && fixedDienstNumber !== ""
            ? Number(fixedDienstNumber)
            : null,
        // 🚑 Ambulancia fija opcional
        ambulanceId: ambulanceId || null,
      };

      await onConfirm(payload);

      // Reset tras crear
      setValue({ driver: "", medic: "" });
      setRotationMode("rotating");
      setFixedDienstNumber("");
      setAmbulanceId("");
      onClose();
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
              {t("pages.adminTeams.modal.title", "Crear equipo")}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {t(
                "pages.adminTeams.modal.subtitle",
                "Selecciona conductor, sanitario y su configuración básica.",
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
          mode="create"
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
            onClick={handleCreate}
            disabled={!canCreate || submitting}
            title={
              submitting
                ? t("common.saving", "Guardando...")
                : t("common.create", "Crear")
            }
          />
        </div>
      </div>
    </div>
  );
}