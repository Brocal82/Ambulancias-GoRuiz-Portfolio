/* utils/tripValidators.ts
   --------------------------------------------------------------
   💡 Valida dos cosas:
      1. El orden lógico de las horas  (AVISO → DOMICILIO → …)
      2. El orden lógico de los kilómetros (kmStart ≤ kmEnd)

   ▸ Devuelve un objeto:
     {
       error:    string | null;         // Mensaje para el usuario
       badField: keyof TripDraft | null // Campo que provoca el error
     }
   -------------------------------------------------------------- */

export type TripDraft = {
  /* Horas en formato "HH:MM" ------------------------------- */
  timeWarning: string;
  timeAtHome: string;
  timePickup: string;
  timeArrival: string;
  timeEnd: string;

  /* Kilómetros (string o number — lo convertiremos) -------- */
  kmStart: string | number;
  kmEnd: string | number;
};

/* ---------------------------------------------------------- */
/* Convierte "HH:MM" → minutos desde medianoche               */
/* ---------------------------------------------------------- */
export const parseHHMM = (hhmm: string): number => {
  if (!hhmm) return NaN;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/* ---------------------------------------------------------- */
/* Validador principal                                        */
/* ---------------------------------------------------------- */
export const checkTripLogic = (
  v: TripDraft,
  wasCancelled: boolean = false // ✅ nuevo parámetro opcional
): { error: string | null; badField: keyof TripDraft | null } => {
  // ✅ Si el viaje fue cancelado, saltamos la validación
  if (wasCancelled) {
    return { error: null, badField: null };
  }

  /* 1️⃣  HORAS en orden ------------------------------------ */
  const times: { label: string; key: keyof TripDraft }[] = [
    { label: "hora de AVISO", key: "timeWarning" },
    { label: "hora DOMICILIO", key: "timeAtHome" },
    { label: "hora CARGA", key: "timePickup" },
    { label: "hora DESTINO", key: "timeArrival" },
    { label: "hora LIBRE", key: "timeEnd" },
  ];

  for (let i = 0; i < times.length - 1; i++) {
    const aMin = parseHHMM(String(v[times[i].key]));
    const bMin = parseHHMM(String(v[times[i + 1].key]));

    if (!isNaN(aMin) && !isNaN(bMin) && aMin > bMin) {
      return {
        error: `⏰ La ${times[i + 1].label} no puede ser anterior a la ${times[i].label}.`,
        badField: times[i + 1].key,
      };
    }
  }

  /* 2️⃣  KM en orden --------------------------------------- */
  const kmStartNum = Number(v.kmStart);
  const kmEndNum = Number(v.kmEnd);

  const bothKmFieldsFilled =
    v.kmStart.toString().trim() !== "" && v.kmEnd.toString().trim() !== "";

  if (
    bothKmFieldsFilled &&
    !isNaN(kmStartNum) &&
    !isNaN(kmEndNum) &&
    kmStartNum > 0 &&
    kmEndNum > 0 &&
    kmEndNum < kmStartNum
  ) {
    return {
      error: "📏 Los KM de destino no pueden ser menores que los de recogida.",
      badField: "kmEnd",
    };
  }

  /* 3️⃣  OK ------------------------------------------------- */
  return { error: null, badField: null };
};

