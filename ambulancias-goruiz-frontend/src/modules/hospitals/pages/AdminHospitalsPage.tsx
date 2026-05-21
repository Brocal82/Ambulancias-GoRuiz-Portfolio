// src/modules/hospitals/pages/AdminHospitalsPage.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { emitHospitalStatusChanged } from "../utils/hospitalEvents";
import { useHospitalStatusChanged } from "../hooks/useHospitalStatusChanged";

import { useAuth } from "../../../hooks/useAuth";
import { toastT } from "../../../utils/toast";
import { useTranslation } from "react-i18next";
import axios from "axios";

const AdminHospitalsPage = () => {
  const { token } = useAuth();
  const { t } = useTranslation();

  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingHospitalId, setPendingHospitalId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingHospital, setEditingHospital] = useState<Hospital | null>(null);
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(
    null,
  );

  const [selectedSpecialty, setSelectedSpecialty] = useState<string>("all");
  const [searchName, setSearchName] = useState<string>("");
  const [showForm, setShowForm] = useState(false);

  const loadHospitals = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const data = await fetchHospitals(token);
      setHospitals(data);
    } catch (error) {
      console.error(error);
      toastT.apiError(error, ["toasts.hospitals.loadError"]);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const loadHospitalsRef = useRef(loadHospitals);
  loadHospitalsRef.current = loadHospitals;

  useHospitalStatusChanged(() => void loadHospitalsRef.current?.());

  useEffect(() => {
    void loadHospitals();
  }, [loadHospitals]);

  const specialties = useMemo(
    () => getUniqueSpecialties(hospitals),
    [hospitals],
  );

  const sortedHospitals = useMemo(
    () =>
      filterAndSortHospitals(
        hospitals,
        selectedSpecialty,
        searchName,
      ),
    [hospitals, selectedSpecialty, searchName],
  );

  const hasActiveFilters =
    selectedSpecialty !== "all" || searchName.trim().length > 0;

  const emptyMessage = hasActiveFilters
    ? (t("pages.hospitals.adminPage.empty") as string)
    : undefined;

  const handleToggleOpen = async (hospital: Hospital) => {
    if (pendingHospitalId) return;
    try {
      if (!token) return;

      setPendingHospitalId(hospital._id);
      const currentIsOpen = getHospitalIsOpen(hospital);
      const nextIsOpen = !(currentIsOpen === true);

      const updated = await hospitalsApi.updateHospital(
        hospital._id,
        fromLocalHospitalStatus(hospital, nextIsOpen),
      );

      setHospitals((prev) =>
        prev.map((h) => (h._id === updated._id ? updated : h)),
      );
      emitHospitalStatusChanged();
      toastT.success(["toasts.hospitals.stateUpdated"]);
    } catch (error) {
      console.error(error);
      toastT.apiError(error, ["toasts.hospitals.stateUpdateError"]);
    } finally {
      setPendingHospitalId(null);
    }
  };

  const handleDeleteHospital = async (id: string) => {
    if (!token || pendingHospitalId) return;

    const ok = confirm(t("pages.hospitals.adminPage.confirm.delete") as string);
    if (!ok) return;

    try {
      setPendingHospitalId(id);
      await hospitalsApi.deleteHospital(id);
      setHospitals((prev) => prev.filter((h) => h._id !== id));
      toastT.success(["toasts.hospitals.deleteSuccess"]);
    } catch (error) {
      console.error(error);
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      toastT.apiError(
        error,
        status === 409
          ? ["toasts.hospitals.deleteInUse"]
          : ["toasts.hospitals.deleteError"],
      );
    } finally {
      setPendingHospitalId(null);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-center mb-6">
        {t("pages.hospitals.adminPage.title")}
      </h1>

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
        hideRightAction={showForm || isCreating}
      />

      {showForm && (
        <hospitalsComponents.HospitalCreateForm
          specialties={specialties}
          isSubmitting={isCreating}
          onClose={() => !isCreating && setShowForm(false)}
          onSubmit={async (data) => {
            if (!token || isCreating) return;

            try {
              setIsCreating(true);
              const newHospital = await hospitalsApi.createHospital(
                buildCreateHospitalPayload(data),
              );

              setHospitals((prev) => [...prev, newHospital]);
              toastT.success(["toasts.hospitals.addSuccess"]);
              setShowForm(false);
            } catch (error) {
              console.error(error);
              toastT.apiError(error, ["toasts.hospitals.addError"]);
            } finally {
              setIsCreating(false);
            }
          }}
        />
      )}

      <hospitalsComponents.HospitalsList
        hospitals={sortedHospitals}
        mode="admin"
        isLoading={isLoading}
        emptyMessage={emptyMessage}
        pendingHospitalId={pendingHospitalId}
        onOpenDetails={(hospital) => setSelectedHospital(hospital)}
        onToggleOpen={handleToggleOpen}
        onEdit={(hospital) => !pendingHospitalId && setEditingHospital(hospital)}
        onDelete={handleDeleteHospital}
      />

      {editingHospital && (
        <hospitalsComponents.HospitalEditModal
          hospital={editingHospital}
          allSpecialties={specialties}
          isSubmitting={pendingHospitalId === editingHospital._id}
          onClose={() =>
            pendingHospitalId !== editingHospital._id && setEditingHospital(null)
          }
          onUpdated={async (updated) => {
            if (!token || pendingHospitalId) return;

            try {
              setPendingHospitalId(updated._id);
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
              if (
                typeof updated.isOpen === "boolean" &&
                updated.isOpen !== getHospitalIsOpen(editingHospital)
              ) {
                emitHospitalStatusChanged();
              }
              setEditingHospital(null);
              toastT.success(["toasts.hospitals.updateOk"]);
            } catch (error) {
              console.error("❌ Error al actualizar hospital:", error);
              toastT.apiError(error, ["toasts.hospitals.updateErr"]);
            } finally {
              setPendingHospitalId(null);
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
