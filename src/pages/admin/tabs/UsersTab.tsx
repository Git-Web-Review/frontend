import { useEffect, useState } from "react";
import { ApiClientError, apiRequest } from "../../../api/client";
import { useAuth } from "../../../auth/AuthProvider";
import { RefreshButton } from "../../../components/RefreshButton";
import { useI18n } from "../../../i18n/I18nProvider";
import { formatDateTime } from "../../../utils/formatDate";
import type { CurrentUser } from "../../../types/api";

type UsersTabProps = {
  reloadKey: number;
  onEditUser: (user: CurrentUser) => void;
};

export function UsersTab({ reloadKey, onEditUser }: UsersTabProps) {
  const { idToken } = useAuth();
  const { t } = useI18n();
  const [users, setUsers] = useState<CurrentUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const errorLabel = (error: unknown) => {
    if (error instanceof ApiClientError) {
      return t(error.apiError.code);
    }

    return error instanceof Error ? error.message : t("backendError");
  };

  const loadUsers = async () => {
    if (!idToken) {
      return;
    }

    setLoadingUsers(true);
    setErrorMessage("");
    try {
      setUsers(await apiRequest<CurrentUser[]>("/v1/admin/users", idToken));
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, [idToken, reloadKey]);

  return (
    <div className="col-12">
      <div className="card h-100">
        <div className="card-header d-flex flex-wrap align-items-center justify-content-between gap-3">
          <h3 className="card-title mb-0">{t("users")}</h3>
          <RefreshButton
            disabled={!idToken}
            loading={loadingUsers}
            onClick={() => void loadUsers()}
          />
        </div>
        <div className="card-body p-0">
          {errorMessage ? (
            <div className="alert alert-danger m-3">{errorMessage}</div>
          ) : null}
          {users.length ? (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>{t("email")}</th>
                    <th>{t("nickname")}</th>
                    <th>{t("hostname")}</th>
                    <th>{t("role")}</th>
                    <th>{t("mailNotifications")}</th>
                    <th>{t("ircNotifications")}</th>
                    <th>{t("createdAt")}</th>
                    <th className="text-end">{t("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="fw-semibold text-break">{user.email}</td>
                      <td>{user.settings?.nickname || t("notAvailable")}</td>
                      <td className="text-break">{user.hostname}</td>
                      <td>
                        <span
                          className={`badge ${user.role === "ADMIN" ? "text-bg-warning" : "text-bg-secondary"}`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${user.settings?.mailNotificationsEnabled ? "text-bg-success" : "text-bg-secondary"}`}
                        >
                          {user.settings?.mailNotificationsEnabled
                            ? t("yes")
                            : t("no")}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${user.settings?.ircNotificationsEnabled ? "text-bg-success" : "text-bg-secondary"}`}
                        >
                          {user.settings?.ircNotificationsEnabled
                            ? t("yes")
                            : t("no")}
                        </span>
                      </td>
                      <td className="text-secondary">
                        {formatDateTime(user.createdAt)}
                      </td>
                      <td className="text-end">
                        <button
                          className="btn btn-outline-secondary btn-sm"
                          title={t("editUserSettings")}
                          type="button"
                          onClick={() => onEditUser(user)}
                        >
                          <i className="bi bi-pencil" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              {loadingUsers ? t("loadingUsers") : t("noUsers")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
