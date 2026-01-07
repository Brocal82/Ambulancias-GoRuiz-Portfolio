//src/components/hospitals/HospitalCreateForm.tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import SaveIconButton from "../common/actions/SaveIconButton";
import CancelButton from "../common/actions/CancelButton";


interface Props {
    specialties: string[];
    onSubmit: (data: {
        name: string;
        address: string;
        phone: string;
        specialties: string[];
    }) => void;
    onClose: () => void;
}

const HospitalCreateForm = ({ specialties, onSubmit, onClose }: Props) => {
    const { t } = useTranslation();

    const [form, setForm] = useState({
        name: "",
        address: "",
        phone: "",
        specialties: "",
    });

    // Chips de especialidades
    const [specInput, setSpecInput] = useState<string>("");
    const [newSpecs, setNewSpecs] = useState<string[]>([]);

    const addSpec = () => {
        const raw = (specInput || form.specialties).trim();
        if (!raw) return;

        const parts = raw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

        if (!parts.length) return;

        setNewSpecs((prev) => {
            const set = new Set(prev);
            parts.forEach((p) => set.add(p));
            return Array.from(set);
        });

        setSpecInput("");
        setForm((f) => ({ ...f, specialties: "" }));
    };

    const removeSpec = (s: string) => {
        setNewSpecs((prev) => prev.filter((x) => x !== s));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const tail = form.specialties
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

        const combinedSet = new Set<string>([...newSpecs, ...tail]);
        const finalSpecialties = Array.from(combinedSet);

        onSubmit({
            name: form.name.trim(),
            address: form.address.trim(),
            phone: form.phone.trim(),
            specialties: finalSpecialties,
        });

        // Reset local (no cerramos automáticamente: lo decide el parent)
        setForm({ name: "", address: "", phone: "", specialties: "" });
        setSpecInput("");
        setNewSpecs([]);
    };

    const canShowAddSpecBtn =
        (specInput || form.specialties).trim().length > 0;

    return (
        <div className="mt-4 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm">
            {/* Top bar minimal */}
            <div className="flex items-center justify-between px-5 py-3">
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900">
                        {t(
                            "pages.hospitals.adminPage.form.newHospitalTitle",
                            "Nuevo hospital",
                        )}
                    </h3>
                    <p className="text-xs text-slate-500">
                        {t(
                            "pages.hospitals.adminPage.form.subtitle",
                            "Completa los datos básicos y añade especialidades.",
                        )}
                    </p>
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label={t("common.close", "Cerrar")}
                    title={t("common.close", "Cerrar") as string}
                >
                    ✕
                </button>
            </div>

            <div className="h-px bg-slate-200" />

            {/* Body */}
            <form onSubmit={handleSubmit} className="px-5 py-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
                    {/* Columna izquierda: datos */}
                    <div className="space-y-3">
                        <div>
                            <label className="block text-[11px] font-medium text-slate-600">
                                {t("pages.hospitals.adminPage.form.nameLabel", "Nombre")}
                            </label>
                            <input
                                type="text"
                                placeholder={t("pages.hospitals.adminPage.form.name") as string}
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"

                                required
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-medium text-slate-600">
                                {t("pages.hospitals.adminPage.form.addressLabel", "Dirección")}
                            </label>
                            <input
                                type="text"
                                placeholder={t("pages.hospitals.adminPage.form.address") as string}
                                value={form.address}
                                onChange={(e) => setForm({ ...form, address: e.target.value })}
                                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"

                                required
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-medium text-slate-600">
                                {t("pages.hospitals.adminPage.form.phoneLabel", "Teléfono")}
                            </label>
                            <input
                                type="text"
                                placeholder={t("pages.hospitals.adminPage.form.phone") as string}
                                value={form.phone}
                                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"

                                required
                            />
                        </div>
                    </div>

                    {/* Columna derecha: especialidades */}
                    <div className="space-y-3">
                        <div>
                            <label className="block text-[11px] font-medium text-slate-600">
                                {t(
                                    "pages.hospitals.adminPage.form.specialtiesLabel",
                                    "Especialidades",
                                )}
                            </label>

                            <div className="mt-1 flex items-center gap-2">
                                <input
                                    type="text"
                                    placeholder={
                                        t("pages.hospitals.adminPage.form.specialties") as string
                                    }
                                    list="specialties"
                                    value={specInput || form.specialties}
                                    onChange={(e) => {
                                        setSpecInput(e.target.value);
                                        setForm({ ...form, specialties: e.target.value });
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === ",") {
                                            e.preventDefault();
                                            addSpec();
                                        }
                                        if (
                                            e.key === "Backspace" &&
                                            (specInput || form.specialties).length === 0 &&
                                            newSpecs.length
                                        ) {
                                            removeSpec(newSpecs[newSpecs.length - 1]);
                                        }
                                    }}
                                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"

                                />

                                {canShowAddSpecBtn && (
                                    <button
                                        type="button"
                                        onClick={addSpec}
                                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-sm text-slate-700 shadow-sm hover:bg-slate-50"

                                        title={
                                            t(
                                                "pages.hospitals.adminPage.form.addSpecialtyBtn",
                                                "Añadir especialidad",
                                            ) as string
                                        }
                                        aria-label={
                                            t(
                                                "pages.hospitals.adminPage.form.addSpecialtyBtn",
                                                "Añadir especialidad",
                                            ) as string
                                        }
                                    >
                                        ⤴
                                    </button>
                                )}
                            </div>

                            <datalist id="specialties">
                                {specialties.map((spec) => (
                                    <option key={spec} value={spec} />
                                ))}
                            </datalist>

                            {/* Chips: se listan dentro de ESTA columna */}
                            <div className="mt-2 flex flex-wrap gap-2">
                                {newSpecs.map((spec) => (
                                    <span
                                        key={spec}
                                        className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200"
                                    >
                                        {spec}
                                        <button
                                            type="button"
                                            onClick={() => removeSpec(spec)}
                                            className="rounded-full px-1 text-slate-500 hover:bg-slate-200"
                                            aria-label={t("common.remove", "Quitar")}
                                            title={t("common.remove", "Quitar") as string}
                                        >
                                            ✕
                                        </button>
                                    </span>
                                ))}

                                {newSpecs.length === 0 && (
                                    <span className="text-[11px] text-slate-500">
                                        {t(
                                            "pages.hospitals.adminPage.form.noSpecialtiesYet",
                                            "Sin especialidades añadidas",
                                        )}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer minimal */}
                <div className="mt-4 flex items-center justify-end gap-2">
                    <CancelButton onClick={onClose}>
                        {t("common.cancel", "Cancelar")}
                    </CancelButton>



                    {/* Usa tu botón reutilizable */}
                    <SaveIconButton type="submit">
                        {t("pages.hospitals.adminPage.actions.saveHospital")}
                    </SaveIconButton>
                </div>
            </form>
        </div>
    );



};

export default HospitalCreateForm;
