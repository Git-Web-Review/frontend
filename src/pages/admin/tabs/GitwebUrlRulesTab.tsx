import { useAuth } from "../../../auth/AuthProvider";
import { RefreshButton } from "../../../components/RefreshButton";
import { useI18n } from "../../../i18n/I18nProvider";
import { GitwebUrlRuleRow } from "./gitweb-url-rules/GitwebUrlRuleRow";
import { NewGitwebUrlRuleForm } from "./gitweb-url-rules/NewGitwebUrlRuleForm";
import { useGitwebUrlRules } from "./gitweb-url-rules/useGitwebUrlRules";

export function GitwebUrlRulesTab() {
  const { idToken } = useAuth();
  const { t } = useI18n();
  const rules = useGitwebUrlRules();

  return (
    <div className="col-12">
      <div className="card card-primary card-outline">
        <div className="card-header d-flex flex-wrap align-items-center justify-content-between gap-3">
          <h3 className="card-title mb-0">{t("gitwebUrlRules")}</h3>
          <RefreshButton
            disabled={!idToken}
            loading={rules.loading}
            onClick={() => void rules.loadRules()}
          />
        </div>
        <div className="card-body">
          {rules.errorMessage ? (
            <div className="alert alert-danger">{rules.errorMessage}</div>
          ) : null}
          <p className="text-secondary small mb-3">
            {t("gitwebUrlRuleVariables")}
          </p>
          <NewGitwebUrlRuleForm rules={rules} />

          {rules.rules.length ? (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>{t("ruleLabel")}</th>
                    <th>{t("ruleRegex")}</th>
                    <th>{t("ruleRemoteTemplate")}</th>
                    <th>{t("ruleWebTemplate")}</th>
                    <th>{t("ruleLinkKind")}</th>
                    <th>{t("rulePriority")}</th>
                    <th>{t("enabled")}</th>
                    <th className="text-end">{t("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.rules.map((rule) => (
                    <GitwebUrlRuleRow key={rule.id} rule={rule} rules={rules} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state border rounded">
              {rules.loading
                ? t("loadingGitwebUrlRules")
                : t("noGitwebUrlRules")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
