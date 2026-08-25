import { useEffect, useState } from "react";
import { apiRequest, ApiClientError } from "../../../api/client";
import { useAuth } from "../../../auth/AuthProvider";
import { RefreshButton } from "../../../components/RefreshButton";
import { useI18n } from "../../../i18n/I18nProvider";
import { useToast } from "../../../layout/ToastProvider";
import type { CommitLogLinkRule, CommitLogLinkRuleDeletion } from "../../../types/api";

type LinkRuleDraft = {
  label: string;
  regex: string;
  linkTemplate: string;
  enabled: boolean;
};

export function LinkRulesTab() {
  const { idToken } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();
  const [linkRules, setLinkRules] = useState<CommitLogLinkRule[]>([]);
  const [linkRuleDrafts, setLinkRuleDrafts] = useState<
    Record<string, LinkRuleDraft>
  >({});
  const [newLinkRule, setNewLinkRule] = useState<LinkRuleDraft>({
    label: "",
    regex: "",
    linkTemplate: "",
    enabled: true,
  });
  const [loadingLinkRules, setLoadingLinkRules] = useState(false);
  const [savingLinkRule, setSavingLinkRule] = useState(false);
  const [updatingLinkRuleId, setUpdatingLinkRuleId] = useState<string | null>(
    null,
  );
  const [deletingLinkRuleId, setDeletingLinkRuleId] = useState<string | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState("");

  const errorLabel = (error: unknown) => {
    if (error instanceof ApiClientError) {
      return t(error.apiError.code);
    }

    return error instanceof Error ? error.message : t("backendError");
  };

  const draftsFromRules = (rules: CommitLogLinkRule[]) =>
    Object.fromEntries(
      rules.map((rule) => [
        rule.id,
        {
          label: rule.label ?? "",
          regex: rule.regex,
          linkTemplate: rule.linkTemplate,
          enabled: rule.enabled,
        },
      ]),
    );

  const loadLinkRules = async () => {
    if (!idToken) {
      return;
    }

    setLoadingLinkRules(true);
    setErrorMessage("");
    try {
      const rules = await apiRequest<CommitLogLinkRule[]>(
        "/v1/commit-log-link-rules",
        idToken,
      );
      setLinkRules(rules);
      setLinkRuleDrafts(draftsFromRules(rules));
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setLoadingLinkRules(false);
    }
  };

  useEffect(() => {
    void loadLinkRules();
  }, [idToken]);

  const linkRuleDraftChanged = (
    rule: CommitLogLinkRule,
    draft: LinkRuleDraft | undefined,
  ) =>
    !!draft &&
    (draft.label !== (rule.label ?? "") ||
      draft.regex !== rule.regex ||
      draft.linkTemplate !== rule.linkTemplate ||
      draft.enabled !== rule.enabled);

  const updateLinkRuleDraft = (
    ruleId: string,
    nextDraft: Partial<LinkRuleDraft>,
  ) => {
    setLinkRuleDrafts((current) => ({
      ...current,
      [ruleId]: { ...current[ruleId], ...nextDraft },
    }));
  };

  const createLinkRule = async () => {
    if (!idToken || !newLinkRule.regex.trim() || !newLinkRule.linkTemplate.trim()) {
      return;
    }

    setSavingLinkRule(true);
    setErrorMessage("");
    try {
      await apiRequest<CommitLogLinkRule>("/v1/commit-log-link-rules", idToken, {
        method: "POST",
        body: JSON.stringify({
          label: newLinkRule.label.trim() || null,
          regex: newLinkRule.regex.trim(),
          linkTemplate: newLinkRule.linkTemplate.trim(),
          enabled: newLinkRule.enabled,
        }),
      });
      setNewLinkRule({
        label: "",
        regex: "",
        linkTemplate: "",
        enabled: true,
      });
      showToast(t("commitLogLinkRuleCreated"));
      await loadLinkRules();
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setSavingLinkRule(false);
    }
  };

  const updateLinkRule = async (ruleId: string) => {
    const draft = linkRuleDrafts[ruleId];
    const rule = linkRules.find((currentRule) => currentRule.id === ruleId);
    if (
      !idToken ||
      !rule ||
      !draft?.regex.trim() ||
      !draft.linkTemplate.trim() ||
      !linkRuleDraftChanged(rule, draft)
    ) {
      return;
    }

    setUpdatingLinkRuleId(ruleId);
    setErrorMessage("");
    try {
      await apiRequest<CommitLogLinkRule>(
        `/v1/commit-log-link-rules/${ruleId}`,
        idToken,
        {
          method: "PATCH",
          body: JSON.stringify({
            label: draft.label.trim() || null,
            regex: draft.regex.trim(),
            linkTemplate: draft.linkTemplate.trim(),
            enabled: draft.enabled,
          }),
        },
      );
      showToast(t("commitLogLinkRuleUpdated"));
      await loadLinkRules();
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setUpdatingLinkRuleId(null);
    }
  };

  const deleteLinkRule = async (ruleId: string) => {
    if (!idToken) {
      return;
    }

    setDeletingLinkRuleId(ruleId);
    setErrorMessage("");
    try {
      await apiRequest<CommitLogLinkRuleDeletion>(
        `/v1/commit-log-link-rules/${ruleId}`,
        idToken,
        { method: "DELETE" },
      );
      showToast(t("commitLogLinkRuleDeleted"));
      await loadLinkRules();
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setDeletingLinkRuleId(null);
    }
  };

  return (
  <div className="col-12">
    <div className="card card-primary card-outline">
      <div className="card-header d-flex flex-wrap align-items-center justify-content-between gap-3">
        <h3 className="card-title mb-0">{t("commitLogLinkRules")}</h3>
        <RefreshButton
          disabled={!idToken}
          loading={loadingLinkRules}
          onClick={() => void loadLinkRules()}
        />
      </div>
      <div className="card-body">
        <p className="text-secondary small mb-3">
          {t("commitLogLinkRuleVariables")}
        </p>
        <div className="row g-2 align-items-end mb-3">
          <div className="col-lg-2">
            <label className="form-label" htmlFor="new-link-rule-label">
              {t("ruleLabel")}
            </label>
            <input
              className="form-control"
              id="new-link-rule-label"
              value={newLinkRule.label}
              placeholder="Label"
              onChange={(event) =>
                setNewLinkRule((current) => ({
                  ...current,
                  label: event.target.value,
                }))
              }
            />
          </div>
          <div className="col-lg-4">
            <label className="form-label" htmlFor="new-link-rule-regex">
              {t("ruleRegex")}
            </label>
            <input
              className="form-control font-monospace"
              id="new-link-rule-regex"
              value={newLinkRule.regex}
              placeholder="Issue: (?<ISSUE_ID>\\d+)"
              onChange={(event) =>
                setNewLinkRule((current) => ({
                  ...current,
                  regex: event.target.value,
                }))
              }
            />
          </div>
          <div className="col-lg-4">
            <label className="form-label" htmlFor="new-link-rule-template">
              {t("ruleLinkTemplate")}
            </label>
            <input
              className="form-control font-monospace"
              id="new-link-rule-template"
              placeholder="https://tracker.example.test/issues/${ISSUE_ID}"
              value={newLinkRule.linkTemplate}
              onChange={(event) =>
                setNewLinkRule((current) => ({
                  ...current,
                  linkTemplate: event.target.value,
                }))
              }
            />
          </div>
          <div className="col-lg-2 d-flex flex-wrap align-items-center gap-2">
            <div className="form-check mb-0">
              <input
                className="form-check-input"
                id="new-link-rule-enabled"
                type="checkbox"
                checked={newLinkRule.enabled}
                onChange={(event) =>
                  setNewLinkRule((current) => ({
                    ...current,
                    enabled: event.target.checked,
                  }))
                }
              />
              <label
                className="form-check-label"
                htmlFor="new-link-rule-enabled"
              >
                {t("enabled")}
              </label>
            </div>
            <button
              className="btn btn-primary d-inline-flex align-items-center gap-2"
              type="button"
              disabled={
                !newLinkRule.regex.trim() ||
                !newLinkRule.linkTemplate.trim() ||
                savingLinkRule
              }
              onClick={() => void createLinkRule()}
            >
              {savingLinkRule ? (
                <span className="spinner-border spinner-border-sm" />
              ) : (
                <i className="bi bi-plus-lg" aria-hidden="true" />
              )}
              {t("add")}
            </button>
          </div>
        </div>

        {linkRules.length ? (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th>{t("ruleLabel")}</th>
                  <th>{t("ruleRegex")}</th>
                  <th>{t("ruleLinkTemplate")}</th>
                  <th>{t("enabled")}</th>
                  <th className="text-end">{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {linkRules.map((rule) => {
                  const draft = linkRuleDrafts[rule.id];
                  const hasLinkRuleChanges = linkRuleDraftChanged(rule, draft);

                  return (
                    <tr key={rule.id}>
                      <td className="link-rule-cell">
                        <input
                          className="form-control form-control-sm"
                          value={draft?.label ?? ""}
                          onChange={(event) =>
                            updateLinkRuleDraft(rule.id, {
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
                            updateLinkRuleDraft(rule.id, {
                              regex: event.target.value,
                            })
                          }
                        />
                      </td>
                      <td className="link-rule-cell">
                        <input
                          className="form-control form-control-sm font-monospace"
                          value={draft?.linkTemplate ?? ""}
                          onChange={(event) =>
                            updateLinkRuleDraft(rule.id, {
                              linkTemplate: event.target.value,
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
                            updateLinkRuleDraft(rule.id, {
                              enabled: event.target.checked,
                            })
                          }
                        />
                      </td>
                      <td className="text-end">
                        <div className="d-inline-flex flex-wrap justify-content-end gap-2">
                          {draft?.regex.trim() &&
                          draft.linkTemplate.trim() &&
                          hasLinkRuleChanges ? (
                            <button
                              className="btn btn-outline-success btn-sm d-inline-flex align-items-center gap-2"
                              type="button"
                              disabled={updatingLinkRuleId === rule.id}
                              onClick={() => void updateLinkRule(rule.id)}
                            >
                              {updatingLinkRuleId === rule.id ? (
                                <span className="spinner-border spinner-border-sm" />
                              ) : (
                                <i className="bi bi-save" aria-hidden="true" />
                              )}
                              {t("save")}
                            </button>
                          ) : null}
                          <button
                            className="btn btn-outline-danger btn-sm d-inline-flex align-items-center gap-2"
                            type="button"
                            disabled={deletingLinkRuleId === rule.id}
                            onClick={() => void deleteLinkRule(rule.id)}
                          >
                            {deletingLinkRuleId === rule.id ? (
                              <span className="spinner-border spinner-border-sm" />
                            ) : (
                              <i className="bi bi-trash" aria-hidden="true" />
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
            {loadingLinkRules ? t("loadingLinkRules") : t("noLinkRules")}
          </div>
        )}
      </div>
    </div>
  </div>
  );
}
