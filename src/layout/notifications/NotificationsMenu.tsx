import type { Dispatch, RefObject, SetStateAction } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../i18n/I18nProvider";
import type { NotificationItem } from "../../types/api";
import { formatDateTime } from "../../utils/formatDate";
import { projectName } from "../../utils/projectName";
import {
  notificationActor,
  notificationActorLabel,
  notificationTitle,
  reviewNotificationPayload,
  textNotificationPayload,
} from "./notification-payloads";
import type { Notifications } from "./useNotifications";

/** The bell in the header and the dropdown listing the notifications. */
export function NotificationsMenu({
  notifications,
  open,
  setOpen,
  menuRef,
}: {
  notifications: Notifications;
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  menuRef: RefObject<HTMLLIElement | null>;
}) {
  const { t } = useI18n();
  const { unreadCount } = notifications;
  const label = unreadCount
    ? `${t("notifications")} (${unreadCount})`
    : t("notifications");

  return (
    <li className="nav-item dropdown position-relative" ref={menuRef}>
      <button
        className="nav-link btn btn-link position-relative px-2"
        type="button"
        title={label}
        aria-label={label}
        onClick={() => setOpen((current) => !current)}
      >
        <i className="bi bi-bell" aria-hidden="true" />
        {unreadCount ? (
          <span className="navbar-badge gwr-tabnum" aria-hidden="true">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="dropdown-menu dropdown-menu-lg dropdown-menu-end show notification-dropdown">
          <div className="dropdown-item notification-dropdown-header">
            <span className="fw-semibold">{t("notifications")}</span>
            <button
              className="btn btn-link btn-sm p-0 text-decoration-none notification-mark-all-button"
              type="button"
              onClick={() => void notifications.markAllSeen()}
            >
              {t("markAllSeen")}
            </button>
          </div>
          <div className="dropdown-divider" />
          {notifications.notifications.length ? (
            notifications.notifications.map((notification) => (
              <NotificationEntry
                key={notification.id}
                notification={notification}
                notifications={notifications}
                onOpened={() => setOpen(false)}
              />
            ))
          ) : (
            <div className="dropdown-item text-center text-secondary py-4">
              {t("noNotifications")}
            </div>
          )}
        </div>
      ) : null}
    </li>
  );
}

function NotificationEntry({
  notification,
  notifications,
  onOpened,
}: {
  notification: NotificationItem;
  notifications: Notifications;
  onOpened: () => void;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const reviewPayload = reviewNotificationPayload(notification, t);

  // A review notification opens its review; any other one is only marked
  // as seen.
  const openNotification = () => {
    if (!notification.seen) {
      void notifications.markNotificationSeen(notification.id);
    }
    if (reviewPayload) {
      onOpened();
      navigate(`/review/${reviewPayload.reviewId}`);
    }
  };

  return (
    <div
      className={
        notification.seen
          ? "dropdown-item notification-entry"
          : "dropdown-item notification-entry bg-primary-subtle"
      }
    >
      {!notification.seen ? (
        <button
          className="btn btn-light btn-sm notification-seen-button"
          type="button"
          title={t("markAsSeen")}
          onClick={(event) => {
            event.stopPropagation();
            void notifications.markNotificationSeen(notification.id);
          }}
        >
          <i className="bi bi-check2" aria-hidden="true" />
        </button>
      ) : null}
      <button
        className="notification-entry-link text-start"
        type="button"
        onClick={openNotification}
      >
        <NotificationContent notification={notification} />
        <div className="text-secondary small">
          <i className="bi bi-clock me-1" aria-hidden="true" />
          {formatDateTime(notification.createdAt)}
        </div>
      </button>
    </div>
  );
}

function NotificationContent({
  notification,
}: {
  notification: NotificationItem;
}) {
  const { t } = useI18n();
  const reviewPayload = reviewNotificationPayload(notification, t);

  if (!reviewPayload) {
    const body = textNotificationPayload(notification)?.message ?? null;
    return (
      <>
        <div className="fw-semibold">{notificationTitle(notification, t)}</div>
        {body ? <div className="small text-body text-wrap">{body}</div> : null}
      </>
    );
  }

  const actor = notificationActor(notification, reviewPayload);
  return (
    <>
      <div className="fw-semibold text-wrap">{reviewPayload.title}</div>
      <div className="small text-body text-wrap">
        {reviewPayload.sourceProject ? (
          <span className="d-block">
            {t("sourceProject")}: {projectName(reviewPayload.sourceProject)}
          </span>
        ) : null}
        {actor ? (
          <span className="d-block">
            {notificationActorLabel(notification, t)} {actor}
          </span>
        ) : null}
        {reviewPayload.addedAsReviewer ? (
          <span className="d-block">{t("addedAsReviewerByMention")}</span>
        ) : null}
      </div>
    </>
  );
}
