export const getCurrentLang = (): string =>
  localStorage.getItem("lang") || "es";

export const formatDate = (
  date: Date | string,
  options?: Intl.DateTimeFormatOptions
): string => {
  const lang = getCurrentLang();
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(lang, options).format(d);
};

export const formatTime = (
  date: Date | string,
  options?: Intl.DateTimeFormatOptions
): string => {
  const lang = getCurrentLang();
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(lang, { hour: "2-digit", minute: "2-digit", ...options }).format(d);
};

export const formatNumber = (
  value: number,
  options?: Intl.NumberFormatOptions
): string => {
  const lang = getCurrentLang();
  return new Intl.NumberFormat(lang, options).format(value);
};

export const monthLabel = (
  year: number,
  monthIndex: number,
  options?: Intl.DateTimeFormatOptions
): string => {
  const lang = getCurrentLang();
  return new Intl.DateTimeFormat(lang, { month: "long", ...options }).format(
    new Date(year, monthIndex, 1)
  );
};

