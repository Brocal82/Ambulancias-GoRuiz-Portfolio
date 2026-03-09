import TeamPicker from "../../../components/common/TeamPicker";
import type { TeamPickerValue } from "../../../components/common/TeamPicker";
import { useTranslation } from "react-i18next";

import type { AmbulanceLite } from "../hooks";

type RotationMode = "rotating" | "fixed" | "none";

interface TeamFormFieldsProps {
    value: TeamPickerValue;
    onValueChange: (next: TeamPickerValue) => void;

    samePerson: boolean;

    ambulanceId: string;
    onAmbulanceChange: (value: string) => void;
    ambulances: AmbulanceLite[];
    loadingAmbulances: boolean;

    rotationMode: RotationMode;
    onRotationModeChange: (mode: RotationMode) => void;

    fixedDienstNumber: number | "";
    onFixedDienstNumberChange: (value: number | "") => void;
    fixedValid: boolean;

    submitting: boolean;

    mode: "create" | "edit";
}

export default function TeamFormFields({
    value,
    onValueChange,
    samePerson,
    ambulanceId,
    onAmbulanceChange,
    ambulances,
    loadingAmbulances,
    rotationMode,
    onRotationModeChange,
    fixedDienstNumber,
    onFixedDienstNumberChange,
    fixedValid,
    submitting,
    mode,
}: TeamFormFieldsProps) {
    const { t } = useTranslation();

    const cx = (...classes: (string | false | null | undefined)[]) =>
        classes.filter(Boolean).join(" ");

    const rotationHelpKey =
        mode === "edit"
            ? "pages.adminTeams.rotation.editHelp"
            : "pages.adminTeams.rotation.help";

    const rotationHelpFallback =
        mode === "edit"
            ? "Los cambios afectarán a la lógica de rotación en semanas futuras."
            : 'Puedes dejar "Rotación" si el equipo debe seguir la rotación habitual de Dienst.';

    return (
        <>
            {/* 👤 Picker con las reglas */}
            <section className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {mode === "edit"
                        ? t("pages.adminTeams.editModal.members", "Miembros del equipo")
                        : t("pages.adminTeams.modal.members", "Miembros del equipo")}
                </p>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                    <TeamPicker value={value} onChange={onValueChange} />
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
                    htmlFor={mode === "edit" ? "teamEditAmbulance" : "teamAmbulance"}
                    className="text-xs font-medium uppercase tracking-wide text-slate-500"
                >
                    {t(
                        "pages.adminTeams.modal.ambulanceSection",
                        "Ambulancia fija (opcional)",
                    )}
                </label>

                <select
                    id={mode === "edit" ? "teamEditAmbulance" : "teamAmbulance"}
                    value={ambulanceId}
                    onChange={(e) => onAmbulanceChange(e.target.value)}
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

                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => onRotationModeChange("rotating")}
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
                        onClick={() => onRotationModeChange("fixed")}
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
                        onClick={() => onRotationModeChange("none")}
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
                                onFixedDienstNumberChange(
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
                    {t(rotationHelpKey, rotationHelpFallback)}
                </p>
            </section>
        </>
    );
}