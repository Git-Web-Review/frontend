import { useEffect, useState } from "react";
import { apiRequest } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import {
  draftFromUser,
  ircNicknameRequired,
  userSettingsDraftChanged,
  webhookUrlInvalid,
  withCategoryToggled,
  type UserSettingsDraft,
} from "../../components/user-settings/user-settings-draft";
import { useI18n } from "../../i18n/I18nProvider";
import { useToast } from "../../layout/ToastProvider";
import type {
  CurrentUser,
  NotificationCategory,
  NotificationMedium,
} from "../../types/api";

const nullableText = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

/** The current user's own settings, saved when changed and valid. */
export function useSettingsForm() {
  const { currentUser, idToken, refreshCurrentUser } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();
  const [draft, setDraft] = useState(() => draftFromUser(currentUser, "FR"));
  const [saving, setSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const ircNicknameMissing = ircNicknameRequired(draft);
  const webhookInvalid = webhookUrlInvalid(draft);
  const hasChanges = userSettingsDraftChanged(
    draft,
    draftFromUser(currentUser, "FR"),
  );

  useEffect(() => {
    if (hasChanges) {
      setSettingsError("");
    }
  }, [hasChanges]);

  const update = (nextDraft: Partial<UserSettingsDraft>) =>
    setDraft((current) => ({ ...current, ...nextDraft }));

  const toggleCategory = (
    medium: NotificationMedium,
    category: NotificationCategory,
  ) => setDraft((current) => withCategoryToggled(current, medium, category));

  const save = async () => {
    if (!idToken || !hasChanges || ircNicknameMissing || webhookInvalid) {
      return;
    }

    setSaving(true);
    setSettingsError("");
    try {
      await apiRequest<CurrentUser>("/me/settings", idToken, {
        method: "PATCH",
        body: JSON.stringify({
          nickname: nullableText(draft.nickname),
          hostname: draft.hostname.trim(),
          profileImageUrl: currentUser?.settings?.profileImageUrl ?? null,
          locale: draft.locale,
          mailNotificationsEnabled: draft.mailNotificationsEnabled,
          ircNotificationsEnabled: draft.ircNotificationsEnabled,
          ircNickname: nullableText(draft.ircNickname),
          webhookNotificationsEnabled: draft.webhookNotificationsEnabled,
          webhookUrl: nullableText(draft.webhookUrl),
          notificationPreferences: draft.notificationPreferences,
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

  return {
    draft,
    update,
    toggleCategory,
    ircNicknameMissing,
    webhookInvalid,
    canSave: hasChanges && !!idToken && !ircNicknameMissing && !webhookInvalid,
    saving,
    settingsError,
    save,
  };
}
