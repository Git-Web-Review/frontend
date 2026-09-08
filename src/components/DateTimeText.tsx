import { useI18n } from "../i18n/I18nProvider";
import { formatDateTime, formatDateTimeLong } from "../utils/formatDate";

type DateTimeTextProps = {
  value: string | Date | null | undefined;
  /** Prefix for the tooltip, e.g. "Updated" — the stamp itself stays bare. */
  label?: string;
  /** Bootstrap icon class, rendered before the stamp. */
  icon?: string;
  className?: string;
  /** Shown in place of the stamp when there is no date. */
  fallback?: string;
};

/**
 * A short dd/mm/yy hh:mm stamp whose tooltip spells the same instant out in
 * the current UI language. Shared by the dashboard rows and the review page so
 * every date in the app answers a hover the same way.
 */
export function DateTimeText({
  value,
  label,
  icon,
  className,
  fallback,
}: DateTimeTextProps) {
  const { language } = useI18n();
  const stamp = formatDateTime(value);

  if (!stamp) {
    return fallback ? <>{fallback}</> : null;
  }

  const longStamp = formatDateTimeLong(value, language);
  const tooltip = label ? `${label} — ${longStamp}` : longStamp;

  return (
    <span
      className={className ? `datetime-text ${className}` : "datetime-text"}
      title={tooltip}
    >
      {icon ? <i className={`bi ${icon}`} aria-hidden="true" /> : null}
      {stamp}
    </span>
  );
}
