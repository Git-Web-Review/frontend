import { useEffect, useState } from "react";
import { ApiClientError, apiRequest } from "../../../../api/client";
import { useAuth } from "../../../../auth/AuthProvider";
import { RefreshButton } from "../../../../components/RefreshButton";
import { ReviewerSearchSelect } from "../../../../components/ReviewerSearchSelect";
import { UserAvatar } from "../../../../components/UserAvatar";
import { useI18n } from "../../../../i18n/I18nProvider";
import type { TranslationKey } from "../../../../i18n/translations";
import { useToast } from "../../../../layout/ToastProvider";
import type { ProjectDefaultReviewer } from "../../../../types/api";
import { ProjectUsersModal } from "./ProjectUsersModal";

/** A user attached to a project: a default reviewer or a project owner. */
type ProjectUser = ProjectDefaultReviewer;

type ProjectGroup = {
  project: string;
  entries: ProjectUser[];
};

export type ProjectUsersLabels = {
  title: TranslationKey;
  hint: TranslationKey;
  users: TranslationKey;
  added: TranslationKey;
  removed: TranslationKey;
  remove: TranslationKey;
  edit: TranslationKey;
  saved: TranslationKey;
  loading: TranslationKey;
  empty: TranslationKey;
};

type ProjectUsersTabProps = {
  /** API collection, e.g. "/project-owners". */
  endpoint: string;
  /** Prefix of the form element ids, unique per tab. */
  idPrefix: string;
  labels: ProjectUsersLabels;
};

/** The backend lists entries sorted by project: consecutive ones group. */
const groupByProject = (entries: ProjectUser[]) =>
  entries.reduce<ProjectGroup[]>((groups, entry) => {
    const lastGroup = groups.at(-1);
    if (lastGroup?.project === entry.project) {
      lastGroup.entries.push(entry);
    } else {
      groups.push({ project: entry.project, entries: [entry] });
    }

    return groups;
  }, []);

/** Admin table linking project names to users, one row per project. */
export function ProjectUsersTab({
  endpoint,
  idPrefix,
  labels,
}: ProjectUsersTabProps) {
  const { idToken } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();
  const [entries, setEntries] = useState<ProjectUser[]>([]);
  const [knownProjects, setKnownProjects] = useState<string[]>([]);
  const [newProject, setNewProject] = useState("");
  const [newUserIds, setNewUserIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [editingProject, setEditingProject] = useState<string | null>(null);

  const errorLabel = (error: unknown) => {
    if (error instanceof ApiClientError) {
      return t(error.apiError.code);
    }

    return error instanceof Error ? error.message : t("backendError");
  };

  const loadEntries = async () => {
    if (!idToken) {
      return;
    }

    setLoading(true);
    setErrorMessage("");
    try {
      const [nextEntries, nextKnownProjects] = await Promise.all([
        apiRequest<ProjectUser[]>(endpoint, idToken),
        apiRequest<string[]>("/project-default-reviewers/projects", idToken),
      ]);
      setEntries(nextEntries);
      setKnownProjects(nextKnownProjects);
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEntries();
  }, [idToken, endpoint]);

  const addEntries = async () => {
    if (!idToken || !newProject.trim() || !newUserIds.length) {
      return;
    }

    setSaving(true);
    setErrorMessage("");
    try {
      await apiRequest<ProjectUser[]>(endpoint, idToken, {
        method: "POST",
        body: JSON.stringify({
          project: newProject.trim(),
          userIds: newUserIds,
        }),
      });
      setNewProject("");
      setNewUserIds([]);
      showToast(t(labels.added));
      await loadEntries();
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setSaving(false);
    }
  };

  const removeEntry = async (id: string) => {
    if (!idToken) {
      return;
    }

    setDeletingId(id);
    setErrorMessage("");
    try {
      await apiRequest(`${endpoint}/${id}`, idToken, { method: "DELETE" });
      showToast(t(labels.removed));
      await loadEntries();
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setDeletingId(null);
    }
  };

  const projectGroups = groupByProject(entries);
  const editingGroup = projectGroups.find(
    (group) => group.project === editingProject,
  );
  const knownProjectsListId = `${idPrefix}-known-projects`;

  return (
    <div className="col-12">
      <div className="card card-primary card-outline">
        <div className="card-header d-flex flex-wrap align-items-center justify-content-between gap-3">
          <h3 className="card-title mb-0">{t(labels.title)}</h3>
          <RefreshButton
            disabled={!idToken}
            loading={loading}
            onClick={() => void loadEntries()}
          />
        </div>
        <div className="card-body">
          {errorMessage ? (
            <div className="alert alert-danger">{errorMessage}</div>
          ) : null}
          <p className="text-secondary small mb-3">{t(labels.hint)}</p>
          <div className="row g-2 align-items-start mb-3">
            <div className="col-lg-4">
              <label className="form-label" htmlFor={`${idPrefix}-project`}>
                {t("sourceProject")}
              </label>
              <input
                className="form-control"
                id={`${idPrefix}-project`}
                list={knownProjectsListId}
                placeholder={t("projectNamePlaceholder")}
                value={newProject}
                onChange={(event) => setNewProject(event.target.value)}
              />
              <datalist id={knownProjectsListId}>
                {knownProjects.map((project) => (
                  <option key={project} value={project} />
                ))}
              </datalist>
            </div>
            <div className="col-lg-6">
              <span className="form-label d-block">{t(labels.users)}</span>
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
                onClick={() => void addEntries()}
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
                    <th>{t(labels.users)}</th>
                    <th className="text-end">{t("actions")}</th>
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
                          {group.entries.map((entry) => (
                            <span
                              className="reviewer-selected-chip"
                              key={entry.id}
                            >
                              <UserAvatar idToken={idToken} user={entry.user} />
                              <span className="reviewer-selected-identity">
                                <span className="fw-semibold">
                                  {entry.user.nickname ||
                                    entry.user.hostname ||
                                    entry.user.email}
                                </span>
                                <span className="reviewer-selected-email">
                                  {entry.user.email}
                                </span>
                              </span>
                              <button
                                className="btn btn-sm btn-link p-0 reviewer-selected-remove"
                                disabled={deletingId === entry.id}
                                title={t(labels.remove)}
                                type="button"
                                onClick={() => void removeEntry(entry.id)}
                              >
                                {deletingId === entry.id ? (
                                  <span className="spinner-border spinner-border-sm" />
                                ) : (
                                  <i
                                    className="bi bi-x-lg"
                                    aria-hidden="true"
                                  />
                                )}
                                <span className="visually-hidden">
                                  {t(labels.remove)}
                                </span>
                              </button>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="text-end">
                        <button
                          className="btn btn-outline-secondary btn-sm"
                          title={t(labels.edit)}
                          type="button"
                          onClick={() => setEditingProject(group.project)}
                        >
                          <i className="bi bi-pencil" aria-hidden="true" />
                          <span className="visually-hidden">
                            {t(labels.edit)}
                          </span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state border rounded">
              {loading ? t(labels.loading) : t(labels.empty)}
            </div>
          )}
        </div>
      </div>
      {editingGroup ? (
        <ProjectUsersModal
          endpoint={endpoint}
          labels={labels}
          project={editingGroup.project}
          entries={editingGroup.entries}
          onClose={() => setEditingProject(null)}
          onSaved={() => void loadEntries()}
        />
      ) : null}
    </div>
  );
}
