import type { useI18n } from "../../i18n/I18nProvider";
import type { NotificationItem } from "../../types/api";

type Translate = ReturnType<typeof useI18n>["t"];

const stringOrNull = (value: unknown) =>
  typeof value === "string" ? value : null;

export const textNotificationPayload = (notification: NotificationItem) => {
  if (
    notification.type !== "TEXT" ||
    typeof notification.payload !== "object" ||
    notification.payload === null
  ) {
    return null;
  }

  const payload = notification.payload as Record<string, unknown>;
  return {
    title: stringOrNull(payload.title),
    message: stringOrNull(payload.message),
  };
};

const reviewNotificationTypes: ReadonlySet<string> = new Set([
  "REVIEW_PENDING",
  "REVIEW_STATUS_CHANGED",
  "COMMIT_REVIEWED",
  "COMMENT_RECEIVED",
  "COMMENT_MENTION",
  "REVIEW_NEW_VERSION",
] satisfies NotificationItem["type"][]);

export const reviewNotificationPayload = (
  notification: NotificationItem,
  t: Translate,
) => {
  if (
    !reviewNotificationTypes.has(notification.type) ||
    typeof notification.payload !== "object" ||
    notification.payload === null
  ) {
    return null;
  }

  const payload = notification.payload as Record<string, unknown>;
  const reviewId = stringOrNull(payload.reviewId);
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
    ownerEmail: stringOrNull(payload.ownerEmail),
    sourceProject: stringOrNull(payload.sourceProject),
    actorEmail: stringOrNull(payload.actorEmail),
    actorNickname: stringOrNull(payload.actorNickname),
    addedAsReviewer: payload.addedAsReviewer === true,
  };
};

export type ReviewNotificationPayload = NonNullable<
  ReturnType<typeof reviewNotificationPayload>
>;

const notificationTitleKeys = {
  TEXT: "notificationText",
  REVIEW_PENDING: "notificationReviewPending",
  REVIEW_STATUS_CHANGED: "notificationReviewStatusChanged",
  COMMIT_REVIEWED: "notificationCommitReviewed",
  COMMENT_RECEIVED: "notificationCommentReceived",
  COMMENT_MENTION: "notificationCommentMention",
  REVIEW_NEW_VERSION: "notificationReviewNewVersion",
} as const satisfies Record<NotificationItem["type"], string>;

export const notificationTitle = (
  notification: NotificationItem,
  t: Translate,
) =>
  textNotificationPayload(notification)?.title ||
  t(notificationTitleKeys[notification.type] ?? "notifications");

/** Who the review line names: the actor of the event, or the review owner. */
export const notificationActor = (
  notification: NotificationItem,
  payload: ReviewNotificationPayload,
) =>
  notification.type === "REVIEW_PENDING"
    ? payload.ownerEmail
    : payload.actorNickname || payload.actorEmail;

const actorLabelKeys = {
  REVIEW_STATUS_CHANGED: "updatedBy",
  COMMIT_REVIEWED: "reviewedBy",
  COMMENT_RECEIVED: "commentedBy",
  COMMENT_MENTION: "mentionedBy",
  REVIEW_NEW_VERSION: "syncedBy",
} as const;

export const notificationActorLabel = (
  notification: NotificationItem,
  t: Translate,
) =>
  t(
    actorLabelKeys[notification.type as keyof typeof actorLabelKeys] ??
      "openedBy",
  );
