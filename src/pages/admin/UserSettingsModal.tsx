import { useState, type ReactNode } from "react";
import { ApiClientError, apiRequest } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import { NotificationCategoryToggles } from "../../components/user-settings/NotificationCategoryToggles";
import {
  draftFromUser,
  ircNicknameRequired,
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
  UserLocale,
  UserSettings,
} from "../../types/api";

const togglesClassName = "notification-preference-toggles ms-4";

type UserSettingsModalProps = {
  user: CurrentUser;
  onClose: () => void;
  onSaved: () => void;
};

function SwitchField({
  id,
  className,
  label,
  checked,
  onChange,
}: {
  id: string;
  className: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className={className}>
      <input
        checked={checked}
        className="form-check-input"
        id={id}
        role="switch"
        type="checkbox"
        onChange={(event) => onChange(event.target.checked)}
      />
      <label className="form-check-label" htmlFor={id}>
        {label}
      </label>
    </div>
  );
}

function TextField({
  id,
  className = "mb-3",
  label,
  value,
  invalid = false,
  type = "text",
  placeholder,
  onChange,
  feedback,
}: {
  id: string;
  className?: string;
  label: string;
  value: string;
  invalid?: boolean;
  type?: string;
  placeholder?: string;
  onChange: (value: string) => void;
  feedback?: ReactNode;
}) {
  return (
    <div className={className}>
      <label className="form-label" htmlFor={id}>
        {label}
      </label>
      <input
        className={invalid ? "form-control is-invalid" : "form-control"}
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {feedback}
    </div>
  );
}

export function UserSettingsModal({
  user,
  onClose,
  onSaved,
}: UserSettingsModalProps) {
  const { idToken } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();
  const [draft, setDraft] = useState<UserSettingsDraft>(
    draftFromUser(user, "EN"),
  );
  const [saving, setSaving] = useState(false);
  const ircNicknameMissing = ircNicknameRequired(draft);
  const webhookInvalid = webhookUrlInvalid(draft);

  const update = (nextDraft: Partial<UserSettingsDraft>) =>
    setDraft((current) => ({ ...current, ...nextDraft }));

  const toggleCategory = (
    medium: NotificationMedium,
    category: NotificationCategory,
  ) => setDraft((current) => withCategoryToggled(current, medium, category));

  const errorLabel = (error: unknown) => {
    if (error instanceof ApiClientError) {
      return t(error.apiError.code);
    }

    return error instanceof Error ? error.message : t("backendError");
  };

  const saveUserSettings = async () => {
    if (!idToken || ircNicknameMissing || webhookInvalid) {
      return;
    }

    setSaving(true);
    try {
      const hostname = draft.hostname.trim();
      await apiRequest<UserSettings>(
        `/admin/users/${user.id}/settings`,
        idToken,
        {
          method: "PATCH",
          body: JSON.stringify({
            nickname: draft.nickname.trim() || null,
            ...(hostname ? { hostname } : {}),
            locale: draft.locale,
            mailNotificationsEnabled: draft.mailNotificationsEnabled,
            ircNotificationsEnabled: draft.ircNotificationsEnabled,
            ircNickname: draft.ircNickname.trim() || null,
            webhookNotificationsEnabled: draft.webhookNotificationsEnabled,
            webhookUrl: draft.webhookUrl.trim() || null,
            notificationPreferences: draft.notificationPreferences,
          }),
        },
      );
      showToast(t("userSettingsSaved"));
      onSaved();
      onClose();
    } catch (error) {
      showToast(errorLabel(error));
    } finally {
      setSaving(false);
    }
  };

  const categoryToggles = (medium: NotificationMedium, margin: string) => (
    <NotificationCategoryToggles
      idPrefix="user-settings-"
      medium={medium}
      preferences={draft.notificationPreferences}
      className={`${togglesClassName} ${margin}`}
      onToggle={toggleCategory}
    />
  );

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
              <TextField
                id="user-settings-nickname"
                label={t("nickname")}
                value={draft.nickname}
                onChange={(nickname) => update({ nickname })}
              />
              <TextField
                id="user-settings-hostname"
                label={t("hostname")}
                value={draft.hostname}
                onChange={(hostname) => update({ hostname })}
              />
              <div className="mb-3">
                <label className="form-label" htmlFor="user-settings-locale">
                  {t("locale")}
                </label>
                <select
                  className="form-select"
                  id="user-settings-locale"
                  value={draft.locale}
                  onChange={(event) =>
                    update({ locale: event.target.value as UserLocale })
                  }
                >
                  <option value="FR">FR</option>
                  <option value="EN">EN</option>
                </select>
              </div>
              <SwitchField
                id="user-settings-mail-notifications"
                className="form-check form-switch mb-2"
                label={t("mailNotifications")}
                checked={draft.mailNotificationsEnabled}
                onChange={(enabled) =>
                  update({ mailNotificationsEnabled: enabled })
                }
              />
              {draft.mailNotificationsEnabled
                ? categoryToggles("mail", "mb-3")
                : null}
              <SwitchField
                id="user-settings-irc-notifications"
                className="form-check form-switch mb-2"
                label={t("ircNotifications")}
                checked={draft.ircNotificationsEnabled}
                onChange={(enabled) =>
                  update({ ircNotificationsEnabled: enabled })
                }
              />
              {draft.ircNotificationsEnabled ? (
                <>
                  <TextField
                    id="user-settings-irc-nickname"
                    className="mb-2"
                    label={t("ircNickname")}
                    value={draft.ircNickname}
                    invalid={ircNicknameMissing}
                    onChange={(ircNickname) => update({ ircNickname })}
                    feedback={
                      ircNicknameMissing ? (
                        <div className="invalid-feedback">
                          {t("ircNicknameRequired")}
                        </div>
                      ) : null
                    }
                  />
                  {categoryToggles("irc", "mb-0")}
                </>
              ) : null}
              <SwitchField
                id="user-settings-webhook-notifications"
                className="form-check form-switch mb-2 mt-2"
                label={t("webhookNotifications")}
                checked={draft.webhookNotificationsEnabled}
                onChange={(enabled) =>
                  update({ webhookNotificationsEnabled: enabled })
                }
              />
              {draft.webhookNotificationsEnabled ? (
                <>
                  <TextField
                    id="user-settings-webhook-url"
                    className="mb-2"
                    label={t("webhookUrl")}
                    type="url"
                    placeholder="https://chat.company.tld/hooks/..."
                    value={draft.webhookUrl}
                    invalid={webhookInvalid}
                    onChange={(webhookUrl) => update({ webhookUrl })}
                    feedback={
                      webhookInvalid ? (
                        <div className="invalid-feedback">
                          {t("webhookUrlInvalid")}
                        </div>
                      ) : (
                        <div className="form-text">{t("webhookUrlHelp")}</div>
                      )
                    }
                  />
                  {categoryToggles("webhook", "mb-0")}
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
                disabled={saving || ircNicknameMissing || webhookInvalid}
                onClick={() => void saveUserSettings()}
              >
                {saving ? (
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
