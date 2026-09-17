import { useAuth } from "../../../../auth/AuthProvider";
import { useI18n } from "../../../../i18n/I18nProvider";
import type { ServiceAccountForm, ServiceAccounts } from "./useServiceAccounts";

type TextFieldKey = "name" | "clientId" | "email" | "description";

function AccountTextField({
  field,
  id,
  label,
  help,
  type,
  placeholder,
  accounts,
}: {
  field: TextFieldKey;
  id: string;
  label: string;
  help?: string;
  type?: string;
  placeholder?: string;
  accounts: ServiceAccounts;
}) {
  return (
    <div className="col-12 col-md-3">
      <label className="form-label" htmlFor={id}>
        {label}
      </label>
      <input
        className="form-control"
        id={id}
        type={type}
        placeholder={placeholder}
        value={accounts.form[field]}
        onChange={(event) =>
          accounts.updateForm({
            [field]: event.target.value,
          } as Partial<ServiceAccountForm>)
        }
      />
      {help ? <div className="form-text">{help}</div> : null}
    </div>
  );
}

/** The fields at the top of the tab that create a service account. */
export function NewServiceAccountForm({
  accounts,
}: {
  accounts: ServiceAccounts;
}) {
  const { idToken } = useAuth();
  const { t } = useI18n();

  return (
    <div className="card-body border-bottom">
      <div className="row g-3 align-items-start">
        <AccountTextField
          field="name"
          id="service-account-name"
          label={t("serviceAccountName")}
          accounts={accounts}
        />
        <AccountTextField
          field="clientId"
          id="service-account-client-id"
          label={t("serviceAccountClientId")}
          help={t("serviceAccountClientIdHelp")}
          placeholder="review-bot"
          accounts={accounts}
        />
        <AccountTextField
          field="email"
          id="service-account-email"
          label={t("serviceAccountEmail")}
          help={t("serviceAccountEmailHelp")}
          type="email"
          accounts={accounts}
        />
        <AccountTextField
          field="description"
          id="service-account-description"
          label={t("serviceAccountDescription")}
          accounts={accounts}
        />
        <div className="col-12 d-flex flex-wrap align-items-center gap-3">
          <div className="form-check mb-0">
            <input
              className="form-check-input"
              id="service-account-admin"
              type="checkbox"
              checked={accounts.form.admin}
              onChange={(event) =>
                accounts.updateForm({ admin: event.target.checked })
              }
            />
            <label className="form-check-label" htmlFor="service-account-admin">
              {t("serviceAccountAdmin")}
            </label>
          </div>
          <button
            className="btn btn-warning d-inline-flex align-items-center gap-2 ms-auto"
            type="button"
            disabled={!accounts.form.name.trim() || accounts.saving || !idToken}
            onClick={() => void accounts.createAccount()}
          >
            {accounts.saving ? (
              <span className="spinner-border spinner-border-sm" />
            ) : (
              <i className="bi bi-robot" aria-hidden="true" />
            )}
            {t("addServiceAccount")}
          </button>
        </div>
      </div>
    </div>
  );
}
