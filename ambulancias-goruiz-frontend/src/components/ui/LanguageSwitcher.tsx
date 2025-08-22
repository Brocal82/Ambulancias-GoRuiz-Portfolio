import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type Lang = "es" | "de" | "en";

const LANG_LABEL: Record<Lang, string> = {
  es: "ES",
  de: "DE",
  en: "EN",
};

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [lang, setLang] = useState<Lang>(
    (localStorage.getItem("lang") as Lang) || "es"
  );

  useEffect(() => {
    document.documentElement.lang = lang;
    if (i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }
  }, [lang, i18n]);

  const handleChange = (newLang: Lang) => {
    setLang(newLang);
    localStorage.setItem("lang", newLang);
    i18n.changeLanguage(newLang);
    document.documentElement.lang = newLang;
  };

  return (
    <fieldset className="flex items-center gap-1 bg-white/10 rounded-lg p-1">
      <legend className="sr-only">Selector de idioma</legend>

      {(["es", "de", "en"] as Lang[]).map((code) => {
        const id = `lang-${code}`;
        const checked = lang === code;

        return (
          <div key={code} className="relative">
            {/* Radio nativo (accesible). Visualmente oculto pero accesible al teclado/lector. */}
            <input
              id={id}
              name="lang"
              type="radio"
              className="sr-only"
              checked={checked}
              onChange={() => handleChange(code)}
              value={code}
            />
            {/* Label estilizado como botón */}
            <label
              htmlFor={id}
              className={`cursor-pointer select-none px-2 py-1 text-sm rounded-md transition ${
                checked ? "bg-white text-blue-700" : "text-white hover:bg-white/20"
              }`}
            >
              {LANG_LABEL[code]}
            </label>
          </div>
        );
      })}
    </fieldset>
  );
}
