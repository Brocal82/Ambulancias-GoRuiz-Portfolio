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

  // Si ya viene como string (id o número)
  if (typeof a === "string") return a || "—";

  if (typeof a === "object") {
    const anyA = a as any;

    const n = anyA?.ambulanceNumber;
    if (typeof n === "string" && n.trim()) return n;
    if (typeof n === "number") return String(n);

    // fallback común si viene poblado pero sin número
    if (typeof anyA?._id === "string") return "—";
  }

  return "—";
};

