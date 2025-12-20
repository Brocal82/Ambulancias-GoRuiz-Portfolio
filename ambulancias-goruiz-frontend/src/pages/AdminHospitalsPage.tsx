import { useEffect, useState } from "react";
import {
  getAllHospitals,
  updateHospital,
  createHospital,
  deleteHospital,
} from "../api/hospitals";
import type { Hospital } from "../types/hospital";
import { useAuth } from "../hooks/useAuth";
import { toastT } from "../utils/toast";
import { filterAndSortHospitals, getUniqueSpecialties } from "../utils/hospitals/hospitalsFilters";
import HospitalsFilters from "../components/hospitals/HospitalsFilters";
import HospitalsList from "../components/hospitals/HospitalsList";

import HospitalEditModal from "../components/hospitals/HospitalEditModal";
import HospitalDetailsModal from "../components/hospitals/HospitalDetailsModal";
import { useTranslation } from "react-i18next";

const AdminHospitalsPage = () => {
  const { token } = useAuth();
  const { t } = useTranslation();

  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [editingHospital, setEditingHospital] = useState<Hospital | null>(null);
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(
    null,
  );
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>("all");
  const [searchName, setSearchName] = useState<string>("");
  const [showForm, setShowForm] = useState(false);

  // Form original
  const [form, setForm] = useState({
    name: "",
    address: "",
    phone: "",
    specialties: "",
  });

  // Creación: chips de especialidades
  const [specInput, setSpecInput] = useState<string>("");
  const [newSpecs, setNewSpecs] = useState<string[]>([]);

  useEffect(() => {
    const fetchHospitals = async () => {
      try {
        if (!token) return;
        const data = await getAllHospitals(token);
        setHospitals(data);
      } catch (error) {
        console.error(error);
        toastT.error(["toasts.hospitals.loadError"]);
      }
    };
    fetchHospitals();
  }, [token, t]);

  const handleToggleOpen = async (hospital: Hospital) => {
    try {
      if (!token) return;
      const updated = await updateHospital(
        hospital._id,
        { isOpen: !hospital.isOpen },
        token,
      );
      setHospitals((prev) =>
        prev.map((h) => (h._id === updated._id ? updated : h)),
      );
      toastT.success(["toasts.hospitals.stateUpdated"]);
    } catch (error) {
      console.error(error);
      toastT.error(["toasts.hospitals.stateUpdateError"]);
    }
  };

  // Helpers chips
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

  const handleAddHospital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      const tail = form.specialties
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const combinedSet = new Set<string>([...newSpecs, ...tail]);
      const finalSpecialties = Array.from(combinedSet);

      const newHospital = await createHospital(
        {
          name: form.name,
          address: form.address,
          phone: form.phone,
          specialties: finalSpecialties,
          isOpen: true,
        },
        token,
      );
      setHospitals((prev) => [...prev, newHospital]);
      toastT.success(["toasts.hospitals.addSuccess"]);
      setForm({ name: "", address: "", phone: "", specialties: "" });
      setSpecInput("");
      setNewSpecs([]);
      setShowForm(false);
    } catch (error) {
      console.error(error);
      toastT.error(["toasts.hospitals.addError"]);
    }
  };

  const handleDeleteHospital = async (id: string) => {
    if (!token) return;
    if (!confirm(t("pages.hospitals.adminPage.confirm.delete") as string))
      return;
    try {
      await deleteHospital(id, token);
      setHospitals((prev) => prev.filter((h) => h._id !== id));
      toastT.success(["toasts.hospitals.deleteSuccess"]);
    } catch (error) {
      console.error(error);
      toastT.error(["toasts.hospitals.deleteError"]);
    }
  };

  const specialties = getUniqueSpecialties(hospitals);


  const sortedHospitals = filterAndSortHospitals(
    hospitals,
    selectedSpecialty,
    searchName,
  );


  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-center mb-6">
        {t("pages.hospitals.adminPage.title")}
      </h1>

      <HospitalsFilters
        specialties={specialties}
        selectedSpecialty={selectedSpecialty}
        onChangeSelectedSpecialty={setSelectedSpecialty}
        searchName={searchName}
        onChangeSearchName={setSearchName}
        rightActionLabel={
          showForm
            ? (t("pages.hospitals.adminPage.actions.toggleFormClose") as string)
            : (t("pages.hospitals.adminPage.actions.toggleFormOpen") as string)
        }
        onRightActionClick={() => setShowForm(!showForm)}
      />


      {/* Formulario nuevo hospital */}
      {showForm && (
        <div className="mt-4 rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm">
          {/* Header del formulario */}
          <div className="flex items-center justify-between px-5 md:px-6 py-3 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 ring-1 ring-blue-100">
                <span aria-hidden>🏥</span>
              </div>
              <h3 className="text-sm md:text-base font-bold text-slate-900">
                {t(
                  "pages.hospitals.adminPage.form.newHospitalTitle",
                  "Nuevo hospital",
                )}
              </h3>
            </div>
          </div>

          {/* Body del formulario */}
          <form onSubmit={handleAddHospital} className="px-5 md:px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Columna izquierda: Nombre, Dirección, Teléfono */}
              <div className="space-y-3">
                <div>
                  <label className="block text-slate-600 text-[11px] uppercase tracking-wide mb-1">
                    {t("pages.hospitals.adminPage.form.nameLabel", "Nombre")}
                  </label>
                  <input
                    type="text"
                    placeholder={
                      t("pages.hospitals.adminPage.form.name") as string
                    }
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-600 text-[11px] uppercase tracking-wide mb-1">
                    {t(
                      "pages.hospitals.adminPage.form.addressLabel",
                      "Dirección",
                    )}
                  </label>
                  <input
                    type="text"
                    placeholder={
                      t("pages.hospitals.adminPage.form.address") as string
                    }
                    value={form.address}
                    onChange={(e) =>
                      setForm({ ...form, address: e.target.value })
                    }
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
                    placeholder={
                      t("pages.hospitals.adminPage.form.phone") as string
                    }
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    required
                  />
                </div>
              </div>

              {/* Columna derecha: Especialidades (con chips) */}
              <div className="space-y-3 md:border-l md:pl-5 border-slate-200">
                <div>
                  <label className="block text-slate-600 text-[11px] uppercase tracking-wide mb-1">
                    {t(
                      "pages.hospitals.adminPage.form.specialtiesLabel",
                      "Especialidades",
                    )}
                  </label>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder={
                        t(
                          "pages.hospitals.adminPage.form.specialties",
                        ) as string
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

                  {/* Chips debajo */}
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

            {/* Footer del formulario */}
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
      )}

      {/* Listado (COMPACTO + ORDENADO) */}
      <HospitalsList
        hospitals={sortedHospitals}
        mode="admin"
        onOpenDetails={(hospital) => setSelectedHospital(hospital)}
        onToggleOpen={handleToggleOpen}
        onEdit={(hospital) => setEditingHospital(hospital)}
        onDelete={handleDeleteHospital}
      />


      {/* Modales */}
      {editingHospital && (
        <HospitalEditModal
          hospital={editingHospital}
          allSpecialties={specialties}
          onClose={() => setEditingHospital(null)}
          onUpdated={async (updated) => {
            if (!token) return;

            try {
              // Construimos un payload seguro (solo campos editables)
              const payload: Partial<Hospital> = {
                name: updated.name?.trim(),
                address: updated.address?.trim(),
                phone: (updated.phone ?? "").trim(),
                specialties: Array.isArray(updated.specialties)
                  ? updated.specialties
                  : [],
                // si tu modelo usa isOpen (boolean), lo pasamos cuando venga
                ...(typeof (updated as any).isOpen === "boolean"
                  ? { isOpen: (updated as any).isOpen }
                  : {}),
                // si tu modelo usa status ("open"/"closed"), lo pasamos cuando venga
                ...(typeof (updated as any).status === "string"
                  ? { status: (updated as any).status }
                  : {}),
              };

              // Llamada real al backend
              const saved = await updateHospital(updated._id, payload, token);

              // Actualiza estado con lo que devuelve el backend
              setHospitals((prev) =>
                prev.map((h) => (h._id === saved._id ? saved : h)),
              );

              // Cierra modal y avisa
              setEditingHospital(null);
              toastT.success(["toasts.hospitals.updateOk"]);
            } catch (error) {
              console.error("❌ Error al actualizar hospital:", error);
              toastT.error(["toasts.hospitals.updateErr"]);
            }
          }}
        />
      )}

      {selectedHospital && (
        <HospitalDetailsModal
          hospital={selectedHospital}
          onClose={() => setSelectedHospital(null)}
        />
      )}
    </div>
  );
};

export default AdminHospitalsPage;
