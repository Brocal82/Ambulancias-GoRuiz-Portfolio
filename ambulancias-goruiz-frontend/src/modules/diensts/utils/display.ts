// frontend/src/modules/diensts/utils/display.ts

/**
 * Devuelve "Apellido, Nombre" con fallbacks seguros.
 * Acepta string, objeto con { name, lastName } o unknown.
 */
export const formatPersonLabel = (p: unknown): string => {
  if (typeof p === "string") return p || "—";

  if (p && typeof p === "object") {
    const anyP = p as any;
    const lastName = typeof anyP.lastName === "string" ? anyP.lastName : "";
    const name = typeof anyP.name === "string" ? anyP.name : "";

    const label = `${lastName}${lastName ? ", " : ""}${name}`.trim();
    return label || "—";
  }

  return "—";
};

/**
 * Devuelve número/identificador de ambulancia con fallbacks seguros.
 */
export const formatAmbulanceLabel = (a: unknown): string => {
  if (!a) return "—";
  if (typeof a === "string") return a || "—";

  if (typeof a === "object") {
    const anyA = a as any;
    const n = anyA?.ambulanceNumber;
  if (typeof n === "string" && n) return n;
  if (typeof n === "number") return String(n);

  }

  return "—";
};
