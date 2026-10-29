import { useRef, useState } from "react";
import {
  categoryEnabled,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_LABELS,
} from "../../components/user-settings/user-settings-draft";
import { useI18n } from "../../i18n/I18nProvider";
import type {
  NotificationCategory,
  NotificationMedium,
  NotificationPreferences,
} from "../../types/api";
import { useCloseMenusOnOutsideClick } from "../../utils/useCloseMenusOnOutsideClick";

const isCommentCategory = (category: NotificationCategory) =>
  category.startsWith("comment");

const GROUPS = [
  {
    label: "notifGroupReviews",
    categories: NOTIFICATION_CATEGORIES.filter((c) => !isCommentCategory(c)),
  },
  {
    label: "notifGroupComments",
    categories: NOTIFICATION_CATEGORIES.filter(isCommentCategory),
  },
] as const;

/** A dropdown of one channel's events, each ticked on or off. */
export function NotificationEventsMenu({
  medium,
  label,
  preferences,
  onToggle,
}: {
  medium: NotificationMedium;
  label: string;
  preferences: NotificationPreferences;
  onToggle: (medium: NotificationMedium, category: NotificationCategory) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useCloseMenusOnOutsideClick(open, [{ ref, close: () => setOpen(false) }]);

  const total = NOTIFICATION_CATEGORIES.length;
  const count = NOTIFICATION_CATEGORIES.filter((category) =>
    categoryEnabled(preferences, medium, category),
  ).length;
  const summary =
    count === total
      ? t("notifAllEvents")
      : count === 0
        ? t("notifNoEvents")
        : t("notifSomeEvents", { count, total });

  return (
    <div className="notification-events" ref={ref}>
      <button
        className="btn btn-outline-secondary dropdown-toggle"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {summary}
      </button>
      {open ? (
        <div className="notification-events-menu">
          <div className="notification-events-title">
            {t("notifEventsMenuTitle", { channel: label })}
          </div>
          {GROUPS.map((group) => (
            <div key={group.label}>
              <div className="notification-events-group">{t(group.label)}</div>
              {group.categories.map((category) => {
                const id = `${medium}-${category}`;
                return (
                  <label className="notification-events-item" key={id} htmlFor={id}>
                    <input
                      className="form-check-input m-0"
                      id={id}
                      type="checkbox"
                      checked={categoryEnabled(preferences, medium, category)}
                      onChange={() => onToggle(medium, category)}
                    />
                    {t(NOTIFICATION_CATEGORY_LABELS[category])}
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
