import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useI18n } from "../i18n/I18nProvider";
import type { NotificationFormatMedium, UserLocale } from "../types/api";
import { NotificationChannelRow } from "./settings/NotificationChannelRow";
import { NotificationFormatModal } from "./settings/NotificationFormatModal";
import { ProfileAvatarUpload } from "./settings/ProfileAvatarUpload";
import { useSettingsForm } from "./settings/useSettingsForm";
import { WebhookUrlField } from "./settings/WebhookUrlField";

export function SettingsPage() {
  const { t } = useI18n();
  const { currentUser } = useAuth();
  const form = useSettingsForm();
  const { draft, update } = form;
  const [formatMedium, setFormatMedium] =
    useState<NotificationFormatMedium | null>(null);

  const formatButton = (medium: NotificationFormatMedium) => (
    <button
      className="btn btn-outline-secondary"
      type="button"
      onClick={() => setFormatMedium(medium)}
    >
      {t("formatOpen")}
    </button>
  );

  const unsetChannels = [
    form.ircNicknameMissing ? "IRC" : null,
    form.webhookInvalid ? "Webhook" : null,
  ].filter(Boolean);

  return (
    <div className="settings-page">
      <section>
        <div className="settings-subhead">
          <h2>{t("profile")}</h2>
        </div>
        <div className="settings-profile">
          <div className="settings-profile-fields">
            <div>
              <label className="form-label" htmlFor="settings-nickname">
                {t("nickname")}
              </label>
              <input
                className="form-control"
                id="settings-nickname"
                value={draft.nickname}
                onChange={(event) => update({ nickname: event.target.value })}
              />
              <div className="form-text">{t("nicknameHelp")}</div>
            </div>
            <div>
              <label className="form-label" htmlFor="settings-email">
                {t("email")}
              </label>
              <input
                className="form-control"
                id="settings-email"
                value={currentUser?.email ?? ""}
                readOnly
              />
            </div>
            <div>
              <label className="form-label" htmlFor="settings-hostname">
                {t("hostname")}
              </label>
              <input
                className="form-control font-monospace"
                id="settings-hostname"
                value={draft.hostname}
                onChange={(event) => update({ hostname: event.target.value })}
              />
              <div className="form-text">{t("hostnameHelp")}</div>
            </div>
            <div>
              <label className="form-label" htmlFor="settings-locale">
                {t("locale")}
              </label>
              <select
                className="form-select"
                id="settings-locale"
                value={draft.locale}
                onChange={(event) =>
                  update({ locale: event.target.value as UserLocale })
                }
              >
                <option value="FR">Français</option>
                <option value="EN">English</option>
              </select>
            </div>
          </div>
          <ProfileAvatarUpload />
        </div>
      </section>

      <section>
        <div className="settings-subhead">
          <h2>{t("notifications")}</h2>
          <p>{t("notificationsHelp")}</p>
        </div>
        <div className="card">
          <div className="card-header">{t("notifChannels")}</div>
          <NotificationChannelRow
            medium="mail"
            icon="bi-envelope"
            label={t("notifChannelMail")}
            description={t("notifChannelMailDescription", {
              email: currentUser?.email ?? "",
            })}
            enabled={draft.mailNotificationsEnabled}
            needsSetup={false}
            onEnabledChange={(enabled) =>
              update({ mailNotificationsEnabled: enabled })
            }
            preferences={draft.notificationPreferences}
            onToggle={form.toggleCategory}
            action={formatButton("mail")}
          />
          <NotificationChannelRow
            medium="irc"
            icon="bi-chat-left-text"
            label="IRC"
            description={t("notifChannelIrcDescription")}
            enabled={draft.ircNotificationsEnabled}
            needsSetup={form.ircNicknameMissing}
            onEnabledChange={(enabled) =>
              update({ ircNotificationsEnabled: enabled })
            }
            preferences={draft.notificationPreferences}
            onToggle={form.toggleCategory}
            action={formatButton("irc")}
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
          <NotificationChannelRow
            medium="webhook"
            icon="bi-plug"
            label="Webhook"
            description={t("notifChannelWebhookDescription")}
            enabled={draft.webhookNotificationsEnabled}
            needsSetup={form.webhookInvalid}
            onEnabledChange={(enabled) =>
              update({ webhookNotificationsEnabled: enabled })
            }
            preferences={draft.notificationPreferences}
            onToggle={form.toggleCategory}
          >
            <WebhookUrlField
              value={draft.webhookUrl}
              invalid={form.webhookInvalid}
              onChange={(webhookUrl) => update({ webhookUrl })}
            />
          </NotificationChannelRow>
        </div>
      </section>

      {form.settingsError ? (
        <div className="alert alert-danger mb-0">{form.settingsError}</div>
      ) : null}

      {form.hasChanges ? (
        <div className="settings-savebar">
          <span className="settings-savebar-dot" aria-hidden="true" />
          <span>
            {unsetChannels.length
              ? t("settingsFinishSetup", { channels: unsetChannels.join(", ") })
              : t("settingsUnsavedChanges")}
          </span>
          <div className="d-flex gap-2 ms-auto">
            <button
              className="btn btn-outline-secondary"
              type="button"
              disabled={form.saving}
              onClick={form.reset}
            >
              {t("settingsDiscard")}
            </button>
            <button
              className="btn btn-success"
              type="button"
              disabled={!form.canSave || form.saving}
              onClick={() => void form.save()}
            >
              {form.saving ? (
                <span className="spinner-border spinner-border-sm me-2" />
              ) : null}
              {t("save")}
            </button>
          </div>
        </div>
      ) : null}

      {formatMedium ? (
        <NotificationFormatModal
          medium={formatMedium}
          formats={draft.notificationFormats}
          onChange={(type, format) =>
            form.setFormat(formatMedium, type, format)
          }
          onClose={() => setFormatMedium(null)}
        />
      ) : null}
    </div>
  );
}
