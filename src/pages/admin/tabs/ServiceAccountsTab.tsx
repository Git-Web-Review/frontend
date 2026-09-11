import { useEffect, useState } from "react";
import { ApiClientError, apiRequest } from "../../../api/client";
import { useAuth } from "../../../auth/AuthProvider";
import { RefreshButton } from "../../../components/RefreshButton";
import { useI18n } from "../../../i18n/I18nProvider";
import { useToast } from "../../../layout/ToastProvider";
import { formatDateTime } from "../../../utils/formatDate";
import type {
  ServiceAccount,
  ServiceAccountRemoval,
  ServiceAccountWithSecret,
} from "../../../types/api";

const emptyForm = {
  name: "",
  clientId: "",
  email: "",
  description: "",
  admin: false,
};

export function ServiceAccountsTab() {
  const { idToken } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();
  const [accounts, setAccounts] = useState<ServiceAccount[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [issuedSecret, setIssuedSecret] =
    useState<ServiceAccountWithSecret | null>(null);

  const errorLabel = (error: unknown) => {
    if (error instanceof ApiClientError) {
      return t(error.apiError.code);
    }

    return error instanceof Error ? error.message : t("backendError");
  };

  const loadAccounts = async () => {
    if (!idToken) {
      return;
    }

    setLoading(true);
    setErrorMessage("");
    try {
      setAccounts(
        await apiRequest<ServiceAccount[]>(
          "/v1/admin/service-accounts",
          idToken,
        ),
      );
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAccounts();
  }, [idToken]);

  const createAccount = async () => {
    const name = form.name.trim();
    if (!idToken || !name) {
      return;
    }

    setSaving(true);
    setErrorMessage("");
    try {
      const created = await apiRequest<ServiceAccountWithSecret>(
        "/v1/admin/service-accounts",
        idToken,
        {
          method: "POST",
          body: JSON.stringify({
            name,
            clientId: form.clientId.trim() || undefined,
            email: form.email.trim() || undefined,
            description: form.description.trim() || undefined,
            admin: form.admin,
          }),
        },
      );
      setForm(emptyForm);
      setIssuedSecret(created);
      showToast(t("serviceAccountCreated"));
      await loadAccounts();
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (account: ServiceAccount) => {
    if (!idToken) {
      return;
    }

    setPendingId(account.id);
    setErrorMessage("");
    try {
      await apiRequest<ServiceAccount>(
        `/v1/admin/service-accounts/${account.id}`,
        idToken,
        {
          method: "PATCH",
          body: JSON.stringify({ active: !account.active }),
        },
      );
      showToast(t("serviceAccountUpdated"));
      await loadAccounts();
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setPendingId(null);
    }
  };

  const rotateSecret = async (account: ServiceAccount) => {
    if (!idToken) {
      return;
    }

    setPendingId(account.id);
    setErrorMessage("");
    try {
      setIssuedSecret(
        await apiRequest<ServiceAccountWithSecret>(
          `/v1/admin/service-accounts/${account.id}/rotate-secret`,
          idToken,
          { method: "POST" },
        ),
      );
      showToast(t("serviceAccountSecretRotated"));
      await loadAccounts();
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setPendingId(null);
    }
  };

  const removeAccount = async (account: ServiceAccount) => {
    if (!idToken) {
      return;
    }

    setPendingId(account.id);
    setErrorMessage("");
    try {
      await apiRequest<ServiceAccountRemoval>(
        `/v1/admin/service-accounts/${account.id}`,
        idToken,
        { method: "DELETE" },
      );
      showToast(t("serviceAccountRemoved"));
      await loadAccounts();
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setPendingId(null);
    }
  };

  const copyToClipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      showToast(t("copied"));
    } catch {
      setErrorMessage(t("backendError"));
    }
  };

  return (
    <div className="col-12">
      <div className="card h-100">
        <div className="card-header d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h3 className="card-title mb-1">{t("serviceAccounts")}</h3>
            <p className="text-secondary small mb-0">
              {t("serviceAccountsHelp")}
            </p>
          </div>
          <RefreshButton
            disabled={!idToken}
            loading={loading}
            onClick={() => void loadAccounts()}
          />
        </div>

        <div className="card-body border-bottom">
          <div className="row g-3 align-items-start">
            <div className="col-12 col-md-3">
              <label className="form-label" htmlFor="service-account-name">
                {t("serviceAccountName")}
              </label>
              <input
                className="form-control"
                id="service-account-name"
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
              />
            </div>
            <div className="col-12 col-md-3">
              <label className="form-label" htmlFor="service-account-client-id">
                {t("serviceAccountClientId")}
              </label>
              <input
                className="form-control"
                id="service-account-client-id"
                placeholder="review-bot"
                value={form.clientId}
                onChange={(event) =>
                  setForm({ ...form, clientId: event.target.value })
                }
              />
              <div className="form-text">{t("serviceAccountClientIdHelp")}</div>
            </div>
            <div className="col-12 col-md-3">
              <label className="form-label" htmlFor="service-account-email">
                {t("serviceAccountEmail")}
              </label>
              <input
                className="form-control"
                id="service-account-email"
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
              />
              <div className="form-text">{t("serviceAccountEmailHelp")}</div>
            </div>
            <div className="col-12 col-md-3">
              <label
                className="form-label"
                htmlFor="service-account-description"
              >
                {t("serviceAccountDescription")}
              </label>
              <input
                className="form-control"
                id="service-account-description"
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
              />
            </div>
            <div className="col-12 d-flex flex-wrap align-items-center gap-3">
              <div className="form-check mb-0">
                <input
                  className="form-check-input"
                  id="service-account-admin"
                  type="checkbox"
                  checked={form.admin}
                  onChange={(event) =>
                    setForm({ ...form, admin: event.target.checked })
                  }
                />
                <label
                  className="form-check-label"
                  htmlFor="service-account-admin"
                >
                  {t("serviceAccountAdmin")}
                </label>
              </div>
              <button
                className="btn btn-warning d-inline-flex align-items-center gap-2 ms-auto"
                type="button"
                disabled={!form.name.trim() || saving || !idToken}
                onClick={() => void createAccount()}
              >
                {saving ? (
                  <span className="spinner-border spinner-border-sm" />
                ) : (
                  <i className="bi bi-robot" aria-hidden="true" />
                )}
                {t("addServiceAccount")}
              </button>
            </div>
          </div>
        </div>

        <div className="card-body p-0">
          {errorMessage ? (
            <div className="alert alert-danger m-3">{errorMessage}</div>
          ) : null}
          {accounts.length ? (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>{t("serviceAccountName")}</th>
                    <th>{t("serviceAccountClientId")}</th>
                    <th>{t("serviceAccountEmail")}</th>
                    <th>{t("serviceAccountStatus")}</th>
                    <th>{t("serviceAccountLastUsed")}</th>
                    <th className="text-end">{t("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => (
                    <tr key={account.id}>
                      <td className="fw-semibold text-break">
                        {account.name}
                        {account.description ? (
                          <div className="text-secondary small">
                            {account.description}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <code className="text-break">{account.clientId}</code>
                      </td>
                      <td className="text-break">
                        {account.email}
                        {account.role === "ADMIN" ? (
                          <span className="badge text-bg-warning ms-2">
                            {t("admin")}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <span
                          className={`badge ${account.active ? "text-bg-success" : "text-bg-secondary"}`}
                        >
                          {account.active
                            ? t("serviceAccountActive")
                            : t("serviceAccountDisabled")}
                        </span>
                      </td>
                      <td className="text-secondary">
                        {account.lastUsedAt
                          ? formatDateTime(account.lastUsedAt)
                          : t("serviceAccountNeverUsed")}
                      </td>
                      <td className="text-end">
                        <div className="d-inline-flex flex-wrap gap-2 justify-content-end">
                          <button
                            className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-2"
                            type="button"
                            disabled={pendingId === account.id}
                            onClick={() => void toggleActive(account)}
                          >
                            <i
                              className={`bi ${account.active ? "bi-pause-circle" : "bi-play-circle"}`}
                              aria-hidden="true"
                            />
                            {account.active
                              ? t("serviceAccountDisable")
                              : t("serviceAccountEnable")}
                          </button>
                          <button
                            className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-2"
                            type="button"
                            disabled={pendingId === account.id}
                            onClick={() => void rotateSecret(account)}
                          >
                            <i
                              className="bi bi-arrow-repeat"
                              aria-hidden="true"
                            />
                            {t("rotateSecret")}
                          </button>
                          <button
                            className="btn btn-outline-danger btn-sm d-inline-flex align-items-center gap-2"
                            type="button"
                            disabled={pendingId === account.id}
                            onClick={() => void removeAccount(account)}
                          >
                            {pendingId === account.id ? (
                              <span className="spinner-border spinner-border-sm" />
                            ) : (
                              <i className="bi bi-trash" aria-hidden="true" />
                            )}
                            {t("remove")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              {loading ? t("loadingServiceAccounts") : t("noServiceAccounts")}
            </div>
          )}
        </div>
      </div>

      {issuedSecret ? (
        <div
          className="modal fade show d-block"
          role="dialog"
          tabIndex={-1}
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {t("serviceAccountSecretTitle")}
                </h5>
                <button
                  className="btn-close"
                  type="button"
                  aria-label={t("close")}
                  onClick={() => setIssuedSecret(null)}
                />
              </div>
              <div className="modal-body">
                <div className="alert alert-warning">
                  {t("serviceAccountSecretWarning")}
                </div>
                <label className="form-label" htmlFor="issued-client-id">
                  {t("serviceAccountClientId")}
                </label>
                <div className="input-group mb-3">
                  <input
                    className="form-control font-monospace"
                    id="issued-client-id"
                    readOnly
                    value={issuedSecret.clientId}
                  />
                  <button
                    className="btn btn-outline-secondary"
                    type="button"
                    onClick={() => void copyToClipboard(issuedSecret.clientId)}
                  >
                    {t("copy")}
                  </button>
                </div>
                <label className="form-label" htmlFor="issued-client-secret">
                  clientSecret
                </label>
                <div className="input-group">
                  <input
                    className="form-control font-monospace"
                    id="issued-client-secret"
                    readOnly
                    value={issuedSecret.clientSecret}
                  />
                  <button
                    className="btn btn-outline-secondary"
                    type="button"
                    onClick={() =>
                      void copyToClipboard(issuedSecret.clientSecret)
                    }
                  >
                    {t("copy")}
                  </button>
                </div>
                <p className="text-secondary small mt-3 mb-0">
                  {t("serviceAccountTokenHint")}
                </p>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => setIssuedSecret(null)}
                >
                  {t("close")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
