import { useEffect, useState } from "react";
import { ApiClientError, apiRequest } from "../../../api/client";
import { useAuth } from "../../../auth/AuthProvider";
import { RefreshButton } from "../../../components/RefreshButton";
import { ReviewerSearchSelect } from "../../../components/ReviewerSearchSelect";
import { UserAvatar } from "../../../components/UserAvatar";
import { useI18n } from "../../../i18n/I18nProvider";
import { useToast } from "../../../layout/ToastProvider";
import type {
  ProjectDefaultReviewer,
  ProjectDefaultReviewerDeletion,
} from "../../../types/api";

type ProjectGroup = {
  project: string;
  defaultReviewers: ProjectDefaultReviewer[];
};

/** The backend lists entries sorted by project: consecutive ones group. */
const groupByProject = (defaultReviewers: ProjectDefaultReviewer[]) =>
  defaultReviewers.reduce<ProjectGroup[]>((groups, defaultReviewer) => {
    const lastGroup = groups.at(-1);
    if (lastGroup?.project === defaultReviewer.project) {
      lastGroup.defaultReviewers.push(defaultReviewer);
    } else {
      groups.push({
        project: defaultReviewer.project,
        defaultReviewers: [defaultReviewer],
      });
    }

    return groups;
  }, []);

export function ProjectDefaultReviewersTab() {
  const { idToken } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();
  const [defaultReviewers, setDefaultReviewers] = useState<
    ProjectDefaultReviewer[]
  >([]);
  const [knownProjects, setKnownProjects] = useState<string[]>([]);
  const [newProject, setNewProject] = useState("");
  const [newUserIds, setNewUserIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const errorLabel = (error: unknown) => {
    if (error instanceof ApiClientError) {
      return t(error.apiError.code);
    }

    return error instanceof Error ? error.message : t("backendError");
  };

  const loadDefaultReviewers = async () => {
    if (!idToken) {
      return;
    }

    setLoading(true);
    setErrorMessage("");
    try {
      const [nextDefaultReviewers, nextKnownProjects] = await Promise.all([
        apiRequest<ProjectDefaultReviewer[]>(
          "/project-default-reviewers",
          idToken,
        ),
        apiRequest<string[]>("/project-default-reviewers/projects", idToken),
      ]);
      setDefaultReviewers(nextDefaultReviewers);
      setKnownProjects(nextKnownProjects);
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDefaultReviewers();
  }, [idToken]);

  const addDefaultReviewers = async () => {
    if (!idToken || !newProject.trim() || !newUserIds.length) {
      return;
    }

    setSaving(true);
    setErrorMessage("");
    try {
      await apiRequest<ProjectDefaultReviewer[]>(
        "/project-default-reviewers",
        idToken,
        {
          method: "POST",
          body: JSON.stringify({
            project: newProject.trim(),
            userIds: newUserIds,
          }),
        },
      );
      setNewProject("");
      setNewUserIds([]);
      showToast(t("projectDefaultReviewersAdded"));
      await loadDefaultReviewers();
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setSaving(false);
    }
  };

  const removeDefaultReviewer = async (id: string) => {
    if (!idToken) {
      return;
    }

    setDeletingId(id);
    setErrorMessage("");
    try {
      await apiRequest<ProjectDefaultReviewerDeletion>(
        `/project-default-reviewers/${id}`,
        idToken,
        { method: "DELETE" },
      );
      showToast(t("projectDefaultReviewerRemoved"));
      await loadDefaultReviewers();
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setDeletingId(null);
    }
  };

  const projectGroups = groupByProject(defaultReviewers);

  return (
    <div className="col-12">
      <div className="card card-primary card-outline">
        <div className="card-header d-flex flex-wrap align-items-center justify-content-between gap-3">
          <h3 className="card-title mb-0">{t("projectDefaultReviewers")}</h3>
          <RefreshButton
            disabled={!idToken}
            loading={loading}
            onClick={() => void loadDefaultReviewers()}
          />
        </div>
        <div className="card-body">
          {errorMessage ? (
            <div className="alert alert-danger">{errorMessage}</div>
          ) : null}
          <p className="text-secondary small mb-3">
            {t("projectDefaultReviewersHint")}
          </p>
          <div className="row g-2 align-items-start mb-3">
            <div className="col-lg-4">
              <label
                className="form-label"
                htmlFor="new-project-default-reviewer-project"
              >
                {t("sourceProject")}
              </label>
              <input
                className="form-control"
                id="new-project-default-reviewer-project"
                list="project-default-reviewer-known-projects"
                placeholder={t("projectNamePlaceholder")}
                value={newProject}
                onChange={(event) => setNewProject(event.target.value)}
              />
              <datalist id="project-default-reviewer-known-projects">
                {knownProjects.map((project) => (
                  <option key={project} value={project} />
                ))}
              </datalist>
            </div>
            <div className="col-lg-6">
              <span className="form-label d-block">{t("reviewers")}</span>
              <ReviewerSearchSelect
                idToken={idToken}
                includeSelf
                selectedUserIds={newUserIds}
                selectedUsers={[]}
                onChange={setNewUserIds}
              />
            </div>
            <div className="col-lg-2 d-flex align-items-end align-self-stretch">
              <button
                className="btn btn-primary d-inline-flex align-items-center gap-2"
                type="button"
                disabled={!newProject.trim() || !newUserIds.length || saving}
                onClick={() => void addDefaultReviewers()}
              >
                {saving ? (
                  <span className="spinner-border spinner-border-sm" />
                ) : (
                  <i className="bi bi-plus-lg" aria-hidden="true" />
                )}
                {t("add")}
              </button>
            </div>
          </div>

          {projectGroups.length ? (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>{t("sourceProject")}</th>
                    <th>{t("reviewers")}</th>
                  </tr>
                </thead>
                <tbody>
                  {projectGroups.map((group) => (
                    <tr key={group.project}>
                      <td className="fw-semibold text-break">
                        {group.project}
                      </td>
                      <td>
                        <div className="reviewer-selected-list">
                          {group.defaultReviewers.map((defaultReviewer) => (
                            <span
                              className="reviewer-selected-chip"
                              key={defaultReviewer.id}
                            >
                              <UserAvatar
                                idToken={idToken}
                                user={defaultReviewer.user}
                              />
                              <span className="reviewer-selected-identity">
                                <span className="fw-semibold">
                                  {defaultReviewer.user.nickname ||
                                    defaultReviewer.user.hostname ||
                                    defaultReviewer.user.email}
                                </span>
                                <span className="reviewer-selected-email">
                                  {defaultReviewer.user.email}
                                </span>
                              </span>
                              <button
                                className="btn btn-sm btn-link p-0 reviewer-selected-remove"
                                disabled={deletingId === defaultReviewer.id}
                                title={t("removeReviewer")}
                                type="button"
                                onClick={() =>
                                  void removeDefaultReviewer(defaultReviewer.id)
                                }
                              >
                                {deletingId === defaultReviewer.id ? (
                                  <span className="spinner-border spinner-border-sm" />
                                ) : (
                                  <i className="bi bi-x-lg" aria-hidden="true" />
                                )}
                                <span className="visually-hidden">
                                  {t("removeReviewer")}
                                </span>
                              </button>
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state border rounded">
              {loading
                ? t("loadingProjectDefaultReviewers")
                : t("noProjectDefaultReviewers")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
