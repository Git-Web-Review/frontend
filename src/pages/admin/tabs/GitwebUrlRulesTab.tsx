import { useEffect, useState } from "react";
import { apiRequest, ApiClientError } from "../../../api/client";
import { useAuth } from "../../../auth/AuthProvider";
import { RefreshButton } from "../../../components/RefreshButton";
import { useI18n } from "../../../i18n/I18nProvider";
import { useToast } from "../../../layout/ToastProvider";
import type {
  GitwebUrlRule,
  GitwebUrlRuleDeletion,
  GitwebUrlRuleKind,
} from "../../../types/api";

type GitwebUrlRuleDraft = {
  label: string;
  regex: string;
  remoteTemplate: string;
  linkKind: GitwebUrlRuleKind;
  priority: string;
  enabled: boolean;
};

const gitwebUrlRuleKinds: GitwebUrlRuleKind[] = ["AUTO", "COMMIT", "SUMMARY"];

const emptyGitwebUrlRuleDraft: GitwebUrlRuleDraft = {
  label: "",
  regex: "",
  remoteTemplate: "",
  linkKind: "AUTO",
  priority: "100",
  enabled: true,
};

const parseGitwebUrlRulePriority = (value: string): number | null => {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
};

export function GitwebUrlRulesTab() {
  const { idToken } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();
  const [gitwebUrlRules, setGitwebUrlRules] = useState<GitwebUrlRule[]>([]);
  const [gitwebUrlRuleDrafts, setGitwebUrlRuleDrafts] = useState<
    Record<string, GitwebUrlRuleDraft>
  >({});
  const [newGitwebUrlRule, setNewGitwebUrlRule] = useState<GitwebUrlRuleDraft>(
    emptyGitwebUrlRuleDraft,
  );
  const [loadingGitwebUrlRules, setLoadingGitwebUrlRules] = useState(false);
  const [savingGitwebUrlRule, setSavingGitwebUrlRule] = useState(false);
  const [updatingGitwebUrlRuleId, setUpdatingGitwebUrlRuleId] = useState<
    string | null
  >(null);
  const [deletingGitwebUrlRuleId, setDeletingGitwebUrlRuleId] = useState<
    string | null
  >(null);
  const [errorMessage, setErrorMessage] = useState("");

  const errorLabel = (error: unknown) => {
    if (error instanceof ApiClientError) {
      return t(error.apiError.code);
    }

    return error instanceof Error ? error.message : t("backendError");
  };

  const draftsFromGitwebUrlRules = (rules: GitwebUrlRule[]) =>
    Object.fromEntries(
      rules.map((rule) => [
        rule.id,
        {
          label: rule.label ?? "",
          regex: rule.regex,
          remoteTemplate: rule.remoteTemplate ?? "",
          linkKind: rule.linkKind,
          priority: String(rule.priority),
          enabled: rule.enabled,
        },
      ]),
    );

  const loadGitwebUrlRules = async () => {
    if (!idToken) {
      return;
    }

    setLoadingGitwebUrlRules(true);
    setErrorMessage("");
    try {
      const rules = await apiRequest<GitwebUrlRule[]>(
        "/v1/gitweb-url-rules",
        idToken,
      );
      setGitwebUrlRules(rules);
      setGitwebUrlRuleDrafts(draftsFromGitwebUrlRules(rules));
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setLoadingGitwebUrlRules(false);
    }
  };

  useEffect(() => {
    void loadGitwebUrlRules();
  }, [idToken]);

  const gitwebUrlRuleDraftChanged = (
    rule: GitwebUrlRule,
    draft: GitwebUrlRuleDraft | undefined,
  ) =>
    !!draft &&
    (draft.label !== (rule.label ?? "") ||
      draft.regex !== rule.regex ||
      draft.remoteTemplate !== (rule.remoteTemplate ?? "") ||
      draft.linkKind !== rule.linkKind ||
      parseGitwebUrlRulePriority(draft.priority) !== rule.priority ||
      draft.enabled !== rule.enabled);

  const updateGitwebUrlRuleDraft = (
    ruleId: string,
    nextDraft: Partial<GitwebUrlRuleDraft>,
  ) => {
    setGitwebUrlRuleDrafts((current) => ({
      ...current,
      [ruleId]: { ...current[ruleId], ...nextDraft },
    }));
  };

  const createGitwebUrlRule = async () => {
    const priority = parseGitwebUrlRulePriority(newGitwebUrlRule.priority);
    if (!idToken || !newGitwebUrlRule.regex.trim() || priority === null) {
      return;
    }

    setSavingGitwebUrlRule(true);
    setErrorMessage("");
    try {
      await apiRequest<GitwebUrlRule>("/v1/gitweb-url-rules", idToken, {
        method: "POST",
        body: JSON.stringify({
          label: newGitwebUrlRule.label.trim() || null,
          regex: newGitwebUrlRule.regex.trim(),
          remoteTemplate: newGitwebUrlRule.remoteTemplate.trim() || null,
          linkKind: newGitwebUrlRule.linkKind,
          priority,
          enabled: newGitwebUrlRule.enabled,
        }),
      });
      setNewGitwebUrlRule(emptyGitwebUrlRuleDraft);
      showToast(t("gitwebUrlRuleCreated"));
      await loadGitwebUrlRules();
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setSavingGitwebUrlRule(false);
    }
  };

  const updateGitwebUrlRule = async (ruleId: string) => {
    const draft = gitwebUrlRuleDrafts[ruleId];
    const rule = gitwebUrlRules.find(
      (currentRule) => currentRule.id === ruleId,
    );
    const priority = draft
      ? parseGitwebUrlRulePriority(draft.priority)
      : null;
    if (
      !idToken ||
      !rule ||
      !draft?.regex.trim() ||
      priority === null ||
      !gitwebUrlRuleDraftChanged(rule, draft)
    ) {
      return;
    }

    setUpdatingGitwebUrlRuleId(ruleId);
    setErrorMessage("");
    try {
      await apiRequest<GitwebUrlRule>(
        `/v1/gitweb-url-rules/${ruleId}`,
        idToken,
        {
          method: "PATCH",
          body: JSON.stringify({
            label: draft.label.trim() || null,
            regex: draft.regex.trim(),
            remoteTemplate: draft.remoteTemplate.trim() || null,
            linkKind: draft.linkKind,
            priority,
            enabled: draft.enabled,
          }),
        },
      );
      showToast(t("gitwebUrlRuleUpdated"));
      await loadGitwebUrlRules();
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setUpdatingGitwebUrlRuleId(null);
    }
  };

  const deleteGitwebUrlRule = async (ruleId: string) => {
    if (!idToken) {
      return;
    }

    setDeletingGitwebUrlRuleId(ruleId);
    setErrorMessage("");
    try {
      await apiRequest<GitwebUrlRuleDeletion>(
        `/v1/gitweb-url-rules/${ruleId}`,
        idToken,
        { method: "DELETE" },
      );
      showToast(t("gitwebUrlRuleDeleted"));
      await loadGitwebUrlRules();
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setDeletingGitwebUrlRuleId(null);
    }
  };

  return (
  <div className="col-12">
    <div className="card card-primary card-outline">
      <div className="card-header d-flex flex-wrap align-items-center justify-content-between gap-3">
        <h3 className="card-title mb-0">{t("gitwebUrlRules")}</h3>
        <RefreshButton
          disabled={!idToken}
          loading={loadingGitwebUrlRules}
          onClick={() => void loadGitwebUrlRules()}
        />
      </div>
      <div className="card-body">
        <p className="text-secondary small mb-3">
          {t("gitwebUrlRuleVariables")}
        </p>
        <div className="row g-2 align-items-end mb-3">
          <div className="col-lg-2">
            <label className="form-label" htmlFor="new-gitweb-url-rule-label">
              {t("ruleLabel")}
            </label>
            <input
              className="form-control"
              id="new-gitweb-url-rule-label"
              value={newGitwebUrlRule.label}
              placeholder="Label"
              onChange={(event) =>
                setNewGitwebUrlRule((current) => ({
                  ...current,
                  label: event.target.value,
                }))
              }
            />
          </div>
          <div className="col-lg-4">
            <label className="form-label" htmlFor="new-gitweb-url-rule-regex">
              {t("ruleRegex")}
            </label>
            <input
              className="form-control font-monospace"
              id="new-gitweb-url-rule-regex"
              value={newGitwebUrlRule.regex}
              placeholder="^https?://(?<HOSTNAME>[^/?#]+)..."
              onChange={(event) =>
                setNewGitwebUrlRule((current) => ({
                  ...current,
                  regex: event.target.value,
                }))
              }
            />
          </div>
          <div className="col-lg-3">
            <label
              className="form-label"
              htmlFor="new-gitweb-url-rule-template"
            >
              {t("ruleRemoteTemplate")}
            </label>
            <input
              className="form-control font-monospace"
              id="new-gitweb-url-rule-template"
              placeholder="git://${HOSTNAME}/${PROJECT}"
              value={newGitwebUrlRule.remoteTemplate}
              onChange={(event) =>
                setNewGitwebUrlRule((current) => ({
                  ...current,
                  remoteTemplate: event.target.value,
                }))
              }
            />
          </div>
          <div className="col-lg-1">
            <label
              className="form-label"
              htmlFor="new-gitweb-url-rule-priority"
            >
              {t("rulePriority")}
            </label>
            <input
              className="form-control"
              id="new-gitweb-url-rule-priority"
              type="number"
              min={0}
              value={newGitwebUrlRule.priority}
              onChange={(event) =>
                setNewGitwebUrlRule((current) => ({
                  ...current,
                  priority: event.target.value,
                }))
              }
            />
          </div>
          <div className="col-lg-2 d-flex flex-wrap align-items-center gap-2">
            <select
              className="form-select"
              aria-label={t("ruleLinkKind")}
              value={newGitwebUrlRule.linkKind}
              onChange={(event) =>
                setNewGitwebUrlRule((current) => ({
                  ...current,
                  linkKind: event.target.value as GitwebUrlRuleKind,
                }))
              }
            >
              {gitwebUrlRuleKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {kind === "AUTO"
                    ? t("linkKindAuto")
                    : kind === "COMMIT"
                      ? t("linkKindCommit")
                      : t("linkKindSummary")}
                </option>
              ))}
            </select>
            <div className="form-check mb-0">
              <input
                className="form-check-input"
                id="new-gitweb-url-rule-enabled"
                type="checkbox"
                checked={newGitwebUrlRule.enabled}
                onChange={(event) =>
                  setNewGitwebUrlRule((current) => ({
                    ...current,
                    enabled: event.target.checked,
                  }))
                }
              />
              <label
                className="form-check-label"
                htmlFor="new-gitweb-url-rule-enabled"
              >
                {t("enabled")}
              </label>
            </div>
            <button
              className="btn btn-primary d-inline-flex align-items-center gap-2"
              type="button"
              disabled={
                !newGitwebUrlRule.regex.trim() ||
                parseGitwebUrlRulePriority(newGitwebUrlRule.priority) ===
                  null ||
                savingGitwebUrlRule
              }
              onClick={() => void createGitwebUrlRule()}
            >
              {savingGitwebUrlRule ? (
                <span className="spinner-border spinner-border-sm" />
              ) : (
                <i className="bi bi-plus-lg" aria-hidden="true" />
              )}
              {t("add")}
            </button>
          </div>
        </div>

        {gitwebUrlRules.length ? (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th>{t("ruleLabel")}</th>
                  <th>{t("ruleRegex")}</th>
                  <th>{t("ruleRemoteTemplate")}</th>
                  <th>{t("ruleLinkKind")}</th>
                  <th>{t("rulePriority")}</th>
                  <th>{t("enabled")}</th>
                  <th className="text-end">{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {gitwebUrlRules.map((rule) => {
                  const draft = gitwebUrlRuleDrafts[rule.id];
                  const hasGitwebUrlRuleChanges = gitwebUrlRuleDraftChanged(
                    rule,
                    draft,
                  );

                  return (
                    <tr key={rule.id}>
                      <td className="link-rule-cell">
                        <input
                          className="form-control form-control-sm"
                          value={draft?.label ?? ""}
                          onChange={(event) =>
                            updateGitwebUrlRuleDraft(rule.id, {
                              label: event.target.value,
                            })
                          }
                        />
                      </td>
                      <td className="link-rule-cell">
                        <input
                          className="form-control form-control-sm font-monospace"
                          value={draft?.regex ?? ""}
                          onChange={(event) =>
                            updateGitwebUrlRuleDraft(rule.id, {
                              regex: event.target.value,
                            })
                          }
                        />
                      </td>
                      <td className="link-rule-cell">
                        <input
                          className="form-control form-control-sm font-monospace"
                          value={draft?.remoteTemplate ?? ""}
                          onChange={(event) =>
                            updateGitwebUrlRuleDraft(rule.id, {
                              remoteTemplate: event.target.value,
                            })
                          }
                        />
                      </td>
                      <td>
                        <select
                          className="form-select form-select-sm"
                          value={draft?.linkKind ?? "AUTO"}
                          onChange={(event) =>
                            updateGitwebUrlRuleDraft(rule.id, {
                              linkKind: event.target
                                .value as GitwebUrlRuleKind,
                            })
                          }
                        >
                          {gitwebUrlRuleKinds.map((kind) => (
                            <option key={kind} value={kind}>
                              {kind === "AUTO"
                                ? t("linkKindAuto")
                                : kind === "COMMIT"
                                  ? t("linkKindCommit")
                                  : t("linkKindSummary")}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          className="form-control form-control-sm"
                          type="number"
                          min={0}
                          value={draft?.priority ?? "100"}
                          onChange={(event) =>
                            updateGitwebUrlRuleDraft(rule.id, {
                              priority: event.target.value,
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={draft?.enabled ?? false}
                          onChange={(event) =>
                            updateGitwebUrlRuleDraft(rule.id, {
                              enabled: event.target.checked,
                            })
                          }
                        />
                      </td>
                      <td className="text-end">
                        <div className="d-inline-flex flex-wrap justify-content-end gap-2">
                          {draft?.regex.trim() &&
                          parseGitwebUrlRulePriority(draft.priority) !==
                            null &&
                          hasGitwebUrlRuleChanges ? (
                            <button
                              className="btn btn-outline-success btn-sm d-inline-flex align-items-center gap-2"
                              type="button"
                              disabled={
                                updatingGitwebUrlRuleId === rule.id
                              }
                              onClick={() =>
                                void updateGitwebUrlRule(rule.id)
                              }
                            >
                              {updatingGitwebUrlRuleId === rule.id ? (
                                <span className="spinner-border spinner-border-sm" />
                              ) : (
                                <i
                                  className="bi bi-save"
                                  aria-hidden="true"
                                />
                              )}
                              {t("save")}
                            </button>
                          ) : null}
                          <button
                            className="btn btn-outline-danger btn-sm d-inline-flex align-items-center gap-2"
                            type="button"
                            disabled={deletingGitwebUrlRuleId === rule.id}
                            onClick={() =>
                              void deleteGitwebUrlRule(rule.id)
                            }
                          >
                            {deletingGitwebUrlRuleId === rule.id ? (
                              <span className="spinner-border spinner-border-sm" />
                            ) : (
                              <i
                                className="bi bi-trash"
                                aria-hidden="true"
                              />
                            )}
                            {t("remove")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state border rounded">
            {loadingGitwebUrlRules
              ? t("loadingGitwebUrlRules")
              : t("noGitwebUrlRules")}
          </div>
        )}
      </div>
    </div>
  </div>
  );
}
