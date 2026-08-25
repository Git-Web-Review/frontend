import { useState } from "react";
import { ApiClientError, apiRequest } from "../../../api/client";
import { useAuth } from "../../../auth/AuthProvider";
import { RefreshButton } from "../../../components/RefreshButton";
import { useI18n } from "../../../i18n/I18nProvider";
import { useToast } from "../../../layout/ToastProvider";
import type { GlobalSettings } from "../../../types/api";

type DomainsTabProps = {
  allowedDomains: string[];
  loadingSettings: boolean;
  onReload: () => Promise<void>;
};

export function DomainsTab({
  allowedDomains: savedAllowedDomains,
  loadingSettings,
  onReload,
}: DomainsTabProps) {
  const { idToken } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();
  const [allowedDomains, setAllowedDomains] = useState(
    savedAllowedDomains.join("\n"),
  );
  const [lastSavedKey, setLastSavedKey] = useState(
    savedAllowedDomains.join("\n"),
  );
  const [savingSettings, setSavingSettings] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const errorLabel = (error: unknown) => {
    if (error instanceof ApiClientError) {
      return t(error.apiError.code);
    }

    return error instanceof Error ? error.message : t("backendError");
  };

  const normalizedAllowedDomains = () => [
    ...new Set(
      allowedDomains
        .split(/[\s,;]+/)
        .map((domain) => domain.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];

  const hasAllowedDomainChanges =
    normalizedAllowedDomains().join("\n") !== lastSavedKey;

  const saveGlobalSettings = async () => {
    if (!idToken) {
      return;
    }

    setSavingSettings(true);
    setErrorMessage("");
    try {
      const settings = await apiRequest<GlobalSettings>(
        "/v1/admin/settings",
        idToken,
        {
          method: "PATCH",
          body: JSON.stringify({
            allowedOAuthDomains: normalizedAllowedDomains(),
          }),
        },
      );
      setAllowedDomains(settings.allowedOAuthDomains.join("\n"));
      setLastSavedKey(settings.allowedOAuthDomains.join("\n"));
      showToast(t("allowedDomainsSaved"));
      await onReload();
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="col-12">
      <div className="card card-success card-outline h-100">
        <div className="card-header d-flex flex-wrap align-items-center justify-content-between gap-3">
          <h3 className="card-title">{t("allowedDomains")}</h3>
          <RefreshButton
            disabled={!idToken}
            loading={loadingSettings}
            onClick={() => void onReload()}
          />
        </div>
        <div className="card-body">
          {errorMessage ? (
            <div className="alert alert-danger">{errorMessage}</div>
          ) : null}
          <label className="form-label" htmlFor="allowed-domains">
            {t("allowedDomainsList")}
          </label>
          <textarea
            className="form-control font-monospace"
            id="allowed-domains"
            rows={5}
            value={allowedDomains}
            onChange={(event) => setAllowedDomains(event.target.value)}
            placeholder="company.com"
          />
          <p className="text-secondary small mt-2 mb-3">
            {t("allowedDomainsHelp")}
          </p>
          {idToken && hasAllowedDomainChanges ? (
            <button
              className="btn btn-success d-inline-flex align-items-center gap-2"
              type="button"
              disabled={savingSettings}
              onClick={() => void saveGlobalSettings()}
            >
              {savingSettings ? (
                <span className="spinner-border spinner-border-sm" />
              ) : (
                <i className="bi bi-save" aria-hidden="true" />
              )}
              {t("save")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
