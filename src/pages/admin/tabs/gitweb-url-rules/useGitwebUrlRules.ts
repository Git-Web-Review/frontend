import { useEffect, useState } from "react";
import { apiRequest, ApiClientError } from "../../../../api/client";
import { useAuth } from "../../../../auth/AuthProvider";
import { useI18n } from "../../../../i18n/I18nProvider";
import { useToast } from "../../../../layout/ToastProvider";
import type {
  GitwebUrlRule,
  GitwebUrlRuleDeletion,
} from "../../../../types/api";
import {
  draftsFromGitwebUrlRules,
  emptyGitwebUrlRuleDraft,
  gitwebUrlRuleDraftChanged,
  gitwebUrlRulePayload,
  parseGitwebUrlRulePriority,
  type GitwebUrlRuleDraft,
} from "./gitweb-url-rule-draft";

/** The git-web URL rules, one editable draft per rule plus the new one. */
export function useGitwebUrlRules() {
  const { idToken } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();
  const [rules, setRules] = useState<GitwebUrlRule[]>([]);
  const [drafts, setDrafts] = useState<Record<string, GitwebUrlRuleDraft>>({});
  const [newRule, setNewRule] = useState<GitwebUrlRuleDraft>(
    emptyGitwebUrlRuleDraft,
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingRuleId, setUpdatingRuleId] = useState<string | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const errorLabel = (error: unknown) => {
    if (error instanceof ApiClientError) {
      return t(error.apiError.code);
    }

    return error instanceof Error ? error.message : t("backendError");
  };

  const loadRules = async () => {
    if (!idToken) {
      return;
    }

    setLoading(true);
    setErrorMessage("");
    try {
      const nextRules = await apiRequest<GitwebUrlRule[]>(
        "/gitweb-url-rules",
        idToken,
      );
      setRules(nextRules);
      setDrafts(draftsFromGitwebUrlRules(nextRules));
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRules();
  }, [idToken]);

  /** Runs a change, then reloads the rules; errors land in the message. */
  const mutate = async (
    setPending: () => void,
    clearPending: () => void,
    request: (token: string) => Promise<unknown>,
    successKey: Parameters<typeof t>[0],
  ) => {
    if (!idToken) {
      return;
    }

    setPending();
    setErrorMessage("");
    try {
      await request(idToken);
      showToast(t(successKey));
      await loadRules();
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      clearPending();
    }
  };

  const createRule = async () => {
    const priority = parseGitwebUrlRulePriority(newRule.priority);
    if (!newRule.regex.trim() || priority === null) {
      return;
    }

    await mutate(
      () => setSaving(true),
      () => setSaving(false),
      async (token) => {
        await apiRequest<GitwebUrlRule>("/gitweb-url-rules", token, {
          method: "POST",
          body: gitwebUrlRulePayload(newRule, priority),
        });
        setNewRule(emptyGitwebUrlRuleDraft);
      },
      "gitwebUrlRuleCreated",
    );
  };

  const updateRule = async (ruleId: string) => {
    const draft = drafts[ruleId];
    const rule = rules.find((currentRule) => currentRule.id === ruleId);
    const priority = draft ? parseGitwebUrlRulePriority(draft.priority) : null;
    if (
      !rule ||
      !draft?.regex.trim() ||
      priority === null ||
      !gitwebUrlRuleDraftChanged(rule, draft)
    ) {
      return;
    }

    await mutate(
      () => setUpdatingRuleId(ruleId),
      () => setUpdatingRuleId(null),
      (token) =>
        apiRequest<GitwebUrlRule>(`/gitweb-url-rules/${ruleId}`, token, {
          method: "PATCH",
          body: gitwebUrlRulePayload(draft, priority),
        }),
      "gitwebUrlRuleUpdated",
    );
  };

  const deleteRule = (ruleId: string) =>
    mutate(
      () => setDeletingRuleId(ruleId),
      () => setDeletingRuleId(null),
      (token) =>
        apiRequest<GitwebUrlRuleDeletion>(`/gitweb-url-rules/${ruleId}`, token, {
          method: "DELETE",
        }),
      "gitwebUrlRuleDeleted",
    );

  const updateDraft = (
    ruleId: string,
    nextDraft: Partial<GitwebUrlRuleDraft>,
  ) => {
    setDrafts((current) => ({
      ...current,
      [ruleId]: { ...current[ruleId], ...nextDraft },
    }));
  };

  const updateNewRule = (nextDraft: Partial<GitwebUrlRuleDraft>) =>
    setNewRule((current) => ({ ...current, ...nextDraft }));

  return {
    rules,
    drafts,
    newRule,
    loading,
    saving,
    updatingRuleId,
    deletingRuleId,
    errorMessage,
    loadRules,
    createRule,
    updateRule,
    deleteRule,
    updateDraft,
    updateNewRule,
  };
}

export type GitwebUrlRules = ReturnType<typeof useGitwebUrlRules>;
