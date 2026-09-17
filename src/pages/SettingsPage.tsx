import { NotificationCategoryToggles } from "../components/user-settings/NotificationCategoryToggles";
import { useI18n } from "../i18n/I18nProvider";
import type { UserLocale } from "../types/api";
import { NotificationChannelRow } from "./settings/NotificationChannelRow";
import { ProfileAvatarUpload } from "./settings/ProfileAvatarUpload";
import { useSettingsForm } from "./settings/useSettingsForm";

const categoryTogglesClassName = "notification-preference-toggles ms-4 mb-3";

export function SettingsPage() {
  const { t } = useI18n();
  const form = useSettingsForm();
  const { draft, update } = form;

  return (
    <div className="row g-4">
      <div className="col-12">
        <div className="card card-primary card-outline">
          <div className="card-body">
            <ProfileAvatarUpload />
            <div className="mb-3">
              <label className="form-label">{t("nickname")}</label>
              <input
                className="form-control"
                value={draft.nickname}
                onChange={(event) => update({ nickname: event.target.value })}
              />
            </div>
            <div className="mb-3">
              <label className="form-label">{t("hostname")}</label>
              <input
                className="form-control"
                value={draft.hostname}
                onChange={(event) => update({ hostname: event.target.value })}
              />
            </div>
            <div className="mb-3">
              <label className="form-label">{t("locale")}</label>
              <select
                className="form-select"
                value={draft.locale}
                onChange={(event) =>
                  update({ locale: event.target.value as UserLocale })
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
                checked={draft.mailNotificationsEnabled}
                onChange={(event) =>
                  update({ mailNotificationsEnabled: event.target.checked })
                }
              />
              <label className="form-check-label" htmlFor="mail-notifications">
                {t("mailNotifications")}
              </label>
            </div>
            {draft.mailNotificationsEnabled ? (
              <NotificationCategoryToggles
                medium="mail"
                preferences={draft.notificationPreferences}
                className={categoryTogglesClassName}
                onToggle={form.toggleCategory}
              />
            ) : null}
            <NotificationChannelRow
              id="irc-notifications"
              label={t("ircNotifications")}
              enabled={draft.ircNotificationsEnabled}
              onEnabledChange={(enabled) =>
                update({ ircNotificationsEnabled: enabled })
              }
            >
              <label className="form-label" htmlFor="irc-nickname">
                {t("ircNickname")}
              </label>
              <input
                className={
                  form.ircNicknameMissing
                    ? "form-control is-invalid"
                    : "form-control"
                }
                id="irc-nickname"
                value={draft.ircNickname}
                onChange={(event) => update({ ircNickname: event.target.value })}
              />
              {form.ircNicknameMissing ? (
                <div className="invalid-feedback">
                  {t("ircNicknameRequired")}
                </div>
              ) : null}
            </NotificationChannelRow>
            {draft.ircNotificationsEnabled ? (
              <NotificationCategoryToggles
                medium="irc"
                preferences={draft.notificationPreferences}
                className={categoryTogglesClassName}
                onToggle={form.toggleCategory}
              />
            ) : null}
            <NotificationChannelRow
              id="webhook-notifications"
              label={t("webhookNotifications")}
              enabled={draft.webhookNotificationsEnabled}
              onEnabledChange={(enabled) =>
                update({ webhookNotificationsEnabled: enabled })
              }
            >
              <label className="form-label" htmlFor="webhook-url">
                {t("webhookUrl")}
              </label>
              <input
                className={
                  form.webhookInvalid
                    ? "form-control is-invalid"
                    : "form-control"
                }
                id="webhook-url"
                type="url"
                placeholder="https://chat.company.tld/hooks/..."
                value={draft.webhookUrl}
                onChange={(event) => update({ webhookUrl: event.target.value })}
              />
              {form.webhookInvalid ? (
                <div className="invalid-feedback">{t("webhookUrlInvalid")}</div>
              ) : (
                <div className="form-text">{t("webhookUrlHelp")}</div>
              )}
            </NotificationChannelRow>
            {draft.webhookNotificationsEnabled ? (
              <NotificationCategoryToggles
                medium="webhook"
                preferences={draft.notificationPreferences}
                className={categoryTogglesClassName}
                onToggle={form.toggleCategory}
              />
            ) : null}
            {form.settingsError ? (
              <div className="alert alert-danger mb-0">
                {form.settingsError}
              </div>
            ) : null}
          </div>
          {form.canSave ? (
            <div className="card-footer d-flex align-items-center gap-3">
              <button
                className="btn btn-success"
                disabled={form.saving}
                onClick={() => void form.save()}
              >
                {form.saving ? (
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
