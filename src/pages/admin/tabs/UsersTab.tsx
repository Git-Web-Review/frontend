import { useEffect, useState } from "react";
import { ApiClientError, apiRequest } from "../../../api/client";
import { useAuth } from "../../../auth/AuthProvider";
import { RefreshButton } from "../../../components/RefreshButton";
import { useI18n } from "../../../i18n/I18nProvider";
import { useToast } from "../../../layout/ToastProvider";
import { formatDateTime } from "../../../utils/formatDate";
import type {
  CurrentUser,
  UserDeletionPreview,
  UserRemoval,
} from "../../../types/api";

type UsersTabProps = {
  reloadKey: number;
  onEditUser: (user: CurrentUser) => void;
};

export function UsersTab({ reloadKey, onEditUser }: UsersTabProps) {
  const { idToken } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();
  const [users, setUsers] = useState<CurrentUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingDeletion, setPendingDeletion] = useState<CurrentUser | null>(
    null,
  );
  const [preview, setPreview] = useState<UserDeletionPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  // The preview is asked for as the dialog opens: the backend is the authority
  // on what a deletion would destroy, and on whether it is allowed at all.
  const askDeletion = async (user: CurrentUser) => {
    if (!idToken) {
      return;
    }

    setPendingDeletion(user);
    setPreview(null);
    setLoadingPreview(true);
    setErrorMessage("");
    try {
      setPreview(
        await apiRequest<UserDeletionPreview>(
          `/v1/admin/users/${user.id}/deletion-preview`,
          idToken,
        ),
      );
    } catch (error) {
      setErrorMessage(errorLabel(error));
      setPendingDeletion(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const confirmDeletion = async () => {
    if (!idToken || !pendingDeletion) {
      return;
    }

    setDeleting(true);
    setErrorMessage("");
    try {
      await apiRequest<UserRemoval>(
        `/v1/admin/users/${pendingDeletion.id}`,
        idToken,
        { method: "DELETE" },
      );
      showToast(t("userDeleted"));
      setPendingDeletion(null);
      setPreview(null);
      await loadUsers();
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setDeleting(false);
    }
  };

  const impactRows = (impact: UserDeletionPreview) =>
    (
      [
        [impact.ownedReviews, t("deleteUserOwnedReviews")],
        [impact.foreignMessagesOnOwnedReviews, t("deleteUserForeignMessages")],
        [impact.authoredMessages, t("deleteUserAuthoredMessages")],
        [impact.reviewerAssignments, t("deleteUserReviewerAssignments")],
        [impact.commitAcks, t("deleteUserCommitAcks")],
        [impact.fileViews, t("deleteUserFileViews")],
      ] as const
    ).filter(([count]) => count > 0);

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
                    <th>{t("webhookNotifications")}</th>
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
                      <td>
                        <span
                          className={`badge ${user.settings?.webhookNotificationsEnabled ? "text-bg-success" : "text-bg-secondary"}`}
                        >
                          {user.settings?.webhookNotificationsEnabled
                            ? t("yes")
                            : t("no")}
                        </span>
                      </td>
                      <td className="text-secondary">
                        {formatDateTime(user.createdAt)}
                      </td>
                      <td className="text-end">
                        <div className="d-inline-flex gap-2 justify-content-end">
                          <button
                            className="btn btn-outline-secondary btn-sm"
                            title={t("editUserSettings")}
                            type="button"
                            onClick={() => onEditUser(user)}
                          >
                            <i className="bi bi-pencil" aria-hidden="true" />
                          </button>
                          <button
                            className="btn btn-outline-danger btn-sm"
                            title={
                              user.firebaseUid
                                ? t("deleteUserFirebaseBlocked")
                                : t("deleteUser")
                            }
                            type="button"
                            disabled={!!user.firebaseUid || !idToken}
                            onClick={() => void askDeletion(user)}
                          >
                            <i className="bi bi-trash" aria-hidden="true" />
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
              {loadingUsers ? t("loadingUsers") : t("noUsers")}
            </div>
          )}
        </div>
      </div>

      {pendingDeletion ? (
        <div
          className="modal fade show d-block"
          role="dialog"
          tabIndex={-1}
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{t("deleteUserTitle")}</h5>
                <button
                  className="btn-close"
                  type="button"
                  aria-label={t("cancel")}
                  disabled={deleting}
                  onClick={() => setPendingDeletion(null)}
                />
              </div>
              <div className="modal-body">
                <p className="fw-semibold text-break mb-3">
                  {pendingDeletion.email}
                </p>

                {loadingPreview ? (
                  <p className="text-secondary mb-0">
                    {t("loadingDeletionPreview")}
                  </p>
                ) : null}

                {preview && !preview.deletable ? (
                  <div className="alert alert-danger mb-0">
                    {preview.blockedBy
                      ? t(preview.blockedBy)
                      : t("backendError")}
                  </div>
                ) : null}

                {preview && preview.deletable ? (
                  <>
                    {impactRows(preview).length ? (
                      <>
                        <p className="mb-2">{t("deleteUserWillAlsoDelete")}</p>
                        <ul className="mb-3">
                          {impactRows(preview).map(([count, label]) => (
                            <li key={label}>
                              <span className="fw-semibold">{count}</span>{" "}
                              {label}
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <p className="mb-3">{t("deleteUserNothingToLose")}</p>
                    )}

                    {preview.isServiceAccount ? (
                      <p className="text-secondary small mb-3">
                        {t("deleteUserServiceAccountNote")}
                      </p>
                    ) : null}

                    <div className="alert alert-warning mb-0">
                      {t("deleteUserIrreversible")}
                    </div>
                  </>
                ) : null}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  type="button"
                  disabled={deleting}
                  onClick={() => setPendingDeletion(null)}
                >
                  {t("cancel")}
                </button>
                <button
                  className="btn btn-danger d-inline-flex align-items-center gap-2"
                  type="button"
                  disabled={!preview?.deletable || deleting}
                  onClick={() => void confirmDeletion()}
                >
                  {deleting ? (
                    <span className="spinner-border spinner-border-sm" />
                  ) : (
                    <i className="bi bi-trash" aria-hidden="true" />
                  )}
                  {t("deleteUserConfirm")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
