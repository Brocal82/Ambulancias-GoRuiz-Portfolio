// frontend/src/utils/fileName.ts

// Extrae el último segmento de la URL (nombre de archivo) y lo decodifica
export const fileNameFromUrl = (url: string) =>
  decodeURIComponent(url.split('/').pop() || url);

// Limpia sufijos típicos añadidos por el servidor (timestamps/hashes) antes de la extensión
export const prettyFileName = (name: string) => {
  const dot = name.lastIndexOf('.');
  if (dot === -1) return name;

  const base = name.slice(0, dot);
  const ext = name.slice(dot);

  const parts = base.split('-');
  if (parts.length <= 1) return name;

  const isNoise = (seg: string) =>
    /^[0-9]{6,}$/.test(seg) || /^[a-f0-9]{8,}$/i.test(seg);

  // Elimina tokens “ruido” al final: timestamps/hashes largos
  while (parts.length > 1 && isNoise(parts[parts.length - 1])) {
    parts.pop();
  }
  return parts.join('-') + ext;
};

// Composición lista para usar directamente desde una URL
export const displayFileNameFromUrl = (url: string) =>
  prettyFileName(fileNameFromUrl(url));
