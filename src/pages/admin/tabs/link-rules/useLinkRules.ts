import { useEffect, useState } from "react";
import { apiRequest, ApiClientError } from "../../../../api/client";
import { useAuth } from "../../../../auth/AuthProvider";
import { useI18n } from "../../../../i18n/I18nProvider";
import type { TranslationKey } from "../../../../i18n/translations";
import { useToast } from "../../../../layout/ToastProvider";
import type {
  CommitLogLinkRule,
  CommitLogLinkRuleDeletion,
} from "../../../../types/api";

export type LinkRuleDraft = {
  label: string;
  regex: string;
  linkTemplate: string;
  enabled: boolean;
};

const emptyLinkRuleDraft: LinkRuleDraft = {
  label: "",
  regex: "",
  linkTemplate: "",
  enabled: true,
};

/** A draft the backend would accept: a regex and a link template. */
export const isValidLinkRuleDraft = (draft: LinkRuleDraft) =>
  !!draft.regex.trim() && !!draft.linkTemplate.trim();

export const linkRuleDraftChanged = (
  rule: CommitLogLinkRule,
  draft: LinkRuleDraft | undefined,
) =>
  !!draft &&
  (draft.label !== (rule.label ?? "") ||
    draft.regex !== rule.regex ||
    draft.linkTemplate !== rule.linkTemplate ||
    draft.enabled !== rule.enabled);

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

const linkRulePayload = (draft: LinkRuleDraft) =>
  JSON.stringify({
    label: draft.label.trim() || null,
    regex: draft.regex.trim(),
    linkTemplate: draft.linkTemplate.trim(),
    enabled: draft.enabled,
  });

/** The commit log link rules, one editable draft per rule plus the new one. */
export function useLinkRules() {
  const { idToken } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();
  const [rules, setRules] = useState<CommitLogLinkRule[]>([]);
  const [drafts, setDrafts] = useState<Record<string, LinkRuleDraft>>({});
  const [newRule, setNewRule] = useState<LinkRuleDraft>(emptyLinkRuleDraft);
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
      const nextRules = await apiRequest<CommitLogLinkRule[]>(
        "/commit-log-link-rules",
        idToken,
      );
      setRules(nextRules);
      setDrafts(draftsFromRules(nextRules));
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
    setPending: (pending: boolean) => void,
    request: (token: string) => Promise<unknown>,
    successKey: TranslationKey,
  ) => {
    if (!idToken) {
      return;
    }

    setPending(true);
    setErrorMessage("");
    try {
      await request(idToken);
      showToast(t(successKey));
      await loadRules();
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setPending(false);
    }
  };

  const createRule = async () => {
    if (!isValidLinkRuleDraft(newRule)) {
      return;
    }

    await mutate(
      setSaving,
      async (token) => {
        await apiRequest<CommitLogLinkRule>("/commit-log-link-rules", token, {
          method: "POST",
          body: linkRulePayload(newRule),
        });
        setNewRule(emptyLinkRuleDraft);
      },
      "commitLogLinkRuleCreated",
    );
  };

  const updateRule = async (ruleId: string) => {
    const draft = drafts[ruleId];
    const rule = rules.find((currentRule) => currentRule.id === ruleId);
    if (
      !rule ||
      !draft ||
      !isValidLinkRuleDraft(draft) ||
      !linkRuleDraftChanged(rule, draft)
    ) {
      return;
    }

    await mutate(
      (pending) => setUpdatingRuleId(pending ? ruleId : null),
      (token) =>
        apiRequest<CommitLogLinkRule>(`/commit-log-link-rules/${ruleId}`, token, {
          method: "PATCH",
          body: linkRulePayload(draft),
        }),
      "commitLogLinkRuleUpdated",
    );
  };

  const deleteRule = (ruleId: string) =>
    mutate(
      (pending) => setDeletingRuleId(pending ? ruleId : null),
      (token) =>
        apiRequest<CommitLogLinkRuleDeletion>(
          `/commit-log-link-rules/${ruleId}`,
          token,
          { method: "DELETE" },
        ),
      "commitLogLinkRuleDeleted",
    );

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
    updateDraft: (ruleId: string, nextDraft: Partial<LinkRuleDraft>) =>
      setDrafts((current) => ({
        ...current,
        [ruleId]: { ...current[ruleId], ...nextDraft },
      })),
    updateNewRule: (nextDraft: Partial<LinkRuleDraft>) =>
      setNewRule((current) => ({ ...current, ...nextDraft })),
  };
}

export type LinkRules = ReturnType<typeof useLinkRules>;
