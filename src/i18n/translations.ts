import en from "./en.json";
import fr from "./fr.json";

export const translations = { en, fr } as const;

export type Language = keyof typeof translations;
export type TranslationKey = keyof typeof fr;
