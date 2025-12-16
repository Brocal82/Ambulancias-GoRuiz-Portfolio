export const normalizeText = (text: string): string => {
  return text
    .normalize("NFD") // separa caracteres con tilde
    .replace(/[\u0300-\u036f]/g, "") // elimina los caracteres diacríticos (tildes)
    .toLowerCase()
    .trim();
};
