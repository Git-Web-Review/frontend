import { useState } from "react";
import { ApiClientError, apiRequest } from "../../../api/client";
import { useAuth } from "../../../auth/AuthProvider";
import { RefreshButton } from "../../../components/RefreshButton";
import { useI18n } from "../../../i18n/I18nProvider";
import { useToast } from "../../../layout/ToastProvider";
import type { GlobalSettings } from "../../../types/api";

type CronDraft = {
  notificationPurgeEnabled: boolean;
  notificationPurgeIntervalMinutes: string;
  notificationPurgeAfterDays: string;
  reviewAutoCloseEnabled: boolean;
  reviewAutoCloseIntervalMinutes: string;
};

const cronDraftFromSettings = (settings: GlobalSettings): CronDraft => ({
  notificationPurgeEnabled: settings.notificationPurgeEnabled,
  notificationPurgeIntervalMinutes: String(
    settings.notificationPurgeIntervalMinutes,
  ),
  notificationPurgeAfterDays: String(settings.notificationPurgeAfterDays),
  reviewAutoCloseEnabled: settings.reviewAutoCloseEnabled,
  reviewAutoCloseIntervalMinutes: String(
    settings.reviewAutoCloseIntervalMinutes,
  ),
});

const parseCronNumber = (value: string): number | null => {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
};

type CronsTabProps = {
  settings: GlobalSettings;
  loadingSettings: boolean;
  onReload: () => Promise<void>;
};

