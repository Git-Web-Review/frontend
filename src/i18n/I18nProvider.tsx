import { createContext, type ReactNode, useContext, useState } from "react";
import { translations, type Language, type TranslationKey } from "./translations";

type TranslationVars = Record<string, string | number>;

type I18nContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  /** `{name}` placeholders in the catalog are filled from `vars`. */
  t: (key: TranslationKey, vars?: TranslationVars) => string;
};

const fillPlaceholders = (template: string, vars: TranslationVars) =>
  template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem("language") as Language | null) ?? "fr";
  });

  const setLanguage = (nextLanguage: Language) => {
    localStorage.setItem("language", nextLanguage);
    setLanguageState(nextLanguage);
  };

  return (
    <I18nContext.Provider
      value={{
        language,
        setLanguage,
        t: (key, vars) => {
          const template = translations[language][key] ?? key;
          return vars ? fillPlaceholders(template, vars) : template;
        },
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider");
  }

  return context;
}