import { createContext, type ReactNode, useContext, useState } from "react";
import { translations, type Language, type TranslationKey } from "./translations";

type I18nContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey) => string;
};

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
        t: (key) => translations[language][key] ?? key,
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