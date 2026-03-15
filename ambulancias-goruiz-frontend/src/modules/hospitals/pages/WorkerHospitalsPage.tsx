// src/modules/hospitals/pages/WorkerHospitalsPage.tsx
import { useEffect, useMemo, useState } from "react";
import type { Hospital } from "../domain/types";
import { fetchHospitals } from "../domain/fetch";
import * as hospitalsComponents from "../components";
import { filterAndSortHospitals, getUniqueSpecialties } from "../utils/hospitalsFilters";

import { useAuth } from "../../../hooks/useAuth";
import { useTranslation } from "react-i18next";
import { toastT } from "../../../utils/toast";

const WorkerHospitalsPage = () => {
  const { token } = useAuth();
  const { t } = useTranslation();

  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(
    null,
  );

  const [selectedSpecialty, setSelectedSpecialty] = useState<string>("all");
  const [searchName, setSearchName] = useState<string>("");

  useEffect(() => {
    const loadHospitals = async () => {
      try {
        if (!token) return;

        const data = await fetchHospitals(token);
        setHospitals(data);
      } catch (error) {
        console.error("Error al cargar hospitales:", error);
        toastT.error(["toasts.hospitals.loadError"]);
      }
    };

    loadHospitals();
  }, [token]);

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

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-center mb-6">
        {t("pages.hospitals.workerPage.title")}
      </h1>

      <hospitalsComponents.HospitalsFilters
        specialties={specialties}
        selectedSpecialty={selectedSpecialty}
        onChangeSelectedSpecialty={setSelectedSpecialty}
        searchName={searchName}
        onChangeSearchName={setSearchName}
        hideRightAction
      />

      <hospitalsComponents.HospitalsList
        hospitals={sortedHospitals}
        mode="worker"
        onOpenDetails={(hospital) => setSelectedHospital(hospital)}
      />

      {selectedHospital && (
        <hospitalsComponents.HospitalDetailsModal
          hospital={selectedHospital}
          onClose={() => setSelectedHospital(null)}
        />
      )}
    </div>
  );
};

export default WorkerHospitalsPage;
