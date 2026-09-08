const padTwo = (value: number) => String(value).padStart(2, "0");

/** dd/mm/yy hh:mm (24h), locale-independent. */
export const formatDateTime = (value: string | Date | null | undefined) => {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${padTwo(date.getDate())}/${padTwo(date.getMonth() + 1)}/${String(
    date.getFullYear(),
  ).slice(-2)} ${padTwo(date.getHours())}:${padTwo(date.getMinutes())}`;
};

/** dd/mm/yy, locale-independent. */
export const formatDate = (value: string | Date | null | undefined) =>
  formatDateTime(value).split(" ")[0] ?? "";

/** Locale used to spell dates out in words, per UI language. */
const LONG_DATE_LOCALES: Record<string, string> = {
  fr: "fr-FR",
  en: "en-GB",
};

/**
 * The same instant written out in words, in the current UI language —
 * "lundi 8 septembre 2026 à 14:32" / "Monday 8 September 2026 at 14:32".
 * Meant for the tooltip behind a short `formatDateTime` stamp.
 */
export const formatDateTimeLong = (
  value: string | Date | null | undefined,
  language: string,
) => {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat(LONG_DATE_LOCALES[language] ?? language, {
      dateStyle: "full",
      timeStyle: "short",
    }).format(date);
  } catch {
    return formatDateTime(date);
  }
};
