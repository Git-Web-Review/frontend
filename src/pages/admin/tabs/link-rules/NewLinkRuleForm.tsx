import { useI18n } from "../../../../i18n/I18nProvider";
import {
  isValidLinkRuleDraft,
  type LinkRuleDraft,
  type LinkRules,
} from "./useLinkRules";

type TextFieldKey = "label" | "regex" | "linkTemplate";

function RuleTextField({
  field,
  id,
  columnClassName,
  label,
  placeholder,
  monospace = false,
  rules,
}: {
  field: TextFieldKey;
  id: string;
  columnClassName: string;
  label: string;
  placeholder: string;
  monospace?: boolean;
  rules: LinkRules;
}) {
  return (
    <div className={columnClassName}>
      <label className="form-label" htmlFor={id}>
        {label}
      </label>
      <input
        className={monospace ? "form-control font-monospace" : "form-control"}
        id={id}
        value={rules.newRule[field]}
        placeholder={placeholder}
        onChange={(event) =>
          rules.updateNewRule({
            [field]: event.target.value,
          } as Partial<LinkRuleDraft>)
        }
      />
    </div>
  );
}

/** The row of fields above the table that adds a rule. */
export function NewLinkRuleForm({ rules }: { rules: LinkRules }) {
  const { t } = useI18n();

  return (
    <div className="row g-2 align-items-end mb-3">
      <RuleTextField
        field="label"
        id="new-link-rule-label"
        columnClassName="col-lg-2"
        label={t("ruleLabel")}
        placeholder="Label"
        rules={rules}
      />
      <RuleTextField
        field="regex"
        id="new-link-rule-regex"
        columnClassName="col-lg-4"
        label={t("ruleRegex")}
        placeholder="Issue: (?<ISSUE_ID>\\d+)"
        monospace
        rules={rules}
      />
      <RuleTextField
        field="linkTemplate"
        id="new-link-rule-template"
        columnClassName="col-lg-4"
        label={t("ruleLinkTemplate")}
        placeholder="https://tracker.example.test/issues/${ISSUE_ID}"
        monospace
        rules={rules}
      />
      <div className="col-lg-2 d-flex flex-wrap align-items-center gap-2">
        <div className="form-check mb-0">
          <input
            className="form-check-input"
            id="new-link-rule-enabled"
            type="checkbox"
            checked={rules.newRule.enabled}
            onChange={(event) =>
              rules.updateNewRule({ enabled: event.target.checked })
            }
          />
          <label className="form-check-label" htmlFor="new-link-rule-enabled">
            {t("enabled")}
          </label>
        </div>
        <button
          className="btn btn-primary d-inline-flex align-items-center gap-2"
          type="button"
          disabled={!isValidLinkRuleDraft(rules.newRule) || rules.saving}
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