export function CronsTab({ settings, loadingSettings, onReload }: CronsTabProps) {
  const { idToken } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();
  const [cronDraft, setCronDraft] = useState<CronDraft>(
    cronDraftFromSettings(settings),
  );
  const [savedCronKey, setSavedCronKey] = useState(
    JSON.stringify(cronDraftFromSettings(settings)),
  );
  const [savingCron, setSavingCron] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const errorLabel = (error: unknown) => {
    if (error instanceof ApiClientError) {
      return t(error.apiError.code);
    }

    return error instanceof Error ? error.message : t("backendError");
  };

  const updateCronDraft = (nextDraft: Partial<CronDraft>) =>
    setCronDraft((current) => ({ ...current, ...nextDraft }));

  const hasCronChanges = JSON.stringify(cronDraft) !== savedCronKey;

  const cronDraftValid =
    parseCronNumber(cronDraft.notificationPurgeIntervalMinutes) !== null &&
    parseCronNumber(cronDraft.notificationPurgeAfterDays) !== null &&
    parseCronNumber(cronDraft.reviewAutoCloseIntervalMinutes) !== null;

  const saveCronSettings = async () => {
    if (!idToken || !hasCronChanges || !cronDraftValid) {
      return;
    }

    setSavingCron(true);
    setErrorMessage("");
    try {
      const nextSettings = await apiRequest<GlobalSettings>(
        "/v1/admin/settings",
        idToken,
        {
          method: "PATCH",
          body: JSON.stringify({
            notificationPurgeEnabled: cronDraft.notificationPurgeEnabled,
            notificationPurgeIntervalMinutes: parseCronNumber(
              cronDraft.notificationPurgeIntervalMinutes,
            ),
            notificationPurgeAfterDays: parseCronNumber(
              cronDraft.notificationPurgeAfterDays,
            ),
            reviewAutoCloseEnabled: cronDraft.reviewAutoCloseEnabled,
            reviewAutoCloseIntervalMinutes: parseCronNumber(
              cronDraft.reviewAutoCloseIntervalMinutes,
            ),
          }),
        },
      );
      setCronDraft(cronDraftFromSettings(nextSettings));
      setSavedCronKey(JSON.stringify(cronDraftFromSettings(nextSettings)));
      showToast(t("cronSettingsSaved"));
      await onReload();
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setSavingCron(false);
    }
  };

  return (
    <div className="col-12">
      <div className="card card-warning card-outline h-100">
        <div className="card-header d-flex flex-wrap align-items-center justify-content-between gap-3">
          <h3 className="card-title">{t("cronJobs")}</h3>
          <RefreshButton
            disabled={!idToken}
            loading={loadingSettings}
            onClick={() => void onReload()}
          />
        </div>
        <div className="card-body d-flex flex-column gap-4">
          {errorMessage ? (
            <div className="alert alert-danger">{errorMessage}</div>
          ) : null}
          <div>
            <div className="form-check form-switch">
              <input
                className="form-check-input"
                type="checkbox"
                role="switch"
                id="cron-notification-purge-enabled"
                checked={cronDraft.notificationPurgeEnabled}
                onChange={(event) =>
                  updateCronDraft({
                    notificationPurgeEnabled: event.target.checked,
                  })
                }
              />
              <label
                className="form-check-label fw-semibold"
                htmlFor="cron-notification-purge-enabled"
              >
                {t("cronNotificationPurge")}
              </label>
            </div>
            <p className="text-secondary small mb-2">
              {t("cronNotificationPurgeHelp")}
            </p>
            {cronDraft.notificationPurgeEnabled ? (
              <div className="row g-3 ms-4">
                <div className="col-12 col-sm-6 col-lg-3">
                  <label
                    className="form-label"
                    htmlFor="cron-notification-purge-interval"
                  >
                    {t("cronIntervalMinutes")}
                  </label>
                  <input
                    className={`form-control ${parseCronNumber(cronDraft.notificationPurgeIntervalMinutes) === null ? "is-invalid" : ""}`}
                    id="cron-notification-purge-interval"
                    type="number"
                    min={1}
                    value={cronDraft.notificationPurgeIntervalMinutes}
                    onChange={(event) =>
                      updateCronDraft({
                        notificationPurgeIntervalMinutes: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="col-12 col-sm-6 col-lg-3">
                  <label
                    className="form-label"
                    htmlFor="cron-notification-purge-days"
                  >
                    {t("cronRetentionDays")}
                  </label>
                  <input
                    className={`form-control ${parseCronNumber(cronDraft.notificationPurgeAfterDays) === null ? "is-invalid" : ""}`}
                    id="cron-notification-purge-days"
                    type="number"
                    min={1}
                    value={cronDraft.notificationPurgeAfterDays}
                    onChange={(event) =>
                      updateCronDraft({
                        notificationPurgeAfterDays: event.target.value,
                      })
                    }
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div>
            <div className="form-check form-switch">
              <input
                className="form-check-input"
                type="checkbox"
                role="switch"
                id="cron-review-auto-close-enabled"
                checked={cronDraft.reviewAutoCloseEnabled}
                onChange={(event) =>
                  updateCronDraft({
                    reviewAutoCloseEnabled: event.target.checked,
                  })
                }
              />
              <label
                className="form-check-label fw-semibold"
                htmlFor="cron-review-auto-close-enabled"
              >
                {t("cronReviewAutoClose")}
              </label>
            </div>
            <p className="text-secondary small mb-2">
              {t("cronReviewAutoCloseHelp")}
            </p>
            {cronDraft.reviewAutoCloseEnabled ? (
              <div className="row g-3 ms-4">
                <div className="col-12 col-sm-6 col-lg-3">
                  <label
                    className="form-label"
                    htmlFor="cron-review-auto-close-interval"
                  >
                    {t("cronIntervalMinutes")}
                  </label>
                  <input
                    className={`form-control ${parseCronNumber(cronDraft.reviewAutoCloseIntervalMinutes) === null ? "is-invalid" : ""}`}
                    id="cron-review-auto-close-interval"
                    type="number"
                    min={1}
                    value={cronDraft.reviewAutoCloseIntervalMinutes}
                    onChange={(event) =>
                      updateCronDraft({
                        reviewAutoCloseIntervalMinutes: event.target.value,
                      })
                    }
                  />
                </div>
              </div>
            ) : null}
          </div>

          {idToken && hasCronChanges ? (
            <div>
              <button
                className="btn btn-success d-inline-flex align-items-center gap-2"
                type="button"
                disabled={savingCron || !cronDraftValid}
                onClick={() => void saveCronSettings()}
              >
                {savingCron ? (
                  <span className="spinner-border spinner-border-sm" />
                ) : (
                  <i className="bi bi-save" aria-hidden="true" />
                )}
                {t("save")}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
