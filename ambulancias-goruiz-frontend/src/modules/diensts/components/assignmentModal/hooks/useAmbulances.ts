import { useEffect, useState } from "react";
import axios from "../../../../../api/axios";
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
        const response = await axios.get<AmbulanceRef[]>("/ambulances", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = response.data;
        setAmbulances(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("❌ Error al cargar ambulancias:", error);
        toastT.error(["toasts.assignments.loadAmbulancesError"]);
      }
    };

    fetchAmbulances();
  }, [token, skip]);

  return { ambulances };
};
