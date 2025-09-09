import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import ReactCountryFlag from "react-country-flag";

type Lang = "es" | "de" | "en";

const LANG_FLAG: Record<Lang, { code: string; label: string }> = {
  es: { code: "ES", label: "Español" },
  de: { code: "DE", label: "Deutsch" },
  en: { code: "GB", label: "English" }, // usa "US" si prefieres bandera de EE.UU.
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
        const { code: countryCode, label } = LANG_FLAG[code];

        return (
          <div key={code} className="relative">
            {/* Radio accesible (oculto visualmente) */}
            <input
              id={id}
              name="lang"
              type="radio"
              className="sr-only"
              checked={checked}
              onChange={() => handleChange(code)}
              value={code}
            />
            {/* Botón/label */}
            <label
              htmlFor={id}
              title={label}
              aria-label={label}
              className={`cursor-pointer select-none px-2 py-1 rounded-md transition inline-flex items-center gap-1 ${
                checked
                  ? "bg-white text-blue-700 shadow"
                  : "text-white hover:bg-white/20"
              }`}
            >
              <ReactCountryFlag
                countryCode={countryCode}
                svg
                style={{ width: "1.25rem", height: "1.25rem", borderRadius: "2px" }}
                aria-hidden="true"
              />
            </label>
          </div>
        );
      })}
    </fieldset>
  );
}
