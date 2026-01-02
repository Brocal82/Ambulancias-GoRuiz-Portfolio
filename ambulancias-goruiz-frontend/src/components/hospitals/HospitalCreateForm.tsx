import { useState } from "react";
import { useTranslation } from "react-i18next";

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

    return (
        <div className="mt-4 rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm">
            {/* Header del formulario */}
            <div className="flex items-center justify-between px-5 md:px-6 py-3 border-b border-slate-200">
                <div className="flex items-center gap-3">
                    <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 ring-1 ring-blue-100">
                        <span aria-hidden>🏥</span>
                    </div>
                    <h3 className="text-sm md:text-base font-bold text-slate-900">
                        {t("pages.hospitals.adminPage.form.newHospitalTitle", "Nuevo hospital")}
                    </h3>
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

            {/* Body del formulario */}
            <form onSubmit={handleSubmit} className="px-5 md:px-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Columna izquierda: Nombre, Dirección, Teléfono */}
                    <div className="space-y-3">
                        <div>
                            <label className="block text-slate-600 text-[11px] uppercase tracking-wide mb-1">
                                {t("pages.hospitals.adminPage.form.nameLabel", "Nombre")}
                            </label>
                            <input
                                type="text"
                                placeholder={t("pages.hospitals.adminPage.form.name") as string}
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-slate-600 text-[11px] uppercase tracking-wide mb-1">
                                {t("pages.hospitals.adminPage.form.addressLabel", "Dirección")}
                            </label>
                            <input
                                type="text"
                                placeholder={t("pages.hospitals.adminPage.form.address") as string}
                                value={form.address}
                                onChange={(e) => setForm({ ...form, address: e.target.value })}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-slate-600 text-[11px] uppercase tracking-wide mb-1">
                                {t("pages.hospitals.adminPage.form.phoneLabel", "Teléfono")}
                            </label>
                            <input
                                type="text"
                                placeholder={t("pages.hospitals.adminPage.form.phone") as string}
                                value={form.phone}
                                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                required
                            />
                        </div>
                    </div>

                    {/* Columna derecha: Especialidades (chips) */}
                    <div className="space-y-3 md:border-l md:pl-5 border-slate-200">
                        <div>
                            <label className="block text-slate-600 text-[11px] uppercase tracking-wide mb-1">
                                {t("pages.hospitals.adminPage.form.specialtiesLabel", "Especialidades")}
                            </label>

                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder={t("pages.hospitals.adminPage.form.specialties") as string}
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
                                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                />

                                <button
                                    type="button"
                                    onClick={addSpec}
                                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm hover:bg-slate-50"
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
                                    {t("common.add", "Añadir")}
                                </button>
                            </div>

                            <datalist id="specialties">
                                {specialties.map((spec) => (
                                    <option key={spec} value={spec} />
                                ))}
                            </datalist>

                            {/* Chips */}
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

                {/* Footer */}
                <div className="mt-5 pt-4 border-t border-slate-200 flex items-center justify-end">
                    <button
                        type="submit"
                        className="inline-flex items-center rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white shadow hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                        {t("pages.hospitals.adminPage.actions.saveHospital")}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default HospitalCreateForm;
