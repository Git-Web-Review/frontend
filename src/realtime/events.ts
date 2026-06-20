export const realtimeNotificationEvent = "git-web-review:notification";

export type RealtimeNotificationEvent = {
  type?: string;
  notificationId?: string;
  payload?: unknown;
  createdAt?: string;
};
