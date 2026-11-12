import { useEffect, useState } from "react";
import { ApiClientError, apiRequest } from "../../../../api/client";
import { forgetUserAvatar } from "../../../../api/userAvatars";
import { useAuth } from "../../../../auth/AuthProvider";
import { useI18n } from "../../../../i18n/I18nProvider";
import type { TranslationKey } from "../../../../i18n/translations";
import { useToast } from "../../../../layout/ToastProvider";
import type {
  ServiceAccount,
  ServiceAccountRemoval,
  ServiceAccountWithSecret,
} from "../../../../types/api";

export const emptyServiceAccountForm = {
  name: "",
  clientId: "",
  email: "",
  description: "",
  admin: false,
};

export type ServiceAccountForm = typeof emptyServiceAccountForm;

/**
 * Service accounts and their lifecycle. A secret is only shown once, right
 * after it is issued, so it is kept here until the dialog is closed.
 */
export function useServiceAccounts() {
  const { idToken } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();
  const [accounts, setAccounts] = useState<ServiceAccount[]>([]);
  const [form, setForm] = useState(emptyServiceAccountForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarVersion, setAvatarVersion] = useState(0);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [issuedSecret, setIssuedSecret] =
    useState<ServiceAccountWithSecret | null>(null);

  const errorLabel = (error: unknown) => {
    if (error instanceof ApiClientError) {
      return t(error.apiError.code);
    }

    return error instanceof Error ? error.message : t("backendError");
  };

  const loadAccounts = async () => {
    if (!idToken) {
      return;
    }

    setLoading(true);
    setErrorMessage("");
    try {
      setAccounts(
        await apiRequest<ServiceAccount[]>("/admin/service-accounts", idToken),
      );
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAccounts();
  }, [idToken]);

  const createAccount = async () => {
    const name = form.name.trim();
    if (!idToken || !name) {
      return;
    }

    setSaving(true);
    setErrorMessage("");
    try {
      const created = await apiRequest<ServiceAccountWithSecret>(
        "/admin/service-accounts",
        idToken,
        {
          method: "POST",
          body: JSON.stringify({
            name,
            clientId: form.clientId.trim() || undefined,
            email: form.email.trim() || undefined,
            description: form.description.trim() || undefined,
            admin: form.admin,
          }),
        },
      );
      setForm(emptyServiceAccountForm);
      setIssuedSecret(created);
      showToast(t("serviceAccountCreated"));
      await loadAccounts();
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setSaving(false);
    }
  };

  /** Runs an action on one account, then reloads the list. */
  const runAccountAction = async (
    account: ServiceAccount,
    action: (token: string) => Promise<void>,
    successKey: TranslationKey,
  ) => {
    if (!idToken) {
      return;
    }

    setPendingId(account.id);
    setErrorMessage("");
    try {
      await action(idToken);
      showToast(t(successKey));
      await loadAccounts();
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setPendingId(null);
    }
  };

  const accountPath = (account: ServiceAccount) =>
    `/admin/service-accounts/${account.id}`;

  const toggleActive = (account: ServiceAccount) =>
    runAccountAction(
      account,
      async (token) => {
        await apiRequest<ServiceAccount>(accountPath(account), token, {
          method: "PATCH",
          body: JSON.stringify({ active: !account.active }),
        });
      },
      "serviceAccountUpdated",
    );

  const rotateSecret = (account: ServiceAccount) =>
    runAccountAction(
      account,
      async (token) => {
        setIssuedSecret(
          await apiRequest<ServiceAccountWithSecret>(
            `${accountPath(account)}/rotate-secret`,
            token,
            { method: "POST" },
          ),
        );
      },
      "serviceAccountSecretRotated",
    );

  const removeAccount = (account: ServiceAccount) =>
    runAccountAction(
      account,
      async (token) => {
        await apiRequest<ServiceAccountRemoval>(accountPath(account), token, {
          method: "DELETE",
        });
      },
      "serviceAccountRemoved",
    );

  const uploadProfileImage = (account: ServiceAccount, file: File) =>
    runAccountAction(
      account,
      async (token) => {
        const body = new FormData();
        body.append("file", file);
        await apiRequest(`${accountPath(account)}/profile-image`, token, {
          method: "PATCH",
          body,
        });
        forgetUserAvatar(account.userId);
        setAvatarVersion((version) => version + 1);
      },
      "profileImageSaved",
    );

  const removeProfileImage = (account: ServiceAccount) =>
    runAccountAction(
      account,
      async (token) => {
        await apiRequest(`${accountPath(account)}/profile-image`, token, {
          method: "DELETE",
        });
        forgetUserAvatar(account.userId);
        setAvatarVersion((version) => version + 1);
      },
      "profileImageRemoved",
    );

  const copyToClipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      showToast(t("copied"));
      return;
    } catch {
      // navigator.clipboard is undefined over plain http: use execCommand.
    }
    const textarea = document.createElement("textarea");
    textarea.value = value;
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (copied) {
      showToast(t("copied"));
    } else {
      setErrorMessage(t("copyFailed"));
    }
  };

  return {
    accounts,
    form,
    updateForm: (nextForm: Partial<ServiceAccountForm>) =>
      setForm({ ...form, ...nextForm }),
    loading,
    saving,
    pendingId,
    avatarVersion,
    errorMessage,
    issuedSecret,
    closeIssuedSecret: () => setIssuedSecret(null),
    loadAccounts,
    createAccount,
    toggleActive,
    rotateSecret,
    removeAccount,
    uploadProfileImage,
    removeProfileImage,
    copyToClipboard,
  };
}

export type ServiceAccounts = ReturnType<typeof useServiceAccounts>;
