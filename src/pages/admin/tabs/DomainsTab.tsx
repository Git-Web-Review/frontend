import { useRef, useState } from "react";
import { ApiClientError, apiRequest } from "../../../api/client";
import { useAuth } from "../../../auth/AuthProvider";
import { useBranding } from "../../../branding/BrandingProvider";
import { RefreshButton } from "../../../components/RefreshButton";
import { useI18n } from "../../../i18n/I18nProvider";
import { useToast } from "../../../layout/ToastProvider";
import type { AppLogo, GlobalSettings } from "../../../types/api";

type DomainsTabProps = {
  allowedDomains: string[];
  appName: string | null;
  loadingSettings: boolean;
  onReload: () => Promise<void>;
};

export function DomainsTab({
  allowedDomains: savedAllowedDomains,
  appName: savedAppName,
  loadingSettings,
  onReload,
}: DomainsTabProps) {
  const { idToken } = useAuth();
  const { t } = useI18n();
  const { logoSrc, reloadBranding } = useBranding();
  const { showToast } = useToast();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [allowedDomains, setAllowedDomains] = useState(
    savedAllowedDomains.join("\n"),
  );
  const [lastSavedKey, setLastSavedKey] = useState(
    savedAllowedDomains.join("\n"),
  );
  const [appName, setAppName] = useState(savedAppName ?? "");
  const [lastSavedAppName, setLastSavedAppName] = useState(savedAppName ?? "");
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingAppName, setSavingAppName] = useState(false);
  const [savingLogo, setSavingLogo] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [brandingError, setBrandingError] = useState("");

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
  const hasAppNameChanges = appName.trim() !== lastSavedAppName;

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

  const saveAppName = async () => {
    if (!idToken) {
      return;
    }

    setSavingAppName(true);
    setBrandingError("");
    try {
      const settings = await apiRequest<GlobalSettings>(
        "/v1/admin/settings",
        idToken,
        {
          method: "PATCH",
          body: JSON.stringify({ appName: appName.trim() || null }),
        },
      );
      setAppName(settings.appName ?? "");
      setLastSavedAppName(settings.appName ?? "");
      showToast(t("appNameSaved"));
      await Promise.all([reloadBranding(), onReload()]);
    } catch (error) {
      setBrandingError(errorLabel(error));
    } finally {
      setSavingAppName(false);
    }
  };

  const uploadLogo = async (file?: File) => {
    if (!idToken || !file) {
      return;
    }

    const body = new FormData();
    body.append("file", file);

    setSavingLogo(true);
    setBrandingError("");
    try {
      await apiRequest<AppLogo>("/v1/admin/settings/logo", idToken, {
        method: "PATCH",
        body,
      });
      showToast(t("appLogoSaved"));
      await reloadBranding();
    } catch (error) {
      setBrandingError(errorLabel(error));
    } finally {
      setSavingLogo(false);
      if (logoInputRef.current) {
        logoInputRef.current.value = "";
      }
    }
  };

  const removeLogo = async () => {
    if (!idToken) {
      return;
    }

    setSavingLogo(true);
    setBrandingError("");
    try {
      await apiRequest("/v1/admin/settings/logo", idToken, {
        method: "DELETE",
      });
      showToast(t("appLogoRemoved"));
      await reloadBranding();
    } catch (error) {
      setBrandingError(errorLabel(error));
    } finally {
      setSavingLogo(false);
    }
  };

  return (
    <>
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

      <div className="col-12">
        <div className="card card-success card-outline h-100">
          <div className="card-header">
            <h3 className="card-title">{t("appBranding")}</h3>
          </div>
          <div className="card-body">
            {brandingError ? (
              <div className="alert alert-danger">{brandingError}</div>
            ) : null}
            <p className="text-secondary small mb-3">{t("appBrandingHelp")}</p>

            <label className="form-label" htmlFor="app-logo">
              {t("appLogoLabel")}
            </label>
            <div className="app-logo-picker mb-2">
              <span className="app-logo-preview">
                {logoSrc ? (
                  <img alt="" src={logoSrc} />
                ) : (
                  <span className="text-secondary small">
                    {t("appLogoNone")}
                  </span>
                )}
              </span>
              <button
                className="btn btn-outline-secondary d-inline-flex align-items-center gap-2"
                type="button"
                disabled={!idToken || savingLogo}
                onClick={() => logoInputRef.current?.click()}
              >
                {savingLogo ? (
                  <span className="spinner-border spinner-border-sm" />
                ) : (
                  <i className="bi bi-image" aria-hidden="true" />
                )}
                {t("appLogoChoose")}
              </button>
              {logoSrc ? (
                <button
                  className="btn btn-outline-danger d-inline-flex align-items-center gap-2"
                  type="button"
                  disabled={!idToken || savingLogo}
                  onClick={() => void removeLogo()}
                >
                  <i className="bi bi-trash" aria-hidden="true" />
                  {t("appLogoRemove")}
                </button>
              ) : null}
            </div>
            <input
              ref={logoInputRef}
              className="visually-hidden"
              id="app-logo"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
              onChange={(event) => void uploadLogo(event.target.files?.[0])}
            />
            <p className="text-secondary small mt-2 mb-3">{t("appLogoHelp")}</p>

            <label className="form-label" htmlFor="app-name">
              {t("appNameLabel")}
            </label>
            <input
              className="form-control"
              id="app-name"
              maxLength={60}
              value={appName}
              onChange={(event) => setAppName(event.target.value)}
              placeholder={t("appName")}
            />
            <p className="text-secondary small mt-2 mb-3">{t("appNameHelp")}</p>
            {idToken && hasAppNameChanges ? (
              <button
                className="btn btn-success d-inline-flex align-items-center gap-2"
                type="button"
                disabled={savingAppName}
                onClick={() => void saveAppName()}
              >
                {savingAppName ? (
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
    </>
  );
}
