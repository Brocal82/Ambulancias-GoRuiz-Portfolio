//src/utils/hospitals/hospitalsFilters.ts
import type { Hospital } from "../../types/hospital";
import { normalizeText } from "../textUtils";

export const getUniqueSpecialties = (hospitals: Hospital[]): string[] => {
  const specialtiesSet = new Map<string, string>();

  hospitals.forEach((h) => {
    (h.specialties ?? []).forEach((spec) => {
      const normalized = normalizeText(spec);
      if (!specialtiesSet.has(normalized)) specialtiesSet.set(normalized, spec);
    });
  });

  return Array.from(specialtiesSet.values());
};

export const filterAndSortHospitals = (
  hospitals: Hospital[],
  selectedSpecialty: string,
  searchName: string,
): Hospital[] => {
  const filtered = hospitals.filter((h) => {
    const matchesSpecialty =
      selectedSpecialty === "all" ||
      (h.specialties ?? []).some(
        (spec) => normalizeText(spec) === normalizeText(selectedSpecialty),
      );

    const matchesName = (h.name ?? "")
      .toLowerCase()
      .includes((searchName ?? "").toLowerCase());

    return matchesSpecialty && matchesName;
  });

  return [...filtered].sort((a, b) =>
    (a.name ?? "").localeCompare(b.name ?? "", undefined, {
      sensitivity: "accent",
    }),
  );
};
