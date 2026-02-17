import { useEffect, useState } from "react";
import { toastT } from "../../../utils/toast";

export interface AmbulanceRef {
  _id: string;
  ambulanceNumber: string;
}

export const useAmbulances = (params: {
  token: string | null | undefined;
}) => {
  const { token } = params;

  const [ambulances, setAmbulances] = useState<AmbulanceRef[]>([]);

  useEffect(() => {
    const fetchAmbulances = async () => {
      if (!token) return;

      try {
        const response = await fetch("/api/ambulances", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        setAmbulances(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("❌ Error al cargar ambulancias:", error);
        toastT.error(["toasts.assignments.loadAmbulancesError"]);
      }
    };

    fetchAmbulances();
  }, [token]);

  return { ambulances };
};
