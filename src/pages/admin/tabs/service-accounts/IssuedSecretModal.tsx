import type { ReactNode } from "react";
import { useI18n } from "../../../../i18n/I18nProvider";
import type { ServiceAccountWithSecret } from "../../../../types/api";

function CopyableField({
  id,
  label,
  value,
  className,
  onCopy,
}: {
  id: string;
  label: ReactNode;
  value: string;
  className: string;
  onCopy: (value: string) => void;
}) {
  const { t } = useI18n();

  return (
    <>
      <label className="form-label" htmlFor={id}>
        {label}
      </label>
      <div className={className}>
        <input
          className="form-control font-monospace"
          id={id}
          readOnly
          value={value}
        />
        <button
          className="btn btn-outline-secondary"
          type="button"
          onClick={() => onCopy(value)}
        >
          {t("copy")}
        </button>
      </div>
    </>
  );
}

/** Shows a freshly issued secret, the only time it can be read. */
export function IssuedSecretModal({
  secret,
  onCopy,
  onClose,
}: {
  secret: ServiceAccountWithSecret;
  onCopy: (value: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();

  return (
    <div
      className="modal fade show d-block"
      role="dialog"
      tabIndex={-1}
      style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{t("serviceAccountSecretTitle")}</h5>
            <button
              className="btn-close"
              type="button"
              aria-label={t("close")}
              onClick={onClose}
            />
          </div>
          <div className="modal-body">
            <div className="alert alert-warning">
              {t("serviceAccountSecretWarning")}
            </div>
            <CopyableField
              id="issued-client-id"
              label={t("serviceAccountClientId")}
              value={secret.clientId}
              className="input-group mb-3"
              onCopy={onCopy}
            />
            <CopyableField
              id="issued-client-secret"
              label="clientSecret"
              value={secret.clientSecret}
              className="input-group"
              onCopy={onCopy}
            />
            <p className="text-secondary small mt-3 mb-0">
              {t("serviceAccountTokenHint")}
            </p>
          </div>
          <div className="modal-footer">
            <button
              className="btn btn-secondary"
              type="button"
              onClick={onClose}
            >
              {t("close")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
