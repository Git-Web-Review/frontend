import { useAuth } from "../auth/AuthProvider";
import { isFirebaseConfigured } from "../auth/firebase";
import { useI18n } from "../i18n/I18nProvider";
import type { TranslationKey } from "../i18n/translations";

const translatedErrorCodes = new Set<TranslationKey>([
  "EMAIL_DOMAIN_NOT_ALLOWED",
  "INVALID_TOKEN",
  "MISSING_AUTH_HEADER",
]);

export function LoginPage() {
  const { error, loading, signIn } = useAuth();
  const { t } = useI18n();
  const errorMessage = error
    ? translatedErrorCodes.has(error.code as TranslationKey)
      ? t(error.code as TranslationKey)
      : `${t("backendError")} ${error.message}`
    : null;

  return (
    <div className="login-page bg-body-tertiary">
      <div className="login-box">
        <div className="card card-primary card-outline">
          <div className="card-header text-center">
            <span className="h1 fw-light">{t("appName")}</span>
          </div>
          <div className="card-body login-card-body">
            <p className="login-box-msg">{t("loginSubtitle")}</p>
            <h1 className="h4 text-center mb-3">{t("loginTitle")}</h1>
            {!isFirebaseConfigured ? (
              <div className="alert alert-warning">{t("firebaseMissing")}</div>
            ) : null}
            {errorMessage ? (
              <div className="alert alert-danger">{errorMessage}</div>
            ) : null}
            <div className="d-grid">
              <button
                className="btn btn-primary d-inline-flex align-items-center justify-content-center gap-2"
                disabled={!isFirebaseConfigured || loading}
                onClick={() => void signIn()}
              >
                <i className="bi bi-google" aria-hidden="true" />
                {t("loginButton")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
