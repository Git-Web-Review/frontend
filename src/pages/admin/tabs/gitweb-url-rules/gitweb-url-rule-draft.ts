import type { useI18n } from "../../../../i18n/I18nProvider";
import type { GitwebUrlRule, GitwebUrlRuleKind } from "../../../../types/api";

export type GitwebUrlRuleDraft = {
  label: string;
  regex: string;
  remoteTemplate: string;
  webTemplate: string;
  linkKind: GitwebUrlRuleKind;
  priority: string;
  enabled: boolean;
};

export const gitwebUrlRuleKinds: GitwebUrlRuleKind[] = [
  "AUTO",
  "COMMIT",
  "SUMMARY",
];

export const emptyGitwebUrlRuleDraft: GitwebUrlRuleDraft = {
  label: "",
  regex: "",
  remoteTemplate: "",
  webTemplate: "",
  linkKind: "AUTO",
  priority: "100",
  enabled: true,
};

export const parseGitwebUrlRulePriority = (value: string): number | null => {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
};

/** A draft the backend would accept: a regex and a valid priority. */
export const isValidGitwebUrlRuleDraft = (draft: GitwebUrlRuleDraft) =>
  !!draft.regex.trim() && parseGitwebUrlRulePriority(draft.priority) !== null;

export const linkKindLabel = (
  kind: GitwebUrlRuleKind,
  t: ReturnType<typeof useI18n>["t"],
) =>
  kind === "AUTO"
    ? t("linkKindAuto")
    : kind === "COMMIT"
      ? t("linkKindCommit")
      : t("linkKindSummary");

export const draftsFromGitwebUrlRules = (rules: GitwebUrlRule[]) =>
  Object.fromEntries(
    rules.map((rule) => [
      rule.id,
      {
        label: rule.label ?? "",
        regex: rule.regex,
        remoteTemplate: rule.remoteTemplate ?? "",
        webTemplate: rule.webTemplate ?? "",
        linkKind: rule.linkKind,
        priority: String(rule.priority),
        enabled: rule.enabled,
      },
    ]),
  );

export const gitwebUrlRuleDraftChanged = (
  rule: GitwebUrlRule,
  draft: GitwebUrlRuleDraft | undefined,
) =>
  !!draft &&
  (draft.label !== (rule.label ?? "") ||
    draft.regex !== rule.regex ||
    draft.remoteTemplate !== (rule.remoteTemplate ?? "") ||
    draft.webTemplate !== (rule.webTemplate ?? "") ||
    draft.linkKind !== rule.linkKind ||
    parseGitwebUrlRulePriority(draft.priority) !== rule.priority ||
    draft.enabled !== rule.enabled);

/** The request body for a draft, blank optional texts sent as null. */
export const gitwebUrlRulePayload = (
  draft: GitwebUrlRuleDraft,
  priority: number,
) =>
  JSON.stringify({
    label: draft.label.trim() || null,
    regex: draft.regex.trim(),
    remoteTemplate: draft.remoteTemplate.trim() || null,
    webTemplate: draft.webTemplate.trim() || null,
    linkKind: draft.linkKind,
    priority,
    enabled: draft.enabled,
  });
