import { useEffect, useState } from "react";
import { ApiClientError, apiRequest } from "../../../api/client";
import { useAuth } from "../../../auth/AuthProvider";
import { RefreshButton } from "../../../components/RefreshButton";
import { useI18n } from "../../../i18n/I18nProvider";
import { useToast } from "../../../layout/ToastProvider";
import { formatDateTime } from "../../../utils/formatDate";
import type { AdminGrant, AdminRemoval } from "../../../types/api";

export function AdminsTab() {
  const { idToken } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();
  const [admins, setAdmins] = useState<AdminGrant[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removingEmail, setRemovingEmail] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const errorLabel = (error: unknown) => {
    if (error instanceof ApiClientError) {
      return t(error.apiError.code);
    }

    return error instanceof Error ? error.message : t("backendError");
  };

  const loadAdmins = async () => {
    if (!idToken) {
      return;
    }

    setLoading(true);
    setErrorMessage("");
    try {
      setAdmins(await apiRequest<AdminGrant[]>("/v1/admin/admins", idToken));
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAdmins();
  }, [idToken]);

  const addAdmin = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!idToken || !normalizedEmail) {
      return;
    }

    setSaving(true);
    setErrorMessage("");
    try {
      await apiRequest<AdminGrant>("/v1/admin/admins", idToken, {
        method: "POST",
        body: JSON.stringify({ email: normalizedEmail }),
      });
      setEmail("");
      showToast(t("adminAdded"));
      await loadAdmins();
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setSaving(false);
    }
  };

  const removeAdmin = async (adminEmail: string) => {
    if (!idToken) {
      return;
    }

    setRemovingEmail(adminEmail);
    setErrorMessage("");
    try {
      await apiRequest<AdminRemoval>(
        `/v1/admin/admins/${encodeURIComponent(adminEmail)}`,
        idToken,
        { method: "DELETE" },
      );
      showToast(t("adminRemoved"));
      await loadAdmins();
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setRemovingEmail(null);
    }
  };

  return (
    <div className="col-12">
      <div className="card h-100">
        <div className="card-header d-flex flex-wrap align-items-center justify-content-between gap-3">
          <h3 className="card-title mb-0">{t("admins")}</h3>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <div className="input-group input-group-sm admin-add-input">
              <span className="input-group-text">
                <i className="bi bi-envelope" aria-hidden="true" />
              </span>
              <input
                className="form-control"
                id="admin-email"
                placeholder={t("adminEmail")}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void addAdmin();
                  }
                }}
              />
              <button
                className="btn btn-warning d-inline-flex align-items-center gap-2"
                type="button"
                disabled={!email.trim() || saving || !idToken}
                onClick={() => void addAdmin()}
              >
                {saving ? (
                  <span className="spinner-border spinner-border-sm" />
                ) : (
                  <i className="bi bi-person-plus" aria-hidden="true" />
                )}
                {t("addAdmin")}
              </button>
            </div>
            <RefreshButton
              disabled={!idToken}
              loading={loading}
              onClick={() => void loadAdmins()}
            />
          </div>
        </div>
        <div className="card-body p-0">
          {errorMessage ? (
            <div className="alert alert-danger m-3">{errorMessage}</div>
          ) : null}
          {admins.length ? (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>{t("adminEmail")}</th>
                    <th>{t("createdAt")}</th>
                    <th className="text-end">{t("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((admin) => (
                    <tr key={admin.email}>
                      <td className="fw-semibold text-break">{admin.email}</td>
                      <td className="text-secondary">
                        {formatDateTime(admin.createdAt)}
                      </td>
                      <td className="text-end">
                        <button
                          className="btn btn-outline-danger btn-sm d-inline-flex align-items-center gap-2"
                          type="button"
                          disabled={removingEmail === admin.email}
                          onClick={() => void removeAdmin(admin.email)}
                        >
                          {removingEmail === admin.email ? (
                            <span className="spinner-border spinner-border-sm" />
                          ) : (
                            <i className="bi bi-trash" aria-hidden="true" />
                          )}
                          {t("remove")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              {loading ? t("loadingAdmins") : t("noAdmins")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
