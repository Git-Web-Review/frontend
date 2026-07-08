import { useEffect, useRef, useState } from "react";
import { apiRequest, apiRequestBlob } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { useI18n } from "../i18n/I18nProvider";
import type { TranslationKey } from "../i18n/translations";
import { useToast } from "../layout/ToastProvider";
import type {
  CurrentUser,
  NotificationCategory,
  NotificationPreferences,
  UserLocale,
  UserProfileImage,
} from "../types/api";
import { profileInitialsFromEmail } from "../utils/profileInitials";

const nullableText = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

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

export function SettingsPage() {
  const { currentUser, idToken, refreshCurrentUser } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();
  const profileImageInputRef = useRef<HTMLInputElement>(null);
  const [nickname, setNickname] = useState(
    currentUser?.settings?.nickname ?? "",
  );
  const [hostname, setHostname] = useState(currentUser?.hostname ?? "");
  const [locale, setLocale] = useState<UserLocale>(
    currentUser?.settings?.locale ?? "FR",
  );
  const [mailNotificationsEnabled, setMailNotificationsEnabled] = useState(
    currentUser?.settings?.mailNotificationsEnabled ?? false,
  );
  const [ircNotificationsEnabled, setIrcNotificationsEnabled] = useState(
    currentUser?.settings?.ircNotificationsEnabled ?? false,
  );
  const [ircNickname, setIrcNickname] = useState(
    currentUser?.settings?.ircNickname ?? "",
  );
  const [notificationPreferences, setNotificationPreferences] =
    useState<NotificationPreferences>(
      currentUser?.settings?.notificationPreferences ?? {},
    );
  const [saving, setSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [profileImageSrc, setProfileImageSrc] = useState("");
  const [uploadingProfileImage, setUploadingProfileImage] = useState(false);
  const profileInitials = profileInitialsFromEmail(currentUser?.email);

  const currentNickname = currentUser?.settings?.nickname ?? "";
  const currentHostname = currentUser?.hostname ?? "";
  const currentLocale = currentUser?.settings?.locale ?? "FR";
  const currentMailNotificationsEnabled =
    currentUser?.settings?.mailNotificationsEnabled ?? false;
  const currentIrcNotificationsEnabled =
    currentUser?.settings?.ircNotificationsEnabled ?? false;
  const currentIrcNickname = currentUser?.settings?.ircNickname ?? "";
  const currentNotificationPreferences =
    currentUser?.settings?.notificationPreferences ?? {};
  const ircNicknameRequired = ircNotificationsEnabled && !ircNickname.trim();
  const hasSettingsChanges =
    nickname !== currentNickname ||
    hostname !== currentHostname ||
    locale !== currentLocale ||
    mailNotificationsEnabled !== currentMailNotificationsEnabled ||
    ircNotificationsEnabled !== currentIrcNotificationsEnabled ||
    ircNickname !== currentIrcNickname ||
    JSON.stringify(notificationPreferences) !==
      JSON.stringify(currentNotificationPreferences);

  const categoryEnabled = (
    medium: "mail" | "irc",
    category: NotificationCategory,
  ) => notificationPreferences[medium]?.[category] ?? true;

  const toggleCategory = (
    medium: "mail" | "irc",
    category: NotificationCategory,
  ) =>
    setNotificationPreferences((current) => ({
      ...current,
      [medium]: {
        ...current[medium],
        [category]: !(current[medium]?.[category] ?? true),
      },
    }));

  useEffect(() => {
    let objectUrl = "";
    let cancelled = false;

    const loadProfileImage = async () => {
      if (!currentUser) {
        setProfileImageSrc("");
        return;
      }

      if (!currentUser.profileImage || !idToken) {
        setProfileImageSrc(currentUser.settings?.profileImageUrl ?? "");
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
        setProfileImageSrc(objectUrl);
      } catch {
        if (!cancelled) {
          setProfileImageSrc(currentUser.settings?.profileImageUrl ?? "");
        }
      }
    };

    void loadProfileImage();

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

  useEffect(() => {
    if (hasSettingsChanges) {
      setSettingsError("");
    }
  }, [hasSettingsChanges]);

  const save = async () => {
    if (!idToken || !hasSettingsChanges || ircNicknameRequired) {
      return;
    }

    setSaving(true);
    setSettingsError("");
    try {
      await apiRequest<CurrentUser>("/v1/me/settings", idToken, {
        method: "PATCH",
        body: JSON.stringify({
          nickname: nullableText(nickname),
          hostname: hostname.trim(),
          profileImageUrl: currentUser?.settings?.profileImageUrl ?? null,
          locale,
          mailNotificationsEnabled,
          ircNotificationsEnabled,
          ircNickname: nullableText(ircNickname),
          notificationPreferences,
        }),
      });
      await refreshCurrentUser();
      showToast(t("saved"));
    } catch (error) {
      setSettingsError(
        error instanceof Error ? error.message : t("backendError"),
      );
    } finally {
      setSaving(false);
    }
  };

  const uploadProfileImage = async (file?: File) => {
    if (!idToken || !file) {
      return;
    }

    const body = new FormData();
    body.append("file", file);

    setUploadingProfileImage(true);
    try {
      await apiRequest<UserProfileImage>("/v1/me/profile-image", idToken, {
        method: "PATCH",
        body,
      });
      await refreshCurrentUser();
      showToast(t("profileImageSaved"));
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("backendError"), "danger");
    } finally {
      setUploadingProfileImage(false);
      if (profileImageInputRef.current) {
        profileImageInputRef.current.value = "";
      }
    }
  };

  const renderNotificationCategoryToggles = (medium: "mail" | "irc") => (
    <div className="notification-preference-toggles ms-4 mb-3">
      {NOTIFICATION_CATEGORIES.map((category) => (
        <div className="form-check form-switch" key={`${medium}-${category}`}>
          <input
            className="form-check-input"
            id={`${medium}-${category}`}
            type="checkbox"
            checked={categoryEnabled(medium, category)}
            onChange={() => toggleCategory(medium, category)}
          />
          <label
            className="form-check-label"
            htmlFor={`${medium}-${category}`}
          >
            {t(NOTIFICATION_CATEGORY_LABELS[category])}
          </label>
        </div>
      ))}
    </div>
  );

  return (
    <div className="row justify-content-center">
      <div className="col-xl-8 col-xxl-7">
        <div className="card card-primary card-outline">
          <div className="card-body">
            <div className="profile-avatar-panel">
              <button
                className="profile-avatar-button"
                type="button"
                disabled={uploadingProfileImage}
                onClick={() => profileImageInputRef.current?.click()}
              >
                {profileImageSrc ? (
                  <img alt="" src={profileImageSrc} />
                ) : (
                  <span>{profileInitials}</span>
                )}
                <span className="profile-avatar-overlay">
                  {uploadingProfileImage ? (
                    <span className="spinner-border spinner-border-sm" />
                  ) : (
                    <i className="bi bi-camera" aria-hidden="true" />
                  )}
                </span>
              </button>
              <input
                ref={profileImageInputRef}
                className="visually-hidden"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(event) =>
                  void uploadProfileImage(event.target.files?.[0])
                }
              />
              <h3>{t("profile")}</h3>
            </div>
            <div className="mb-3">
              <label className="form-label">{t("nickname")}</label>
              <input
                className="form-control"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
              />
            </div>
            <div className="mb-3">
              <label className="form-label">{t("hostname")}</label>
              <input
                className="form-control"
                value={hostname}
                onChange={(event) => setHostname(event.target.value)}
              />
            </div>
            <div className="mb-3">
              <label className="form-label">{t("locale")}</label>
              <select
                className="form-select"
                value={locale}
                onChange={(event) =>
                  setLocale(event.target.value as UserLocale)
                }
              >
                <option value="FR">Francais</option>
                <option value="EN">English</option>
              </select>
            </div>
            <div className="form-check form-switch mb-3">
              <input
                className="form-check-input"
                id="mail-notifications"
                type="checkbox"
                checked={mailNotificationsEnabled}
                onChange={(event) =>
                  setMailNotificationsEnabled(event.target.checked)
                }
              />
              <label className="form-check-label" htmlFor="mail-notifications">
                {t("mailNotifications")}
              </label>
            </div>
            {mailNotificationsEnabled
              ? renderNotificationCategoryToggles("mail")
              : null}
            <div className="row g-3 mb-3">
              <div className="col-md-5">
                <div
                  className={`form-check form-switch mb-0${
                    ircNotificationsEnabled ? " irc-toggle-align" : ""
                  }`}
                >
                  <input
                    className="form-check-input"
                    id="irc-notifications"
                    type="checkbox"
                    checked={ircNotificationsEnabled}
                    onChange={(event) =>
                      setIrcNotificationsEnabled(event.target.checked)
                    }
                  />
                  <label
                    className="form-check-label"
                    htmlFor="irc-notifications"
                  >
                    {t("ircNotifications")}
                  </label>
                </div>
              </div>
              {ircNotificationsEnabled ? (
                <div className="col-md-7">
                  <label className="form-label" htmlFor="irc-nickname">
                    {t("ircNickname")}
                  </label>
                  <input
                    className={
                      ircNicknameRequired
                        ? "form-control is-invalid"
                        : "form-control"
                    }
                    id="irc-nickname"
                    value={ircNickname}
                    onChange={(event) => setIrcNickname(event.target.value)}
                  />
                  {ircNicknameRequired ? (
                    <div className="invalid-feedback">
                      {t("ircNicknameRequired")}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            {ircNotificationsEnabled
              ? renderNotificationCategoryToggles("irc")
              : null}
            {settingsError ? (
              <div className="alert alert-danger mb-0">{settingsError}</div>
            ) : null}
          </div>
          {hasSettingsChanges && idToken && !ircNicknameRequired ? (
            <div className="card-footer d-flex align-items-center gap-3">
              <button
                className="btn btn-success"
                disabled={saving}
                onClick={() => void save()}
              >
                {saving ? (
                  <span className="spinner-border spinner-border-sm me-2" />
                ) : null}
                {t("save")}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
