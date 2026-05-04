export type TripDraft = {
  timeWarning: string;
  timeAtHome: string;
  timePickup: string;
  timeArrival: string;
  timeEnd: string;
  kmStart: string | number;
  kmEnd: string | number;
};

export const parseHHMM = (hhmm: string): number => {
  if (!hhmm) return NaN;
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return NaN;
  return h * 60 + m;
};

export const checkTripLogic = (
  v: TripDraft,
  wasCancelled: boolean = false,
  minKmStart?: number,
): { error: string | null; badField: keyof TripDraft | null } => {
  if (wasCancelled) {
    return { error: null, badField: null };
  }

  const times: { label: string; key: keyof TripDraft }[] = [
    { label: "hora de AVISO", key: "timeWarning" },
    { label: "hora DOMICILIO", key: "timeAtHome" },
    { label: "hora CARGA", key: "timePickup" },
    { label: "hora DESTINO", key: "timeArrival" },
    { label: "hora LIBRE", key: "timeEnd" },
  ];

  for (let i = 0; i < times.length - 1; i++) {
    const rawA = String(v[times[i].key]).trim();
    const rawB = String(v[times[i + 1].key]).trim();
    /** Borrador incompleto: sin comparar hasta que ambas marcas existan (evita falsear con timeEnd vacío vs "medianoche"). */
    if (rawA === "" || rawB === "") {
      continue;
    }

    const aMin = parseHHMM(rawA);
    const bMin = parseHHMM(rawB);

    if (!isNaN(aMin) && !isNaN(bMin) && aMin > bMin) {
      return {
        error: `La ${times[i + 1].label} no puede ser anterior a la ${times[i].label}.`,
        badField: times[i + 1].key,
      };
    }
  }

  const kmStartNum = Number(v.kmStart);
  const kmEndNum = Number(v.kmEnd);

  const bothKmFieldsFilled =
    v.kmStart.toString().trim() !== "" &&
    v.kmEnd.toString().trim() !== "";

  if (
    bothKmFieldsFilled &&
    !isNaN(kmStartNum) &&
    !isNaN(kmEndNum) &&
    kmStartNum > 0 &&
    kmEndNum > 0 &&
    kmEndNum < kmStartNum
  ) {
    return {
      error: "Los KM de destino no pueden ser menores que los de recogida.",
      badField: "kmEnd",
    };
  }

  if (
    typeof minKmStart === "number" &&
    !isNaN(minKmStart) &&
    !isNaN(kmStartNum) &&
    kmStartNum > 0 &&
    kmStartNum < minKmStart
  ) {
    return {
      error: "En Anschluss, los KM no pueden ser menores que los del paciente anterior.",
      badField: "kmStart",
    };
  }

  return { error: null, badField: null };
};
