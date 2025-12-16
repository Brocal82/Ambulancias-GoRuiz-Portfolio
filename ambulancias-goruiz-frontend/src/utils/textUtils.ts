export const normalizeText = (text: string): string => {
  return text
    .normalize("NFD") // separa los acentos
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .toLowerCase()
    .trim();
};
