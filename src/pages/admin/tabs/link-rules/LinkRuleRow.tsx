import { useI18n } from "../../../../i18n/I18nProvider";
import type { CommitLogLinkRule } from "../../../../types/api";
import {
  isValidLinkRuleDraft,
  linkRuleDraftChanged,
  type LinkRuleDraft,
  type LinkRules,
} from "./useLinkRules";

type TextFieldKey = "label" | "regex" | "linkTemplate";

/** One rule of the table, edited in place and saved when it changed. */
export function LinkRuleRow({
  rule,
  rules,
}: {
  rule: CommitLogLinkRule;
  rules: LinkRules;
}) {
  const { t } = useI18n();
  const draft = rules.drafts[rule.id];
  const updating = rules.updatingRuleId === rule.id;
  const deleting = rules.deletingRuleId === rule.id;
  const canSave =
    !!draft && isValidLinkRuleDraft(draft) && linkRuleDraftChanged(rule, draft);

  const textCell = (field: TextFieldKey, monospace: boolean) => (
    <td className="link-rule-cell">
      <input
        className={
          monospace
            ? "form-control form-control-sm font-monospace"
            : "form-control form-control-sm"
        }
        value={draft?.[field] ?? ""}
        onChange={(event) =>
          rules.updateDraft(rule.id, {
            [field]: event.target.value,
          } as Partial<LinkRuleDraft>)
        }
      />
    </td>
  );

  return (
    <tr>
      {textCell("label", false)}
      {textCell("regex", true)}
      {textCell("linkTemplate", true)}
      <td>
        <input
          className="form-check-input"
          type="checkbox"
          checked={draft?.enabled ?? false}
          onChange={(event) =>
            rules.updateDraft(rule.id, { enabled: event.target.checked })
          }
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
