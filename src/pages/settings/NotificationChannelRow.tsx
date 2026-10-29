import type { ReactNode } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import type {
  NotificationCategory,
  NotificationMedium,
  NotificationPreferences,
} from "../../types/api";
import { NotificationEventsMenu } from "./NotificationEventsMenu";

/** One channel of the settings list: its switch, then once on its field,
 * its own events and its actions. */
export function NotificationChannelRow({
  medium,
  icon,
  label,
  description,
  enabled,
  needsSetup,
  onEnabledChange,
  preferences,
  onToggle,
  action,
  children,
}: {
  medium: NotificationMedium;
  icon: string;
  label: string;
  description: string;
  enabled: boolean;
  needsSetup: boolean;
  onEnabledChange: (enabled: boolean) => void;
  preferences: NotificationPreferences;
  onToggle: (medium: NotificationMedium, category: NotificationCategory) => void;
  action?: ReactNode;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const switchId = `${medium}-notifications`;

  return (
    <div className={`notification-channel${enabled ? " is-on" : ""}`}>
      <div className="notification-channel-head">
        <span className="notification-channel-icon" aria-hidden="true">
          <i className={`bi ${icon}`} />
        </span>
        <div>
          <label className="notification-channel-name" htmlFor={switchId}>
            {label}
            {!enabled ? (
              <span className="badge notification-channel-status">
                {t("notifChannelOff")}
              </span>
            ) : needsSetup ? (
              <span className="badge notification-channel-status is-warn">
                {t("notifChannelNeedsSetup")}
              </span>
            ) : null}
          </label>
          <div className="notification-channel-description">{description}</div>
        </div>
        <div className="form-check form-switch m-0">
          <input
            className="form-check-input"
            id={switchId}
            type="checkbox"
            checked={enabled}
            onChange={(event) => onEnabledChange(event.target.checked)}
          />
        </div>
      </div>
      {enabled ? (
        <div className="notification-channel-detail">
          {children ? <div>{children}</div> : null}
          <div>
            <div className="form-label">{t("notifNotifyMeAbout")}</div>
            <div className="d-flex flex-wrap gap-2">
              <NotificationEventsMenu
                medium={medium}
                label={label}
                preferences={preferences}
                onToggle={onToggle}
              />
              {action}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
