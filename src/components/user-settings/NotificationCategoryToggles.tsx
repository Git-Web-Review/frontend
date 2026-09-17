import { useI18n } from "../../i18n/I18nProvider";
import type {
  NotificationCategory,
  NotificationMedium,
  NotificationPreferences,
} from "../../types/api";
import {
  categoryEnabled,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_LABELS,
} from "./user-settings-draft";

/** One switch per notification category, for one medium. */
export function NotificationCategoryToggles({
  idPrefix = "",
  medium,
  preferences,
  className,
  onToggle,
}: {
  idPrefix?: string;
  medium: NotificationMedium;
  preferences: NotificationPreferences;
  className: string;
  onToggle: (medium: NotificationMedium, category: NotificationCategory) => void;
}) {
  const { t } = useI18n();

  return (
    <div className={className}>
      {NOTIFICATION_CATEGORIES.map((category) => {
        const id = `${idPrefix}${medium}-${category}`;
        return (
          <div className="form-check form-switch" key={id}>
            <input
              className="form-check-input"
              id={id}
              type="checkbox"
              checked={categoryEnabled(preferences, medium, category)}
              onChange={() => onToggle(medium, category)}
            />
            <label className="form-check-label" htmlFor={id}>
              {t(NOTIFICATION_CATEGORY_LABELS[category])}
            </label>
          </div>
        );
      })}
    </div>
  );
}
