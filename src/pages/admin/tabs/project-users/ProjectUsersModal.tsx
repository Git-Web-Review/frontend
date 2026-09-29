import { useState } from "react";
import { ApiClientError, apiRequest } from "../../../../api/client";
import { useAuth } from "../../../../auth/AuthProvider";
import { ReviewerSearchSelect } from "../../../../components/ReviewerSearchSelect";
import { useI18n } from "../../../../i18n/I18nProvider";
import { useToast } from "../../../../layout/ToastProvider";
import type { ProjectDefaultReviewer } from "../../../../types/api";
import type { ProjectUsersLabels } from "./ProjectUsersTab";

type ProjectUsersModalProps = {
  endpoint: string;
  labels: ProjectUsersLabels;
  project: string;
  entries: ProjectDefaultReviewer[];
  onClose: () => void;
  onSaved: () => void;
};

/**
 * Edits the users of one project: users picked are added, users unpicked are
 * removed, each through the collection's own add and delete routes.
 */
export function ProjectUsersModal({
  endpoint,
  labels,
  project,
  entries,
  onClose,
  onSaved,
}: ProjectUsersModalProps) {
  const { idToken } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();
  const [userIds, setUserIds] = useState(() =>
    entries.map((entry) => entry.userId),
  );
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const currentUserIds = new Set(entries.map((entry) => entry.userId));
  const addedUserIds = userIds.filter((userId) => !currentUserIds.has(userId));
  const removedEntries = entries.filter(
    (entry) => !userIds.includes(entry.userId),
  );
  const changed = addedUserIds.length > 0 || removedEntries.length > 0;

  const save = async () => {
    if (!idToken || !changed) {
      return;
    }

    setSaving(true);
    setErrorMessage("");
    try {
      if (addedUserIds.length) {
        await apiRequest<ProjectDefaultReviewer[]>(endpoint, idToken, {
          method: "POST",
          body: JSON.stringify({ project, userIds: addedUserIds }),
        });
      }
      await Promise.all(
        removedEntries.map((entry) =>
          apiRequest(`${endpoint}/${entry.id}`, idToken, { method: "DELETE" }),
        ),
      );
      showToast(t(labels.saved));
      onSaved();
      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof ApiClientError
          ? t(error.apiError.code)
          : error instanceof Error
            ? error.message
            : t("backendError"),
      );
      // Part of the changes may have gone through: show what the list is now.
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal d-block" role="dialog" aria-modal="true">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h5 className="modal-title">{t(labels.edit)}</h5>
                <div className="small text-secondary text-break">{project}</div>
              </div>
              <button
                className="btn-close"
                type="button"
                aria-label="Close"
                onClick={onClose}
              />
            </div>
            <div className="modal-body">
              {errorMessage ? (
                <div className="alert alert-danger">{errorMessage}</div>
              ) : null}
              <span className="form-label d-block">{t(labels.users)}</span>
              <ReviewerSearchSelect
                idToken={idToken}
                includeSelf
                selectedUserIds={userIds}
                selectedUsers={entries.map((entry) => entry.user)}
                onChange={setUserIds}
              />
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-outline-secondary"
                type="button"
                onClick={onClose}
              >
                {t("cancel")}
              </button>
              <button
                className="btn btn-primary d-inline-flex align-items-center gap-2"
                type="button"
                disabled={saving || !changed}
                onClick={() => void save()}
              >
                {saving ? (
                  <span className="spinner-border spinner-border-sm" />
                ) : (
                  <i className="bi bi-check-lg" aria-hidden="true" />
                )}
                {t("save")}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}
