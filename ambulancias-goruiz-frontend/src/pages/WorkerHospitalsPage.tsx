//src/pages/WorkerHospitalsPage.tsx
import { useEffect, useState, useMemo } from "react";
import type { Hospital } from "../types/hospital";
import HospitalDetailsModal from "../components/hospitals/HospitalDetailsModal";
import { useAuth } from "../hooks/useAuth";
import { useTranslation } from "react-i18next";
import { toastT } from "../utils/toast";

import HospitalsFilters from "../components/hospitals/HospitalsFilters";
import HospitalsList from "../components/hospitals/HospitalsList";
import {
  filterAndSortHospitals,
  getUniqueSpecialties,
} from "../utils/hospitals/hospitalsFilters";
import { fetchHospitals } from "../utils/hospitals/fetchHospitals";

const WorkerHospitalsPage = () => {
  const { token } = useAuth();
  const { t } = useTranslation();

  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(
    null,
  );

  // Igual que Admin
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

  // 🔹 useMemo: especialidades únicas
  const specialties = useMemo(() => getUniqueSpecialties(hospitals), [hospitals]);

  // 🔹 useMemo: filtrado + ordenado
  const sortedHospitals = useMemo(
    () => filterAndSortHospitals(hospitals, selectedSpecialty, searchName),
    [hospitals, selectedSpecialty, searchName],
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-center mb-6">
        {t("pages.hospitals.workerPage.title")}
      </h1>

      <HospitalsFilters
        specialties={specialties}
        selectedSpecialty={selectedSpecialty}
        onChangeSelectedSpecialty={setSelectedSpecialty}
        searchName={searchName}
        onChangeSearchName={setSearchName}
        hideRightAction
      />

      <HospitalsList
        hospitals={sortedHospitals}
        mode="worker"
        onOpenDetails={(hospital) => setSelectedHospital(hospital)}
      />

      {selectedHospital && (
        <HospitalDetailsModal
          hospital={selectedHospital}
          onClose={() => setSelectedHospital(null)}
        />
      )}
    </div>
  );
};

export default WorkerHospitalsPage;
