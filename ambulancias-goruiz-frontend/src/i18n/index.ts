import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import es from "../locales/es/common.json";
import de from "../locales/de/common.json";
import en from "../locales/en/common.json";

const savedLang = localStorage.getItem("lang") || "es";

i18n
  .use(initReactI18next)
  .init({
    resources: {
      es: { common: es },
      de: { common: de },
      en: { common: en }
    },
    lng: savedLang,
    fallbackLng: "es",
    ns: ["common"],
    defaultNS: "common",
    interpolation: {
      escapeValue: false // React ya hace escaping
    }
  });

export default i18n;
