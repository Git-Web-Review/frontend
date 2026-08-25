import { useState } from "react";
import { ApiClientError, apiRequest } from "../../../api/client";
import { useAuth } from "../../../auth/AuthProvider";
import { useI18n } from "../../../i18n/I18nProvider";
import { useToast } from "../../../layout/ToastProvider";
import type { AdminTextNotificationResponse } from "../../../types/api";

export function NotificationsTab() {
  const { idToken } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();
  const [notificationTitle, setNotificationTitle] = useState("");
  const [notificationMessage, setNotificationMessage] = useState("");
  const [sendingNotification, setSendingNotification] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const errorLabel = (error: unknown) => {
    if (error instanceof ApiClientError) {
      return t(error.apiError.code);
    }

    return error instanceof Error ? error.message : t("backendError");
  };

  const sendTextNotification = async () => {
    const text = notificationMessage.trim();
    if (!idToken || !text) {
      return;
    }

    setSendingNotification(true);
    setErrorMessage("");
    try {
      const response = await apiRequest<AdminTextNotificationResponse>(
        "/v1/admin/notifications/text",
        idToken,
        {
          method: "POST",
          body: JSON.stringify({
            title: notificationTitle.trim() || null,
            message: text,
          }),
        },
      );
      setNotificationTitle("");
      setNotificationMessage("");
      showToast(
        t("textNotificationSent").replace(
          "{count}",
          response.deliveredCount.toString(),
        ),
      );
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setSendingNotification(false);
    }
  };

  return (
    <div className="col-12">
      <div className="card card-info card-outline">
        <div className="card-header">
          <h3 className="card-title">{t("sendTextNotification")}</h3>
        </div>
        <div className="card-body">
          {errorMessage ? (
            <div className="alert alert-danger">{errorMessage}</div>
          ) : null}
          <div className="mb-3">
            <label className="form-label" htmlFor="notification-title">
              {t("notificationTitle")}
            </label>
            <input
              className="form-control"
              id="notification-title"
              value={notificationTitle}
              onChange={(event) => setNotificationTitle(event.target.value)}
            />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="notification-message">
              {t("notificationMessage")}
            </label>
            <textarea
              className="form-control"
              id="notification-message"
              rows={5}
              value={notificationMessage}
              onChange={(event) => setNotificationMessage(event.target.value)}
            />
          </div>
          <button
            className="btn btn-info d-inline-flex align-items-center gap-2"
            type="button"
            disabled={!notificationMessage.trim() || sendingNotification}
            onClick={() => void sendTextNotification()}
          >
            {sendingNotification ? (
              <span className="spinner-border spinner-border-sm" />
            ) : (
              <i className="bi bi-send" aria-hidden="true" />
            )}
            {t("sendNotification")}
          </button>
        </div>
      </div>
    </div>
  );
}
