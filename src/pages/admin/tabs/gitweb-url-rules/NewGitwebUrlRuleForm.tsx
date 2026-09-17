import { useI18n } from "../../../../i18n/I18nProvider";
import type { GitwebUrlRuleKind } from "../../../../types/api";
import {
  gitwebUrlRuleKinds,
  isValidGitwebUrlRuleDraft,
  linkKindLabel,
  type GitwebUrlRuleDraft,
} from "./gitweb-url-rule-draft";
import type { GitwebUrlRules } from "./useGitwebUrlRules";

type TextFieldKey = "label" | "regex" | "remoteTemplate" | "webTemplate";

function RuleTextField({
  field,
  id,
  columnClassName,
  label,
  placeholder,
  monospace = false,
  draft,
  onChange,
}: {
  field: TextFieldKey;
  id: string;
  columnClassName: string;
  label: string;
  placeholder: string;
  monospace?: boolean;
  draft: GitwebUrlRuleDraft;
  onChange: (nextDraft: Partial<GitwebUrlRuleDraft>) => void;
}) {
  return (
    <div className={columnClassName}>
      <label className="form-label" htmlFor={id}>
        {label}
      </label>
      <input
        className={monospace ? "form-control font-monospace" : "form-control"}
        id={id}
        value={draft[field]}
        placeholder={placeholder}
        onChange={(event) => onChange({ [field]: event.target.value })}
      />
    </div>
  );
}

/** The row of fields above the table that adds a rule. */
export function NewGitwebUrlRuleForm({ rules }: { rules: GitwebUrlRules }) {
  const { t } = useI18n();
  const { newRule: draft, updateNewRule: onChange } = rules;

  return (
    <div className="row g-2 align-items-end mb-3">
      <RuleTextField
        field="label"
        id="new-gitweb-url-rule-label"
        columnClassName="col-lg-2"
        label={t("ruleLabel")}
        placeholder="Label"
        draft={draft}
        onChange={onChange}
      />
      <RuleTextField
        field="regex"
        id="new-gitweb-url-rule-regex"
        columnClassName="col-lg-3"
        label={t("ruleRegex")}
        placeholder="^https?://(?<HOSTNAME>[^/?#]+)..."
        monospace
        draft={draft}
        onChange={onChange}
      />
      <RuleTextField
        field="remoteTemplate"
        id="new-gitweb-url-rule-template"
        columnClassName="col-lg-2"
        label={t("ruleRemoteTemplate")}
        placeholder="git://${HOSTNAME}/${PROJECT}"
        monospace
        draft={draft}
        onChange={onChange}
      />
      <RuleTextField
        field="webTemplate"
        id="new-gitweb-url-rule-web-template"
        columnClassName="col-lg-2"
        label={t("ruleWebTemplate")}
        placeholder="http://${HOSTNAME}/git/?p=${USERNAME}/${PROJECT}.git"
        monospace
        draft={draft}
        onChange={onChange}
      />
      <div className="col-lg-1">
        <label className="form-label" htmlFor="new-gitweb-url-rule-priority">
          {t("rulePriority")}
        </label>
        <input
          className="form-control"
          id="new-gitweb-url-rule-priority"
          type="number"
          min={0}
          value={draft.priority}
          onChange={(event) => onChange({ priority: event.target.value })}
        />
      </div>
      <div className="col-lg-2 d-flex flex-wrap align-items-center gap-2">
        <select
          className="form-select"
          aria-label={t("ruleLinkKind")}
          value={draft.linkKind}
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
        <div className="form-check mb-0">
          <input
            className="form-check-input"
            id="new-gitweb-url-rule-enabled"
            type="checkbox"
            checked={draft.enabled}
            onChange={(event) => onChange({ enabled: event.target.checked })}
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
          disabled={!isValidGitwebUrlRuleDraft(draft) || rules.saving}
          onClick={() => void rules.createRule()}
        >
          {rules.saving ? (
            <span className="spinner-border spinner-border-sm" />
          ) : (
            <i className="bi bi-plus-lg" aria-hidden="true" />
          )}
          {t("add")}
        </button>
      </div>
    </div>
  );
}
