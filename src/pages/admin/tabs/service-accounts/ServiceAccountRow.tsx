import { useRef } from "react";
import { useAuth } from "../../../../auth/AuthProvider";
import { UserAvatar } from "../../../../components/UserAvatar";
import { useI18n } from "../../../../i18n/I18nProvider";
import type { ServiceAccount } from "../../../../types/api";
import { formatDateTime } from "../../../../utils/formatDate";
import type { ServiceAccounts } from "./useServiceAccounts";

/** One service account: identity, status, last use and its actions. */
export function ServiceAccountRow({
  account,
  accounts,
}: {
  account: ServiceAccount;
  accounts: ServiceAccounts;
}) {
  const { t } = useI18n();
  const { idToken } = useAuth();
  const pending = accounts.pendingId === account.id;
  const inputRef = useRef<HTMLInputElement>(null);
  const avatarUser = { ...account, id: account.userId };

  return (
    <tr>
      <td className="fw-semibold text-break">
        <button
          className="btn btn-link p-0 me-2 align-middle"
          type="button"
          title={t("profilePicture")}
          aria-label={t("profilePicture")}
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          {/* Remounted after an upload so the new image is fetched. */}
          <UserAvatar
            key={accounts.avatarVersion}
            user={avatarUser}
            idToken={idToken}
          />
        </button>
        {account.hasProfileImage ? (
          <button
            className="btn btn-link btn-sm p-0 me-2 text-danger align-middle"
            type="button"
            title={t("removeProfilePicture")}
            aria-label={t("removeProfilePicture")}
            disabled={pending}
            onClick={() => void accounts.removeProfileImage(account)}
          >
            <i className="bi bi-x-circle" aria-hidden="true" />
          </button>
        ) : null}
        <input
          ref={inputRef}
          className="visually-hidden"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) {
              void accounts.uploadProfileImage(account, file);
            }
          }}
        />
        {account.name}
        {account.description ? (
          <div className="text-secondary small">{account.description}</div>
        ) : null}
      </td>
      <td>
        <code className="text-break">{account.clientId}</code>
      </td>
      <td className="text-break">
        {account.email}
        {account.role === "ADMIN" ? (
          <span className="badge text-bg-warning ms-2">{t("admin")}</span>
        ) : null}
      </td>
      <td>
        <span
          className={`badge ${account.active ? "text-bg-success" : "text-bg-secondary"}`}
        >
          {account.active
            ? t("serviceAccountActive")
            : t("serviceAccountDisabled")}
        </span>
      </td>
      <td className="text-secondary">
        {account.lastUsedAt
          ? formatDateTime(account.lastUsedAt)
          : t("serviceAccountNeverUsed")}
      </td>
      <td className="text-end">
        <div className="d-inline-flex flex-wrap gap-2 justify-content-end">
          <button
            className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-2"
            type="button"
            disabled={pending}
            onClick={() => void accounts.toggleActive(account)}
          >
            <i
              className={`bi ${account.active ? "bi-pause-circle" : "bi-play-circle"}`}
              aria-hidden="true"
            />
            {account.active
              ? t("serviceAccountDisable")
              : t("serviceAccountEnable")}
          </button>
          <button
            className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-2"
            type="button"
            disabled={pending}
            onClick={() => void accounts.rotateSecret(account)}
          >
            <i className="bi bi-arrow-repeat" aria-hidden="true" />
            {t("rotateSecret")}
          </button>
          <button
            className="btn btn-outline-danger btn-sm d-inline-flex align-items-center gap-2"
            type="button"
            disabled={pending}
            onClick={() => void accounts.removeAccount(account)}
          >
            {pending ? (
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
