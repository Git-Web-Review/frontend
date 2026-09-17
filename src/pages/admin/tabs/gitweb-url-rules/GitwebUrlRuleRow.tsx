import { useI18n } from "../../../../i18n/I18nProvider";
import type { GitwebUrlRule, GitwebUrlRuleKind } from "../../../../types/api";
import {
  gitwebUrlRuleDraftChanged,
  gitwebUrlRuleKinds,
  isValidGitwebUrlRuleDraft,
  linkKindLabel,
  type GitwebUrlRuleDraft,
} from "./gitweb-url-rule-draft";
import type { GitwebUrlRules } from "./useGitwebUrlRules";

type TextFieldKey = "label" | "regex" | "remoteTemplate" | "webTemplate";

function RuleTextCell({
  field,
  monospace = false,
  draft,
  onChange,
}: {
  field: TextFieldKey;
  monospace?: boolean;
  draft: GitwebUrlRuleDraft | undefined;
  onChange: (nextDraft: Partial<GitwebUrlRuleDraft>) => void;
}) {
  return (
    <td className="link-rule-cell">
      <input
        className={
          monospace
            ? "form-control form-control-sm font-monospace"
            : "form-control form-control-sm"
        }
        value={draft?.[field] ?? ""}
        onChange={(event) => onChange({ [field]: event.target.value })}
      />
    </td>
  );
}

/** One rule of the table, edited in place and saved when it changed. */
export function GitwebUrlRuleRow({
  rule,
  rules,
}: {
  rule: GitwebUrlRule;
  rules: GitwebUrlRules;
}) {
  const { t } = useI18n();
  const draft = rules.drafts[rule.id];
  const onChange = (nextDraft: Partial<GitwebUrlRuleDraft>) =>
    rules.updateDraft(rule.id, nextDraft);
  const updating = rules.updatingRuleId === rule.id;
  const deleting = rules.deletingRuleId === rule.id;
  const canSave =
    !!draft &&
    isValidGitwebUrlRuleDraft(draft) &&
    gitwebUrlRuleDraftChanged(rule, draft);

  return (
    <tr>
      <RuleTextCell field="label" draft={draft} onChange={onChange} />
      <RuleTextCell field="regex" monospace draft={draft} onChange={onChange} />
      <RuleTextCell
        field="remoteTemplate"
        monospace
        draft={draft}
        onChange={onChange}
      />
      <RuleTextCell
        field="webTemplate"
        monospace
        draft={draft}
        onChange={onChange}
      />
      <td>
        <select
          className="form-select form-select-sm"
          value={draft?.linkKind ?? "AUTO"}
          onChange={(event) =>
            onChange({ linkKind: event.target.value as GitwebUrlRuleKind })
          }
        >
          {gitwebUrlRuleKinds.map((kind) => (
            <option key={kind} value={kind}>
              {linkKindLabel(kind, t)}
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
          onChange={(event) => onChange({ priority: event.target.value })}
        />
      </td>
      <td>
        <input
          className="form-check-input"
          type="checkbox"
          checked={draft?.enabled ?? false}
          onChange={(event) => onChange({ enabled: event.target.checked })}
        />
      </td>
      <td className="text-end">
        <div className="d-inline-flex flex-wrap justify-content-end gap-2">
          {canSave ? (
            <button
              className="btn btn-outline-success btn-sm d-inline-flex align-items-center gap-2"
              type="button"
              disabled={updating}
              onClick={() => void rules.updateRule(rule.id)}
            >
              {updating ? (
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
            disabled={deleting}
            onClick={() => void rules.deleteRule(rule.id)}
          >
            {deleting ? (
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
}
