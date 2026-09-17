import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { apiRequest } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import { websocketUrl } from "../../config";
import { useI18n } from "../../i18n/I18nProvider";
import {
  realtimeNotificationEvent,
  type RealtimeNotificationEvent,
} from "../../realtime/events";
import type { NotificationItem, NotificationPage } from "../../types/api";
import { reviewNotificationPayload } from "./notification-payloads";

/**
 * Connects to the realtime relay and calls `onMessage` for each event,
 * reconnecting with a growing delay until the effect is cleaned up.
 */
function useRealtimeEvents(onMessage: (event: RealtimeNotificationEvent) => void) {
  const { currentUser, idToken } = useAuth();

  useEffect(() => {
    if (!idToken || !currentUser?.id) {
      return;
    }

    let websocket: WebSocket | null = null;
    let reconnectTimeout: number | null = null;
    let reconnectAttempt = 0;
    let closedByEffect = false;

    const websocketEndpoint = `${websocketUrl.replace(/\/$/, "")}/ws`;

    const connect = () => {
      // The token travels as a subprotocol rather than in the query string: a
      // URL ends up in proxy logs and browser history, a header does not.
      websocket = new WebSocket(websocketEndpoint, ["bearer", idToken]);

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

        onMessage(data);
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
}

/**
 * The current user's latest notifications, refreshed on every realtime
 * event. Opening a review marks its notifications as seen.
 */
export function useNotifications() {
  const { currentUser, idToken } = useAuth();
  const { t } = useI18n();
  const location = useLocation();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const loadNotifications = async () => {
    if (!idToken) {
      return;
    }

    const page = await apiRequest<NotificationPage>(
      "/notifications?page=1&pageSize=50",
      idToken,
    );
    setNotifications(page.items);
  };

  const markSeen = async (notificationIds: string[]) => {
    if (!idToken) {
      return;
    }

    await apiRequest("/notifications/seen", idToken, {
      method: "PATCH",
      body: JSON.stringify({ notificationIds }),
    });
    await loadNotifications();
  };

  useEffect(() => {
    void loadNotifications();
  }, [idToken]);

  useEffect(() => {
    if (!idToken || !currentUser?.id) {
      setNotifications([]);
    }
  }, [currentUser?.id, idToken]);

  useRealtimeEvents((event) => {
    void loadNotifications();
    window.dispatchEvent(
      new CustomEvent<RealtimeNotificationEvent>(realtimeNotificationEvent, {
        detail: event,
      }),
    );
  });

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
          reviewNotificationPayload(notification, t)?.reviewId === reviewId,
      )
      .map((notification) => notification.id);
    if (unseenIds.length === 0) {
      return;
    }

    void markSeen(unseenIds);
  }, [idToken, location.pathname, notifications]);

  const markAllSeen = async () => {
    const unseenIds = notifications
      .filter((notification) => !notification.seen)
      .map((notification) => notification.id);
    if (!idToken || unseenIds.length === 0) {
      return;
    }

    await markSeen(unseenIds);
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
    await markSeen([notificationId]);
  };

  return {
    notifications,
    unreadCount: notifications.filter((notification) => !notification.seen)
      .length,
    markAllSeen,
    markNotificationSeen,
  };
}

export type Notifications = ReturnType<typeof useNotifications>;
