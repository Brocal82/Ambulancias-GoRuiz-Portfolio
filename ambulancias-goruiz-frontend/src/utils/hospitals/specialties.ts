// src/utils/hospitals/specialties.ts

/**
 * Divide una entrada tipo "Cardio, Neuro" en partes limpias.
 * - separa por coma
 * - trim
 * - elimina vacíos
 */
export const parseSpecialtiesInput = (raw: string): string[] => {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
};

/**
 * Une listas de especialidades y elimina duplicados preservando el primer valor visto.
 * (misma lógica que ya estás usando con Set en CreateForm)
 */
export const mergeUniqueSpecialties = (
  base: string[] = [],
  extra: string[] = [],
): string[] => {
  const set = new Set<string>();
  const out: string[] = [];

  for (const s of [...base, ...extra]) {
    const v = (s ?? "").trim();
    if (!v) continue;
    if (set.has(v)) continue;
    set.add(v);
    out.push(v);
  }

  return out;
};
