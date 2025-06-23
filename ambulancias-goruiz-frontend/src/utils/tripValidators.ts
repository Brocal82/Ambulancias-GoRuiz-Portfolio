/* ─────────────────────────────────────────────────────────
   Helpers de validación lógica para un “trip”
   (orden de horas y coherencia de kilómetros)
───────────────────────────────────────────────────────────*/

export const parseHHMM = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;  // minutos totales
};

/** Devuelve un string con el error encontrado
 *  o null si todo está correcto. */
export const checkTripLogic = (v: {
  timeWarning: string;
  timeAtHome:  string;
  timePickup:  string;
  timeArrival: string;
  timeEnd:     string;
  kmStart:     number;
  kmEnd:       number;
}) => {
  /* 1️⃣ Orden de horas */
  const times = [
    { label: "hora de AVISO",   value: v.timeWarning },
    { label: "hora DOMICILIO",  value: v.timeAtHome },
    { label: "hora CARGA",      value: v.timePickup },
    { label: "hora DESTINO",    value: v.timeArrival },
    { label: "hora LIBRE",      value: v.timeEnd },
  ];

  for (let i = 0; i < times.length - 1; i++) {
    if (parseHHMM(times[i].value) > parseHHMM(times[i + 1].value)) {
      return `❌ La ${times[i].label} no puede ser posterior a la ${times[i + 1].label}`;
    }
  }

  /* 2️⃣ Orden de kilómetros */
  if (v.kmStart > v.kmEnd) {
    return "❌ Los KM de recogida no pueden ser mayores que los KM de destino";
  }

  return null; // sin errores
};
