import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../../../hooks/useAuth";
import { getAllAmbulances } from "../../ambulances/domain/api";
import type { Team } from "../domain";
import type { TeamPickerValue } from "../components/TeamPicker";

type RotationMode = "rotating" | "fixed" | "none";

export type AmbulanceLite = {
  _id: string;
  ambulanceNumber: string;
};

type UseTeamFormArgs = {
  isOpen: boolean;
  team?: Team | null;
};

type UseTeamFormReturn = {
  value: TeamPickerValue;
  setValue: React.Dispatch<React.SetStateAction<TeamPickerValue>>;

  rotationMode: RotationMode;
  setRotationMode: React.Dispatch<React.SetStateAction<RotationMode>>;

  fixedDienstNumber: number | "";
  setFixedDienstNumber: React.Dispatch<React.SetStateAction<number | "">>;

  ambulanceId: string;
  setAmbulanceId: React.Dispatch<React.SetStateAction<string>>;

  ambulances: AmbulanceLite[];
  loadingAmbulances: boolean;

  submitting: boolean;
  setSubmitting: React.Dispatch<React.SetStateAction<boolean>>;

  samePerson: boolean;
  isFixed: boolean;
  fixedValid: boolean;
};

const getInitialValue = (team?: Team | null): TeamPickerValue => ({
  driver: team?.driver?._id || "",
  medic: team?.medic?._id || "",
});

const getInitialRotationMode = (team?: Team | null): RotationMode =>
  team?.rotationMode ?? "rotating";

const getInitialFixedDienstNumber = (team?: Team | null): number | "" =>
  team?.rotationMode === "fixed" && team.fixedDienstNumber != null
    ? team.fixedDienstNumber
    : "";

const getInitialAmbulanceId = (team?: Team | null): string =>
  (team?.ambulanceId as { _id?: string } | null | undefined)?._id || "";

export function useTeamForm({
  isOpen,
  team = null,
}: UseTeamFormArgs): UseTeamFormReturn {
  const { token } = useAuth();

  const [value, setValue] = useState<TeamPickerValue>(() => getInitialValue(team));
  const [rotationMode, setRotationMode] = useState<RotationMode>(() =>
    getInitialRotationMode(team),
  );
  const [fixedDienstNumber, setFixedDienstNumber] = useState<number | "">(() =>
    getInitialFixedDienstNumber(team),
  );
  const [ambulanceId, setAmbulanceId] = useState<string>(() =>
    getInitialAmbulanceId(team),
  );

  const [ambulances, setAmbulances] = useState<AmbulanceLite[]>([]);
  const [loadingAmbulances, setLoadingAmbulances] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setValue(getInitialValue(team));
    setRotationMode(getInitialRotationMode(team));
    setFixedDienstNumber(getInitialFixedDienstNumber(team));
    setAmbulanceId(getInitialAmbulanceId(team));
  }, [team]);

  useEffect(() => {
    if (!isOpen || !token) return;

    let cancelled = false;

    (async () => {
      try {
        setLoadingAmbulances(true);

        const data = (await getAllAmbulances()) as AmbulanceLite[];

        if (!cancelled) {
          setAmbulances(
            Array.isArray(data)
              ? data.sort((a, b) =>
                  (a.ambulanceNumber || "").localeCompare(
                    b.ambulanceNumber || "",
                    "es",
                  ),
                )
              : [],
          );
        }
      } catch (e) {
        console.error("Error al cargar ambulancias en useTeamForm:", e);
      } finally {
        if (!cancelled) {
          setLoadingAmbulances(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, token]);

  const samePerson = useMemo(
    () => !!value.driver && value.driver === value.medic,
    [value.driver, value.medic],
  );

  const isFixed = rotationMode === "fixed";

  const fixedValid = useMemo(
    () => !isFixed || (fixedDienstNumber !== "" && Number(fixedDienstNumber) > 0),
    [isFixed, fixedDienstNumber],
  );

  return {
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
  };
}
