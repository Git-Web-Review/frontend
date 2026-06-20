import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { apiRequest, backendUrl } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { useI18n } from "../i18n/I18nProvider";
import {
  realtimeNotificationEvent,
  type RealtimeNotificationEvent,
} from "../realtime/events";
import type { NotificationItem, NotificationPage } from "../types/api";
import { profileInitialsFromEmail } from "../utils/profileInitials";
import { useTheme } from "./ThemeProvider";

type AppShellProps = {
  children: ReactNode;
};

const websocketUrl = import.meta.env.VITE_WEBSOCKET_URL || "ws://localhost:3001";

export function AppShell({ children }: AppShellProps) {
  const { currentUser, idToken, signOutUser } = useAuth();
  const { language, setLanguage, t } = useI18n();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const notificationsRef = useRef<HTMLLIElement | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [brandProfileImageSrc, setBrandProfileImageSrc] = useState("");
  const profileInitials = profileInitialsFromEmail(currentUser?.email);

  const activeView = location.pathname.startsWith("/review")
    ? "review"
    : location.pathname.startsWith("/settings")
      ? "settings"
      : location.pathname.startsWith("/admin")
        ? "admin"
        : "dashboard";

  useEffect(() => {
    document.body.classList.add(
      "layout-fixed",
      "sidebar-expand-lg",
      "bg-body-tertiary",
    );

    return () => {
      document.body.classList.remove(
        "layout-fixed",
        "sidebar-expand-lg",
        "bg-body-tertiary",
      );
    };
  }, []);

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
    if (!notificationsOpen) {
      return;
    }

    const closeNotificationsOnOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        notificationsRef.current?.contains(target)
      ) {
        return;
      }

      setNotificationsOpen(false);
    };

    document.addEventListener(
      "pointerdown",
      closeNotificationsOnOutsidePointerDown,
    );
    return () => {
      document.removeEventListener(
        "pointerdown",
        closeNotificationsOnOutsidePointerDown,
      );
    };
  }, [notificationsOpen]);

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

    const loadBrandProfileImage = async () => {
      if (!currentUser) {
        setBrandProfileImageSrc("");
        return;
      }

      if (!currentUser.profileImage || !idToken) {
        setBrandProfileImageSrc(currentUser.settings?.profileImageUrl ?? "");
        return;
      }

      try {
        const response = await fetch(`${backendUrl}/v1/me/profile-image`, {
          headers: { authorization: `Bearer ${idToken}` },
        });
        if (!response.ok) {
          throw new Error(response.statusText);
        }

        const nextObjectUrl = URL.createObjectURL(await response.blob());
        if (cancelled) {
          URL.revokeObjectURL(nextObjectUrl);
          return;
        }

        objectUrl = nextObjectUrl;
        setBrandProfileImageSrc(objectUrl);
      } catch {
        if (!cancelled) {
          setBrandProfileImageSrc(currentUser.settings?.profileImageUrl ?? "");
        }
      }
    };

    void loadBrandProfileImage();

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

  const unreadCount = notifications.filter(
    (notification) => !notification.seen,
  ).length;

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
        notification.type !== "REVIEW_STATUS_CHANGED") ||
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

    if (notification.type === "COMMENT_RECEIVED") {
      return t("notificationCommentReceived");
    }

    return t("notifications");
  };

  const notificationBody = (notification: NotificationItem) =>
    textNotificationPayload(notification)?.message ?? null;

  const renderNotificationContent = (notification: NotificationItem) => {
    const reviewPayload = reviewNotificationPayload(notification);
    if (reviewPayload) {
      const actor =
        notification.type === "REVIEW_STATUS_CHANGED"
          ? reviewPayload.actorNickname || reviewPayload.actorEmail
          : reviewPayload.ownerEmail;

      return (
        <>
          <div className="fw-semibold text-wrap">{reviewPayload.title}</div>
          <div className="small text-body text-wrap">
            {reviewPayload.sourceProject ? (
              <span className="d-block">
                {t("sourceProject")}: {reviewPayload.sourceProject}
              </span>
            ) : null}
            {actor ? (
              <span className="d-block">
                {notification.type === "REVIEW_STATUS_CHANGED"
                  ? t("updatedBy")
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
          <ul className="navbar-nav">
            <li className="nav-item d-none d-md-block">
              <span className="nav-link fw-semibold">
                {currentUser?.settings?.nickname || currentUser?.email}
              </span>
            </li>
            <li className="nav-item d-none d-lg-block">
              <span className="nav-link text-secondary">
                {currentUser?.hostname}
              </span>
            </li>
          </ul>
          <ul className="navbar-nav ms-auto align-items-center">
            <li
              className="nav-item dropdown position-relative"
              ref={notificationsRef}
            >
              <button
                className="nav-link btn btn-link position-relative px-2"
                type="button"
                title={t("notifications")}
                onClick={() => setNotificationsOpen((open) => !open)}
              >
                <i className="bi bi-bell" aria-hidden="true" />
                {unreadCount ? (
                  <span className="navbar-badge badge text-bg-danger">
                    {unreadCount}
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
                                {new Date(notification.createdAt).toLocaleString()}
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
                              {new Date(notification.createdAt).toLocaleString()}
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
            <li className="nav-item">
              <button
                className="nav-link btn btn-link px-2"
                type="button"
                title={theme === "dark" ? t("light") : t("dark")}
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                <i
                  className={theme === "dark" ? "bi bi-sun" : "bi bi-moon"}
                  aria-hidden="true"
                />
              </button>
            </li>
            <li className="nav-item">
              <button
                className="nav-link btn btn-link px-2"
                type="button"
                title="Language"
                onClick={() => setLanguage(language === "fr" ? "en" : "fr")}
              >
                <i className="bi bi-translate" aria-hidden="true" />
              </button>
            </li>
            <li className="nav-item">
              <button
                className="nav-link btn btn-link px-2"
                type="button"
                title={t("logout")}
                onClick={() => void signOutUser()}
              >
                <i className="bi bi-box-arrow-right" aria-hidden="true" />
              </button>
            </li>
          </ul>
        </div>
      </nav>
      <aside
        className="app-sidebar bg-body-secondary shadow"
        data-bs-theme={theme}
      >
        <div className="sidebar-brand">
          <NavLink className="brand-link text-decoration-none" to="/dashboard">
            <span
              className={
                brandProfileImageSrc
                  ? "brand-image overflow-hidden d-inline-grid place-items-center"
                  : "brand-image bg-primary text-white fw-bold d-inline-grid place-items-center"
              }
            >
              {brandProfileImageSrc ? (
                <img alt="" src={brandProfileImageSrc} />
              ) : (
                profileInitials
              )}
            </span>
            <span className="brand-text fw-light ms-2">{t("appName")}</span>
          </NavLink>
        </div>
        <div className="sidebar-wrapper app-sidebar-wrapper">
          <nav className="mt-2" aria-label="Main navigation">
            <ul className="nav sidebar-menu flex-column" role="menu">
              <li className="nav-item">
                <NavLink
                  className={({ isActive }) =>
                    isActive || activeView === "dashboard"
                      ? "nav-link active"
                      : "nav-link"
                  }
                  to="/dashboard"
                >
                  <i
                    className="nav-icon bi bi-speedometer2"
                    aria-hidden="true"
                  />
                  <p>{t("dashboard")}</p>
                </NavLink>
              </li>
              {currentUser?.role === "ADMIN" ? (
                <li className="nav-item">
                  <NavLink
                    className={({ isActive }) =>
                      isActive ? "nav-link active" : "nav-link"
                    }
                    to="/admin"
                  >
                    <i
                      className="nav-icon bi bi-shield-lock"
                      aria-hidden="true"
                    />
                    <p>{t("admin")}</p>
                  </NavLink>
                </li>
              ) : null}
            </ul>
          </nav>
          <nav className="mt-auto mb-2" aria-label="Settings navigation">
            <ul className="nav sidebar-menu flex-column" role="menu">
              <li className="nav-item">
                <NavLink
                  className={({ isActive }) =>
                    isActive ? "nav-link active" : "nav-link"
                  }
                  to="/settings"
                >
                  <i className="nav-icon bi bi-gear" aria-hidden="true" />
                  <p>{t("settings")}</p>
                </NavLink>
              </li>
            </ul>
          </nav>
        </div>
      </aside>
      <main className="app-main">
        <div className="app-content-header">
          <div className="container-fluid">
            <div className="row">
              <div className="col-sm-6">
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
