import { useAuth } from "../../../auth/AuthProvider";
import { RefreshButton } from "../../../components/RefreshButton";
import { useI18n } from "../../../i18n/I18nProvider";
import { IssuedSecretModal } from "./service-accounts/IssuedSecretModal";
import { NewServiceAccountForm } from "./service-accounts/NewServiceAccountForm";
import { ServiceAccountRow } from "./service-accounts/ServiceAccountRow";
import { useServiceAccounts } from "./service-accounts/useServiceAccounts";

export function ServiceAccountsTab() {
  const { idToken } = useAuth();
  const { t } = useI18n();
  const accounts = useServiceAccounts();

  return (
    <div className="col-12">
      <div className="card h-100">
        <div className="card-header d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h3 className="card-title mb-1">{t("serviceAccounts")}</h3>
            <p className="text-secondary small mb-0">
              {t("serviceAccountsHelp")}
            </p>
          </div>
          <RefreshButton
            disabled={!idToken}
            loading={accounts.loading}
            onClick={() => void accounts.loadAccounts()}
          />
        </div>

        <NewServiceAccountForm accounts={accounts} />

        <div className="card-body p-0">
          {accounts.errorMessage ? (
            <div className="alert alert-danger m-3">
              {accounts.errorMessage}
            </div>
          ) : null}
          {accounts.accounts.length ? (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>{t("serviceAccountName")}</th>
                    <th>{t("serviceAccountClientId")}</th>
                    <th>{t("serviceAccountEmail")}</th>
                    <th>{t("serviceAccountStatus")}</th>
                    <th>{t("serviceAccountLastUsed")}</th>
                    <th className="text-end">{t("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.accounts.map((account) => (
                    <ServiceAccountRow
                      key={account.id}
                      account={account}
                      accounts={accounts}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              {accounts.loading
                ? t("loadingServiceAccounts")
                : t("noServiceAccounts")}
            </div>
          )}
        </div>
      </div>

      {accounts.issuedSecret ? (
        <IssuedSecretModal
          secret={accounts.issuedSecret}
          onCopy={(value) => void accounts.copyToClipboard(value)}
          onClose={accounts.closeIssuedSecret}
        />
      ) : null}
    </div>
  );
}
