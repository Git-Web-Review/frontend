import type { TranslationKey } from "../../i18n/translations";
import type {
  CurrentUser,
  NotificationCategory,
  NotificationMedium,
  NotificationPreferences,
  UserLocale,
} from "../../types/api";

/** The settings a user edits, as the form holds them. */
export type UserSettingsDraft = {
  nickname: string;
  hostname: string;
  locale: UserLocale;
  mailNotificationsEnabled: boolean;
  ircNotificationsEnabled: boolean;
  ircNickname: string;
  webhookNotificationsEnabled: boolean;
  webhookUrl: string;
  notificationPreferences: NotificationPreferences;
};

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  "reviewStarted",
  "reviewPending",
  "reviewDone",
  "reviewAcked",
  "reviewClosed",
  "commentReceived",
  "commentMention",
];

export const NOTIFICATION_CATEGORY_LABELS: Record<
  NotificationCategory,
  TranslationKey
> = {
  reviewStarted: "notifCategoryReviewStarted",
  reviewPending: "notifCategoryReviewPending",
  reviewDone: "notifCategoryReviewDone",
  reviewAcked: "notifCategoryReviewAcked",
  reviewClosed: "notifCategoryReviewClosed",
  commentReceived: "notifCategoryCommentReceived",
  commentMention: "notifCategoryCommentMention",
};

// The relay only ever posts over HTTP, so anything else is rejected here
// rather than by the backend with a generic validation message.
const isHttpUrl = (value: string) => {
  try {
    const { protocol } = new URL(value.trim());
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
};

export const draftFromUser = (
  user: CurrentUser | null,
  defaultLocale: UserLocale,
): UserSettingsDraft => ({
  nickname: user?.settings?.nickname ?? "",
  hostname: user?.hostname ?? "",
  locale: user?.settings?.locale ?? defaultLocale,
  mailNotificationsEnabled: user?.settings?.mailNotificationsEnabled ?? false,
  ircNotificationsEnabled: user?.settings?.ircNotificationsEnabled ?? false,
  ircNickname: user?.settings?.ircNickname ?? "",
  webhookNotificationsEnabled:
    user?.settings?.webhookNotificationsEnabled ?? false,
  webhookUrl: user?.settings?.webhookUrl ?? "",
  notificationPreferences: user?.settings?.notificationPreferences ?? {},
});

export const userSettingsDraftChanged = (
  draft: UserSettingsDraft,
  baseline: UserSettingsDraft,
) =>
  draft.nickname !== baseline.nickname ||
  draft.hostname !== baseline.hostname ||
  draft.locale !== baseline.locale ||
  draft.mailNotificationsEnabled !== baseline.mailNotificationsEnabled ||
  draft.ircNotificationsEnabled !== baseline.ircNotificationsEnabled ||
  draft.ircNickname !== baseline.ircNickname ||
  draft.webhookNotificationsEnabled !== baseline.webhookNotificationsEnabled ||
  draft.webhookUrl !== baseline.webhookUrl ||
  JSON.stringify(draft.notificationPreferences) !==
    JSON.stringify(baseline.notificationPreferences);

/** IRC notifications need a nickname to be sent to. */
export const ircNicknameRequired = (draft: UserSettingsDraft) =>
  draft.ircNotificationsEnabled && !draft.ircNickname.trim();

export const webhookUrlInvalid = (draft: UserSettingsDraft) =>
  draft.webhookNotificationsEnabled && !isHttpUrl(draft.webhookUrl);

/** A category nobody set is on. */
export const categoryEnabled = (
  preferences: NotificationPreferences,
  medium: NotificationMedium,
  category: NotificationCategory,
) => preferences[medium]?.[category] ?? true;

export const withCategoryToggled = (
  draft: UserSettingsDraft,
  medium: NotificationMedium,
  category: NotificationCategory,
): UserSettingsDraft => ({
  ...draft,
  notificationPreferences: {
    ...draft.notificationPreferences,
    [medium]: {
      ...draft.notificationPreferences[medium],
      [category]: !categoryEnabled(
        draft.notificationPreferences,
        medium,
        category,
      ),
    },
  },
});
