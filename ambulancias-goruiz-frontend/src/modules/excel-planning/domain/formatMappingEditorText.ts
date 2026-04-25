const INDENT = "  ";

function isJsonPrimitive(v: unknown): boolean {
  return (
    v === null ||
    typeof v === "string" ||
    typeof v === "number" ||
    typeof v === "boolean"
  );
}

/**
 * Mapeo legible: objeto con sangría, arrays de primitivos en una sola línea
 * (p. ej. dayColumns, cellLineOrder) para menos altura en el editor.
 */
export function stringifyExcelMappingForEditor(value: unknown, depth = 0): string {
  if (value === null) {
    return "null";
  }
  if (typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }
    if (value.every(isJsonPrimitive)) {
      return `[${value.map((x) => JSON.stringify(x)).join(", ")}]`;
    }
    const inner = value
      .map(
        (v) =>
          `${INDENT.repeat(depth + 1)}${stringifyExcelMappingForEditor(
            v,
            depth + 1,
          )}`,
      )
      .join(",\n");
    return `[\n${inner}\n${INDENT.repeat(depth)}]`;
  }
  const o = value as Record<string, unknown>;
  const keys = Object.keys(o);
  if (keys.length === 0) {
    return "{}";
  }
  const pad = INDENT.repeat(depth + 1);
  const lines = keys.map(
    (k) => `${pad}"${k}": ${stringifyExcelMappingForEditor(o[k], depth + 1)}`,
  );
  return `{\n${lines.join(",\n")}\n${INDENT.repeat(depth)}}`;
}
