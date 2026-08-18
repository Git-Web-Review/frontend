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
