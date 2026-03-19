// src/modules/hospitals/pages/AdminHospitalsPage.tsx
import { useEffect, useMemo, useState } from "react";
import type { Hospital } from "../domain/types";
import * as hospitalsApi from "../domain/api";
import { fetchHospitals } from "../domain/fetch";
import * as hospitalsComponents from "../components";
import {
  buildCreateHospitalPayload,
  buildUpdateHospitalPayload,
} from "../utils/payload";
import { filterAndSortHospitals, getUniqueSpecialties } from "../utils/hospitalsFilters";
import {
  fromLocalHospitalStatus,
  getHospitalIsOpen,
} from "../utils/status";

import { useAuth } from "../../../hooks/useAuth";
import { toastT } from "../../../utils/toast";
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

  // 1) Fetch hospitales
  useEffect(() => {
    const loadHospitals = async () => {
      try {
        if (!token) return;

        const data = await fetchHospitals(token);
        setHospitals(data);
      } catch (error) {
        console.error(error);
        toastT.error(["toasts.hospitals.loadError"]);
      }
    };

    loadHospitals();
  }, [token]);

  // 2) Especialidades únicas (memo para evitar recalcular cada render)
  const specialties = useMemo(
    () => getUniqueSpecialties(hospitals),
    [hospitals],
  );

  // 3) Lista filtrada + ordenada (memo)
  const sortedHospitals = useMemo(
    () =>
      filterAndSortHospitals(
        hospitals,
        selectedSpecialty,
        searchName,
      ),
    [hospitals, selectedSpecialty, searchName],
  );

  // 4) Toggle abierto/cerrado
  const handleToggleOpen = async (hospital: Hospital) => {
    try {
      if (!token) return;

      const currentIsOpen = getHospitalIsOpen(hospital);
      const nextIsOpen = !(currentIsOpen === true);

      const updated = await hospitalsApi.updateHospital(
        hospital._id,
        fromLocalHospitalStatus(hospital, nextIsOpen),
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

  // 5) Delete
  const handleDeleteHospital = async (id: string) => {
    if (!token) return;

    const ok = confirm(t("pages.hospitals.adminPage.confirm.delete") as string);
    if (!ok) return;

    try {
      await hospitalsApi.deleteHospital(id);
      setHospitals((prev) => prev.filter((h) => h._id !== id));
      toastT.success(["toasts.hospitals.deleteSuccess"]);
    } catch (error) {
      console.error(error);
      toastT.error(["toasts.hospitals.deleteError"]);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-center mb-6">
        {t("pages.hospitals.adminPage.title")}
      </h1>

      {/* Filtros reutilizables */}
      <hospitalsComponents.HospitalsFilters
        specialties={specialties}
        selectedSpecialty={selectedSpecialty}
        onChangeSelectedSpecialty={setSelectedSpecialty}
        searchName={searchName}
        onChangeSearchName={setSearchName}
        rightActionLabel={
          t("pages.hospitals.adminPage.actions.toggleFormOpen") as string
        }
        onRightActionClick={() => setShowForm(true)}
        hideRightAction={showForm}
      />

      {/* Formulario (extraído a componente) */}
      {showForm && (
        <hospitalsComponents.HospitalCreateForm
          specialties={specialties}
          onClose={() => setShowForm(false)}
          onSubmit={async (data) => {
            if (!token) return;

            try {
              const newHospital = await hospitalsApi.createHospital(
                buildCreateHospitalPayload(data),
              );

              setHospitals((prev) => [...prev, newHospital]);
              toastT.success(["toasts.hospitals.addSuccess"]);
              setShowForm(false);
            } catch (error) {
              console.error(error);
              toastT.error(["toasts.hospitals.addError"]);
            }
          }}
        />
      )}

      {/* Listado reutilizable */}
      <hospitalsComponents.HospitalsList
        hospitals={sortedHospitals}
        mode="admin"
        onOpenDetails={(hospital) => setSelectedHospital(hospital)}
        onToggleOpen={handleToggleOpen}
        onEdit={(hospital) => setEditingHospital(hospital)}
        onDelete={handleDeleteHospital}
      />

      {/* Modales */}
      {editingHospital && (
        <hospitalsComponents.HospitalEditModal
          hospital={editingHospital}
          allSpecialties={specialties}
          onClose={() => setEditingHospital(null)}
          onUpdated={async (updated) => {
            if (!token) return;

            try {
              const payload = buildUpdateHospitalPayload(
                editingHospital,
                updated,
              );

              const saved = await hospitalsApi.updateHospital(
                updated._id,
                payload,
              );

              setHospitals((prev) =>
                prev.map((h) => (h._id === saved._id ? saved : h)),
              );

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
        <hospitalsComponents.HospitalDetailsModal
          hospital={selectedHospital}
          onClose={() => setSelectedHospital(null)}
        />
      )}
    </div>
  );
};

export default AdminHospitalsPage;
