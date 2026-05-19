import { useEffect, useState } from "react";
import { getAllAmbulances } from "../../../../ambulances/domain/api";
import { toastT } from "../../../../../utils/toast";

export interface AmbulanceRef {
  _id: string;
  ambulanceNumber: string;
}

export const useAmbulances = (params: {
  token: string | null | undefined;
  /** When true, do not call the API (avoids 403 when the ambulances module is off). */
  skip?: boolean;
}) => {
  const { token, skip } = params;

  const [ambulances, setAmbulances] = useState<AmbulanceRef[]>([]);

  useEffect(() => {
    const fetchAmbulances = async () => {
      if (skip) {
        setAmbulances([]);
        return;
      }
      if (!token) return;

      try {
        const data = await getAllAmbulances();
        setAmbulances(Array.isArray(data) ? (data as AmbulanceRef[]) : []);
      } catch (error) {
        console.error("❌ Error al cargar ambulancias:", error);
        toastT.error(["toasts.assignments.loadAmbulancesError"]);
      }
    };

    fetchAmbulances();
  }, [token, skip]);

  return { ambulances };
};
