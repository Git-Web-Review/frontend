import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { apiRequest, apiRequestBlob } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { useBranding } from "../branding/BrandingProvider";
import { useI18n } from "../i18n/I18nProvider";
import {
  realtimeNotificationEvent,
  type RealtimeNotificationEvent,
} from "../realtime/events";
import type { NotificationItem, NotificationPage } from "../types/api";
import { formatDateTime } from "../utils/formatDate";
import { projectName } from "../utils/projectName";
import { profileInitialsFromEmail } from "../utils/profileInitials";
import { useTheme } from "./ThemeProvider";

type AppShellProps = {
  children: ReactNode;
};

const websocketUrl = import.meta.env.VITE_WEBSOCKET_URL || "ws://localhost:3001";

export function AppShell({ children }: AppShellProps) {
  const { currentUser, idToken, signOutUser } = useAuth();
  const { appName, logoSrc } = useBranding();
  const { language, setLanguage, t } = useI18n();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const notificationsRef = useRef<HTMLLIElement | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [accountProfileImageSrc, setAccountProfileImageSrc] = useState("");
  const profileInitials = profileInitialsFromEmail(currentUser?.email);
  const accountLabel = currentUser?.settings?.nickname || currentUser?.email || "";

  const activeView = location.pathname.startsWith("/review")
    ? "review"
    : location.pathname.startsWith("/settings")
      ? "settings"
      : location.pathname.startsWith("/admin")
        ? "admin"
        : "dashboard";

  const loadNotifications = async () => {
    if (!idToken) {
      return;
    }

    const page = await apiRequest<NotificationPage>(
      "/v1/notifications?page=1&pageSize=50",
      idToken,
    );
    setNotifications(page.items);
  };

  useEffect(() => {
    void loadNotifications();
  }, [idToken]);

  useEffect(() => {
    if (!notificationsOpen && !accountMenuOpen) {
      return;
    }

    const closeMenusOnOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null;

      if (!target || !notificationsRef.current?.contains(target)) {
        setNotificationsOpen(false);
      }

      if (!target || !accountMenuRef.current?.contains(target)) {
        setAccountMenuOpen(false);
      }
    };

    const closeMenusOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      setNotificationsOpen(false);
      setAccountMenuOpen(false);
    };

    document.addEventListener("pointerdown", closeMenusOnOutsidePointerDown);
    document.addEventListener("keydown", closeMenusOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMenusOnOutsidePointerDown);
      document.removeEventListener("keydown", closeMenusOnEscape);
    };
  }, [accountMenuOpen, notificationsOpen]);

  useEffect(() => {
    if (!idToken || !currentUser?.id) {
      setNotifications([]);
      return;
    }

    let websocket: WebSocket | null = null;
    let reconnectTimeout: number | null = null;
    let reconnectAttempt = 0;
    let closedByEffect = false;

    const websocketEndpoint = `${websocketUrl.replace(/\/$/, "")}/ws?token=${encodeURIComponent(idToken)}`;

    const connect = () => {
      websocket = new WebSocket(websocketEndpoint);

      websocket.addEventListener("open", () => {
        reconnectAttempt = 0;
      });

      websocket.addEventListener("message", (event) => {
        let data: RealtimeNotificationEvent;
        try {
          data = JSON.parse(event.data) as RealtimeNotificationEvent;
        } catch {
          return;
        }

        void loadNotifications();
        window.dispatchEvent(
          new CustomEvent<RealtimeNotificationEvent>(realtimeNotificationEvent, {
            detail: data,
          }),
        );
      });

      websocket.addEventListener("close", () => {
        if (closedByEffect) {
          return;
        }

        reconnectAttempt += 1;
        const delayMs = Math.min(30000, 1000 * 2 ** reconnectAttempt);
        reconnectTimeout = window.setTimeout(connect, delayMs);
      });

      websocket.addEventListener("error", () => {
        websocket?.close();
      });
    };

    connect();

    return () => {
      closedByEffect = true;
      if (reconnectTimeout) {
        window.clearTimeout(reconnectTimeout);
      }
      websocket?.close();
    };
  }, [currentUser?.id, idToken]);

  useEffect(() => {
    let objectUrl = "";
    let cancelled = false;

    const loadAccountProfileImage = async () => {
      if (!currentUser) {
        setAccountProfileImageSrc("");
        return;
      }

      if (!currentUser.profileImage || !idToken) {
        setAccountProfileImageSrc(currentUser.settings?.profileImageUrl ?? "");
        return;
      }

      try {
        const blob = await apiRequestBlob("/v1/me/profile-image", idToken);
        const nextObjectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(nextObjectUrl);
          return;
        }

        objectUrl = nextObjectUrl;
        setAccountProfileImageSrc(objectUrl);
      } catch {
        if (!cancelled) {
          setAccountProfileImageSrc(currentUser.settings?.profileImageUrl ?? "");
        }
      }
    };

    void loadAccountProfileImage();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [
    currentUser,
    currentUser?.profileImage?.updatedAt,
    currentUser?.settings?.profileImageUrl,
    idToken,
  ]);

  const markAllSeen = async () => {
    if (!idToken) {
      return;
    }

    const unseenIds = notifications
      .filter((notification) => !notification.seen)
      .map((notification) => notification.id);
    if (unseenIds.length === 0) {
      return;
    }

    await apiRequest("/v1/notifications/seen", idToken, {
      method: "PATCH",
      body: JSON.stringify({ notificationIds: unseenIds }),
    });
    await loadNotifications();
  };

  useEffect(() => {
    if (!idToken) {
      return;
    }

    const reviewPathMatch = location.pathname.match(/^\/review\/([^/]+)/);
    if (!reviewPathMatch) {
      return;
    }

    const reviewId = reviewPathMatch[1];
    const unseenIds = notifications
      .filter(
        (notification) =>
          !notification.seen &&
          reviewNotificationPayload(notification)?.reviewId === reviewId,
      )
      .map((notification) => notification.id);
    if (unseenIds.length === 0) {
      return;
    }

    void (async () => {
      await apiRequest("/v1/notifications/seen", idToken, {
        method: "PATCH",
        body: JSON.stringify({ notificationIds: unseenIds }),
      });
      await loadNotifications();
    })();
  }, [idToken, location.pathname, notifications]);

  const unreadCount = notifications.filter(
    (notification) => !notification.seen,
  ).length;

  const viewKicker =
    activeView === "dashboard"
      ? t("kickerReviews")
      : activeView === "review"
        ? t("kickerReviewDetails")
        : activeView === "settings"
          ? t("kickerAccount")
          : t("kickerAdministration");

  const textNotificationPayload = (notification: NotificationItem) => {
    if (
      notification.type !== "TEXT" ||
      typeof notification.payload !== "object" ||
      notification.payload === null
    ) {
      return null;
    }

    const payload = notification.payload as Record<string, unknown>;
    return {
      title: typeof payload.title === "string" ? payload.title : null,
      message: typeof payload.message === "string" ? payload.message : null,
    };
  };

  const reviewNotificationPayload = (notification: NotificationItem) => {
    if (
      (notification.type !== "REVIEW_PENDING" &&
        notification.type !== "REVIEW_STATUS_CHANGED" &&
        notification.type !== "COMMIT_REVIEWED" &&
        notification.type !== "COMMENT_RECEIVED" &&
        notification.type !== "REVIEW_NEW_VERSION") ||
      typeof notification.payload !== "object" ||
      notification.payload === null
    ) {
      return null;
    }

    const payload = notification.payload as Record<string, unknown>;
    const reviewId = typeof payload.reviewId === "string" ? payload.reviewId : null;
    if (!reviewId) {
      return null;
    }

    return {
      reviewId,
      title:
        typeof payload.title === "string" && payload.title
          ? payload.title
          : typeof payload.gitwebTitle === "string" && payload.gitwebTitle
            ? payload.gitwebTitle
            : typeof payload.gitwebUrl === "string"
              ? payload.gitwebUrl
              : t("notificationReviewPending"),
      ownerEmail:
        typeof payload.ownerEmail === "string" ? payload.ownerEmail : null,
      sourceProject:
        typeof payload.sourceProject === "string" ? payload.sourceProject : null,
      actorEmail:
        typeof payload.actorEmail === "string" ? payload.actorEmail : null,
      actorNickname:
        typeof payload.actorNickname === "string" ? payload.actorNickname : null,
    };
  };

  const openNotification = async (notification: NotificationItem) => {
    const reviewPayload = reviewNotificationPayload(notification);
    if (!reviewPayload) {
      return;
    }

    if (!notification.seen) {
      void markNotificationSeen(notification.id);
    }
    setNotificationsOpen(false);
    navigate(`/review/${reviewPayload.reviewId}`);
  };

  const markNotificationSeen = async (notificationId: string) => {
    if (!idToken) {
      return;
    }

    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) =>
        notification.id === notificationId
          ? { ...notification, seen: true }
          : notification,
      ),
    );

    await apiRequest("/v1/notifications/seen", idToken, {
      method: "PATCH",
      body: JSON.stringify({ notificationIds: [notificationId] }),
    });
    await loadNotifications();
  };

  const notificationTitle = (notification: NotificationItem) => {
    const textPayload = textNotificationPayload(notification);
    if (textPayload?.title) {
      return textPayload.title;
    }

    if (notification.type === "TEXT") {
      return t("notificationText");
    }

    if (notification.type === "REVIEW_PENDING") {
      return t("notificationReviewPending");
    }

    if (notification.type === "REVIEW_STATUS_CHANGED") {
      return t("notificationReviewStatusChanged");
    }

    if (notification.type === "COMMIT_REVIEWED") {
      return t("notificationCommitReviewed");
    }

    if (notification.type === "COMMENT_RECEIVED") {
      return t("notificationCommentReceived");
    }

    if (notification.type === "REVIEW_NEW_VERSION") {
      return t("notificationReviewNewVersion");
    }

    return t("notifications");
  };

  const notificationBody = (notification: NotificationItem) =>
    textNotificationPayload(notification)?.message ?? null;

  const renderNotificationContent = (notification: NotificationItem) => {
    const reviewPayload = reviewNotificationPayload(notification);
    if (reviewPayload) {
      const actor =
        notification.type === "REVIEW_STATUS_CHANGED" ||
        notification.type === "COMMIT_REVIEWED" ||
        notification.type === "COMMENT_RECEIVED" ||
        notification.type === "REVIEW_NEW_VERSION"
          ? reviewPayload.actorNickname || reviewPayload.actorEmail
          : reviewPayload.ownerEmail;

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
                {notification.type === "REVIEW_STATUS_CHANGED"
                  ? t("updatedBy")
                  : notification.type === "COMMIT_REVIEWED"
                    ? t("reviewedBy")
                    : notification.type === "COMMENT_RECEIVED"
                      ? t("commentedBy")
                      : notification.type === "REVIEW_NEW_VERSION"
                        ? t("syncedBy")
                        : t("openedBy")} {actor}
              </span>
            ) : null}
          </div>
        </>
      );
    }

    return (
      <>
        <div className="fw-semibold">{notificationTitle(notification)}</div>
        {notificationBody(notification) ? (
          <div className="small text-body text-wrap">
            {notificationBody(notification)}
          </div>
        ) : null}
      </>
    );
  };

  return (
    <div className="app-wrapper">
      <nav className="app-header navbar navbar-expand bg-body">
        <div className="container-fluid">
          <NavLink className="app-brand" to="/dashboard">
            {logoSrc ? (
              <img alt="" className="app-brand-logo" src={logoSrc} />
            ) : null}
            <span className="app-brand-name">{appName || t("appName")}</span>
          </NavLink>
          <div className="app-header-end">
            <ul className="navbar-nav align-items-center">
              <li
                className="nav-item dropdown position-relative"
                ref={notificationsRef}
              >
                <button
                  className="nav-link btn btn-link position-relative px-2"
                  type="button"
                  title={
                    unreadCount
                      ? `${t("notifications")} (${unreadCount})`
                      : t("notifications")
                  }
                  aria-label={
                    unreadCount
                      ? `${t("notifications")} (${unreadCount})`
                      : t("notifications")
                  }
                  onClick={() => setNotificationsOpen((open) => !open)}
                >
                  <i className="bi bi-bell" aria-hidden="true" />
                  {unreadCount ? (
                    <span className="navbar-badge gwr-tabnum" aria-hidden="true">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  ) : null}
                </button>
                {notificationsOpen ? (
                  <div className="dropdown-menu dropdown-menu-lg dropdown-menu-end show notification-dropdown">
                    <div className="dropdown-item notification-dropdown-header">
                      <span className="fw-semibold">{t("notifications")}</span>
                      <button
                        className="btn btn-link btn-sm p-0 text-decoration-none notification-mark-all-button"
                        type="button"
                        onClick={() => void markAllSeen()}
                      >
                        {t("markAllSeen")}
                      </button>
                    </div>
                    <div className="dropdown-divider" />
                    {notifications.length ? (
                      notifications.map((notification) => {
                        const reviewPayload = reviewNotificationPayload(notification);
                        const entryClassName = notification.seen
                          ? "dropdown-item notification-entry"
                          : "dropdown-item notification-entry bg-primary-subtle";
                        const seenButton = !notification.seen ? (
                          <button
                            className="btn btn-light btn-sm notification-seen-button"
                            type="button"
                            title={t("markAsSeen")}
                            onClick={(event) => {
                              event.stopPropagation();
                              void markNotificationSeen(notification.id);
                            }}
                          >
                            <i className="bi bi-check2" aria-hidden="true" />
                          </button>
                        ) : null;

                        if (reviewPayload) {
                          return (
                            <div className={entryClassName} key={notification.id}>
                              {seenButton}
                              <button
                                className="notification-entry-link text-start"
                                type="button"
                                onClick={() => void openNotification(notification)}
                              >
                                {renderNotificationContent(notification)}
                                <div className="text-secondary small">
                                  <i className="bi bi-clock me-1" aria-hidden="true" />
                                  {formatDateTime(notification.createdAt)}
                                </div>
                              </button>
                            </div>
                          );
                        }

                        return (
                          <div className={entryClassName} key={notification.id}>
                            {seenButton}
                            <button
                              className="notification-entry-link text-start"
                              type="button"
                              onClick={() => {
                                if (!notification.seen) {
                                  void markNotificationSeen(notification.id);
                                }
                              }}
                            >
                              {renderNotificationContent(notification)}
                              <div className="text-secondary small">
                                <i className="bi bi-clock me-1" aria-hidden="true" />
                                {formatDateTime(notification.createdAt)}
                              </div>
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <div className="dropdown-item text-center text-secondary py-4">
                        {t("noNotifications")}
                      </div>
                    )}
                  </div>
                ) : null}
              </li>
            </ul>
            <div className="account-menu" ref={accountMenuRef}>
              <button
                className="account-menu-toggle"
                type="button"
                aria-expanded={accountMenuOpen}
                aria-haspopup="true"
                title={accountLabel}
                onClick={() => {
                  setNotificationsOpen(false);
                  setAccountMenuOpen((open) => !open);
                }}
              >
                <span className="account-avatar">
                  {accountProfileImageSrc ? (
                    <img alt="" src={accountProfileImageSrc} />
                  ) : (
                    profileInitials
                  )}
                </span>
                <i
                  className="bi bi-chevron-down account-menu-caret"
                  aria-hidden="true"
                />
              </button>
              {accountMenuOpen ? (
                <div className="dropdown-menu show account-dropdown">
                  <div className="account-dropdown-header">
                    <span className="account-dropdown-name">{accountLabel}</span>
                    {currentUser?.hostname ? (
                      <span className="account-dropdown-host">
                        {currentUser.hostname}
                      </span>
                    ) : null}
                  </div>
                  <button
                    className="dropdown-item account-dropdown-item"
                    type="button"
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  >
                    <i
                      className={theme === "dark" ? "bi bi-sun" : "bi bi-moon"}
                      aria-hidden="true"
                    />
                    <span>{theme === "dark" ? t("light") : t("dark")}</span>
                  </button>
                  <button
                    className="dropdown-item account-dropdown-item"
                    type="button"
                    onClick={() => setLanguage(language === "fr" ? "en" : "fr")}
                  >
                    <i className="bi bi-translate" aria-hidden="true" />
                    <span>{language === "fr" ? "English" : "Français"}</span>
                  </button>
                  <NavLink
                    className="dropdown-item account-dropdown-item"
                    to="/settings"
                    onClick={() => setAccountMenuOpen(false)}
                  >
                    <i className="bi bi-gear" aria-hidden="true" />
                    <span>{t("settings")}</span>
                  </NavLink>
                  {currentUser?.role === "ADMIN" ? (
                    <NavLink
                      className="dropdown-item account-dropdown-item"
                      to="/admin"
                      onClick={() => setAccountMenuOpen(false)}
                    >
                      <i className="bi bi-shield-lock" aria-hidden="true" />
                      <span>{t("admin")}</span>
                    </NavLink>
                  ) : null}
                  <div className="dropdown-divider" />
                  <button
                    className="dropdown-item account-dropdown-item"
                    type="button"
                    onClick={() => void signOutUser()}
                  >
                    <i className="bi bi-box-arrow-right" aria-hidden="true" />
                    <span>{t("logout")}</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </nav>
      <main className="app-main" data-view={activeView}>
        <div className="app-content-header">
          <div className="container-fluid">
            <div className="row">
              <div className="col-sm-6">
                <span className="app-kicker">{viewKicker}</span>
                <h3 className="mb-0">
                  {activeView === "dashboard" ? t("dashboard") : null}
                  {activeView === "settings" ? t("settings") : null}
                  {activeView === "admin" ? t("admin") : null}
                  {activeView === "review" ? t("reviewDetails") : null}
                </h3>
              </div>
            </div>
          </div>
        </div>
        <div className="app-content">
          <div className="container-fluid">{children}</div>
        </div>
      </main>
    </div>
  );
}
