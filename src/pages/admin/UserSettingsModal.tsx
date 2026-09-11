import { useState } from "react";
import { ApiClientError, apiRequest } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import { useI18n } from "../../i18n/I18nProvider";
import type { TranslationKey } from "../../i18n/translations";
import { useToast } from "../../layout/ToastProvider";
import type {
  CurrentUser,
  NotificationCategory,
  NotificationMedium,
  NotificationPreferences,
  UserLocale,
  UserSettings,
} from "../../types/api";

const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  "reviewStarted",
  "reviewPending",
  "reviewDone",
  "reviewAcked",
  "reviewClosed",
  "commentReceived",
];

const NOTIFICATION_CATEGORY_LABELS: Record<
  NotificationCategory,
  TranslationKey
> = {
  reviewStarted: "notifCategoryReviewStarted",
  reviewPending: "notifCategoryReviewPending",
  reviewDone: "notifCategoryReviewDone",
  reviewAcked: "notifCategoryReviewAcked",
  reviewClosed: "notifCategoryReviewClosed",
  commentReceived: "notifCategoryCommentReceived",
};

type UserSettingsDraft = {
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

const draftFromUser = (user: CurrentUser): UserSettingsDraft => ({
  nickname: user.settings?.nickname ?? "",
  hostname: user.hostname,
  locale: user.settings?.locale ?? "EN",
  mailNotificationsEnabled: user.settings?.mailNotificationsEnabled ?? false,
  ircNotificationsEnabled: user.settings?.ircNotificationsEnabled ?? false,
  ircNickname: user.settings?.ircNickname ?? "",
  webhookNotificationsEnabled:
    user.settings?.webhookNotificationsEnabled ?? false,
  webhookUrl: user.settings?.webhookUrl ?? "",
  notificationPreferences: user.settings?.notificationPreferences ?? {},
});

type UserSettingsModalProps = {
  user: CurrentUser;
  onClose: () => void;
  onSaved: () => void;
};

export function UserSettingsModal({
  user,
  onClose,
  onSaved,
}: UserSettingsModalProps) {
  const { idToken } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();
  const [userSettingsDraft, setUserSettingsDraft] = useState<UserSettingsDraft>(
    draftFromUser(user),
  );
  const [savingUserSettings, setSavingUserSettings] = useState(false);

  const errorLabel = (error: unknown) => {
    if (error instanceof ApiClientError) {
      return t(error.apiError.code);
    }

    return error instanceof Error ? error.message : t("backendError");
  };

  const draftIrcNicknameRequired =
    userSettingsDraft.ircNotificationsEnabled &&
    !userSettingsDraft.ircNickname.trim();

  const draftWebhookUrlInvalid =
    userSettingsDraft.webhookNotificationsEnabled &&
    !isHttpUrl(userSettingsDraft.webhookUrl);

  const draftCategoryEnabled = (
    medium: NotificationMedium,
    category: NotificationCategory,
  ) => userSettingsDraft.notificationPreferences[medium]?.[category] ?? true;

  const toggleDraftCategory = (
    medium: NotificationMedium,
    category: NotificationCategory,
  ) =>
    setUserSettingsDraft((draft) => ({
      ...draft,
      notificationPreferences: {
        ...draft.notificationPreferences,
        [medium]: {
          ...draft.notificationPreferences[medium],
          [category]: !(draft.notificationPreferences[medium]?.[category] ?? true),
        },
      },
    }));

  const saveUserSettings = async () => {
    if (!idToken || draftIrcNicknameRequired || draftWebhookUrlInvalid) {
      return;
    }

    setSavingUserSettings(true);
    try {
      const hostname = userSettingsDraft.hostname.trim();
      await apiRequest<UserSettings>(
        `/v1/admin/users/${user.id}/settings`,
        idToken,
        {
          method: "PATCH",
          body: JSON.stringify({
            nickname: userSettingsDraft.nickname.trim() || null,
            ...(hostname ? { hostname } : {}),
            locale: userSettingsDraft.locale,
            mailNotificationsEnabled:
              userSettingsDraft.mailNotificationsEnabled,
            ircNotificationsEnabled:
              userSettingsDraft.ircNotificationsEnabled,
            ircNickname: userSettingsDraft.ircNickname.trim() || null,
            webhookNotificationsEnabled:
              userSettingsDraft.webhookNotificationsEnabled,
            webhookUrl: userSettingsDraft.webhookUrl.trim() || null,
            notificationPreferences: userSettingsDraft.notificationPreferences,
          }),
        },
      );
      showToast(t("userSettingsSaved"));
      onSaved();
      onClose();
    } catch (error) {
      showToast(errorLabel(error));
    } finally {
      setSavingUserSettings(false);
    }
  };

  return (
    <>
      <div className="modal d-block" role="dialog" aria-modal="true">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h5 className="modal-title">{t("editUserSettings")}</h5>
                <div className="small text-secondary text-break">
                  {user.email}
                </div>
              </div>
              <button
                className="btn-close"
                type="button"
                aria-label="Close"
                onClick={onClose}
              />
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label" htmlFor="user-settings-nickname">
                  {t("nickname")}
                </label>
                <input
                  className="form-control"
                  id="user-settings-nickname"
                  type="text"
                  value={userSettingsDraft.nickname}
                  onChange={(event) =>
                    setUserSettingsDraft((draft) => ({
                      ...draft,
                      nickname: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="user-settings-hostname">
                  {t("hostname")}
                </label>
                <input
                  className="form-control"
                  id="user-settings-hostname"
                  type="text"
                  value={userSettingsDraft.hostname}
                  onChange={(event) =>
                    setUserSettingsDraft((draft) => ({
                      ...draft,
                      hostname: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="user-settings-locale">
                  {t("locale")}
                </label>
                <select
                  className="form-select"
                  id="user-settings-locale"
                  value={userSettingsDraft.locale}
                  onChange={(event) =>
                    setUserSettingsDraft((draft) => ({
                      ...draft,
                      locale: event.target.value as UserLocale,
                    }))
                  }
                >
                  <option value="FR">FR</option>
                  <option value="EN">EN</option>
                </select>
              </div>
              <div className="form-check form-switch mb-2">
                <input
                  checked={userSettingsDraft.mailNotificationsEnabled}
                  className="form-check-input"
                  id="user-settings-mail-notifications"
                  role="switch"
                  type="checkbox"
                  onChange={(event) =>
                    setUserSettingsDraft((draft) => ({
                      ...draft,
                      mailNotificationsEnabled: event.target.checked,
                    }))
                  }
                />
                <label
                  className="form-check-label"
                  htmlFor="user-settings-mail-notifications"
                >
                  {t("mailNotifications")}
                </label>
              </div>
              {userSettingsDraft.mailNotificationsEnabled ? (
                <div className="notification-preference-toggles ms-4 mb-3">
                  {NOTIFICATION_CATEGORIES.map((category) => (
                    <div
                      className="form-check form-switch"
                      key={`user-settings-mail-${category}`}
                    >
                      <input
                        checked={draftCategoryEnabled("mail", category)}
                        className="form-check-input"
                        id={`user-settings-mail-${category}`}
                        type="checkbox"
                        onChange={() => toggleDraftCategory("mail", category)}
                      />
                      <label
                        className="form-check-label"
                        htmlFor={`user-settings-mail-${category}`}
                      >
                        {t(NOTIFICATION_CATEGORY_LABELS[category])}
                      </label>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="form-check form-switch mb-2">
                <input
                  checked={userSettingsDraft.ircNotificationsEnabled}
                  className="form-check-input"
                  id="user-settings-irc-notifications"
                  role="switch"
                  type="checkbox"
                  onChange={(event) =>
                    setUserSettingsDraft((draft) => ({
                      ...draft,
                      ircNotificationsEnabled: event.target.checked,
                    }))
                  }
                />
                <label
                  className="form-check-label"
                  htmlFor="user-settings-irc-notifications"
                >
                  {t("ircNotifications")}
                </label>
              </div>
              {userSettingsDraft.ircNotificationsEnabled ? (
                <>
                  <div className="mb-2">
                    <label
                      className="form-label"
                      htmlFor="user-settings-irc-nickname"
                    >
                      {t("ircNickname")}
                    </label>
                    <input
                      className={
                        draftIrcNicknameRequired
                          ? "form-control is-invalid"
                          : "form-control"
                      }
                      id="user-settings-irc-nickname"
                      type="text"
                      value={userSettingsDraft.ircNickname}
                      onChange={(event) =>
                        setUserSettingsDraft((draft) => ({
                          ...draft,
                          ircNickname: event.target.value,
                        }))
                      }
                    />
                    {draftIrcNicknameRequired ? (
                      <div className="invalid-feedback">
                        {t("ircNicknameRequired")}
                      </div>
                    ) : null}
                  </div>
                  <div className="notification-preference-toggles ms-4 mb-0">
                    {NOTIFICATION_CATEGORIES.map((category) => (
                      <div
                        className="form-check form-switch"
                        key={`user-settings-irc-${category}`}
                      >
                        <input
                          checked={draftCategoryEnabled("irc", category)}
                          className="form-check-input"
                          id={`user-settings-irc-${category}`}
                          type="checkbox"
                          onChange={() => toggleDraftCategory("irc", category)}
                        />
                        <label
                          className="form-check-label"
                          htmlFor={`user-settings-irc-${category}`}
                        >
                          {t(NOTIFICATION_CATEGORY_LABELS[category])}
                        </label>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
              <div className="form-check form-switch mb-2 mt-2">
                <input
                  checked={userSettingsDraft.webhookNotificationsEnabled}
                  className="form-check-input"
                  id="user-settings-webhook-notifications"
                  role="switch"
                  type="checkbox"
                  onChange={(event) =>
                    setUserSettingsDraft((draft) => ({
                      ...draft,
                      webhookNotificationsEnabled: event.target.checked,
                    }))
                  }
                />
                <label
                  className="form-check-label"
                  htmlFor="user-settings-webhook-notifications"
                >
                  {t("webhookNotifications")}
                </label>
              </div>
              {userSettingsDraft.webhookNotificationsEnabled ? (
                <>
                  <div className="mb-2">
                    <label
                      className="form-label"
                      htmlFor="user-settings-webhook-url"
                    >
                      {t("webhookUrl")}
                    </label>
                    <input
                      className={
                        draftWebhookUrlInvalid
                          ? "form-control is-invalid"
                          : "form-control"
                      }
                      id="user-settings-webhook-url"
                      type="url"
                      placeholder="https://chat.company.tld/hooks/..."
                      value={userSettingsDraft.webhookUrl}
                      onChange={(event) =>
                        setUserSettingsDraft((draft) => ({
                          ...draft,
                          webhookUrl: event.target.value,
                        }))
                      }
                    />
                    {draftWebhookUrlInvalid ? (
                      <div className="invalid-feedback">
                        {t("webhookUrlInvalid")}
                      </div>
                    ) : (
                      <div className="form-text">{t("webhookUrlHelp")}</div>
                    )}
                  </div>
                  <div className="notification-preference-toggles ms-4 mb-0">
                    {NOTIFICATION_CATEGORIES.map((category) => (
                      <div
                        className="form-check form-switch"
                        key={`user-settings-webhook-${category}`}
                      >
                        <input
                          checked={draftCategoryEnabled("webhook", category)}
                          className="form-check-input"
                          id={`user-settings-webhook-${category}`}
                          type="checkbox"
                          onChange={() =>
                            toggleDraftCategory("webhook", category)
                          }
                        />
                        <label
                          className="form-check-label"
                          htmlFor={`user-settings-webhook-${category}`}
                        >
                          {t(NOTIFICATION_CATEGORY_LABELS[category])}
                        </label>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-outline-secondary"
                type="button"
                onClick={onClose}
              >
                {t("cancel")}
              </button>
              <button
                className="btn btn-primary d-inline-flex align-items-center gap-2"
                type="button"
                disabled={
                  savingUserSettings ||
                  draftIrcNicknameRequired ||
                  draftWebhookUrlInvalid
                }
                onClick={() => void saveUserSettings()}
              >
                {savingUserSettings ? (
                  <span className="spinner-border spinner-border-sm" />
                ) : (
                  <i className="bi bi-check-lg" aria-hidden="true" />
                )}
                {t("save")}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}
