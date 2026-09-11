import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ApiClientError, apiRequest } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import { useI18n } from "../../i18n/I18nProvider";
import type { CurrentUser, GlobalSettings } from "../../types/api";
import { AdminsTab } from "./tabs/AdminsTab";
import { CronsTab } from "./tabs/CronsTab";
import { DomainsTab } from "./tabs/DomainsTab";
import { GitwebUrlRulesTab } from "./tabs/GitwebUrlRulesTab";
import { LinkRulesTab } from "./tabs/LinkRulesTab";
import { NotificationsTab } from "./tabs/NotificationsTab";
import { ReviewFieldsTab } from "./tabs/ReviewFieldsTab";
import { UsersTab } from "./tabs/UsersTab";
import { UserSettingsModal } from "./UserSettingsModal";

const adminTabIds = [
  "domains",
  "notifications",
  "users",
  "admins",
  "linkRules",
  "gitwebUrlRules",
  "reviewFields",
  "crons",
] as const;

type AdminTab = (typeof adminTabIds)[number];

const isAdminTab = (value: string | null): value is AdminTab =>
  adminTabIds.includes(value as AdminTab);

export function AdminPage() {
  const [searchParams] = useSearchParams();
  const { idToken } = useAuth();
  const { t } = useI18n();
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(
    null,
  );
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [editingUser, setEditingUser] = useState<CurrentUser | null>(null);
  const [usersReloadKey, setUsersReloadKey] = useState(0);
  const [settingsError, setSettingsError] = useState("");
  const requestedTab = searchParams.get("tab");
  const activeTab: AdminTab = isAdminTab(requestedTab)
    ? requestedTab
    : "domains";

  const loadGlobalSettings = useCallback(async () => {
    if (!idToken) {
      return;
    }

    setLoadingSettings(true);
    setSettingsError("");
    try {
      setGlobalSettings(
        await apiRequest<GlobalSettings>("/v1/admin/settings", idToken),
      );
    } catch (error) {
      setSettingsError(
        error instanceof ApiClientError
          ? error.apiError.code
          : error instanceof Error
            ? error.message
            : "backendError",
      );
    } finally {
      setLoadingSettings(false);
    }
  }, [idToken]);

  useEffect(() => {
    void loadGlobalSettings();
  }, [loadGlobalSettings]);

  const adminTabs: { id: AdminTab; label: string; icon: string }[] = [
    { id: "domains", label: t("domain"), icon: "bi-shield-check" },
    { id: "notifications", label: t("sendTextNotification"), icon: "bi-send" },
    { id: "users", label: t("users"), icon: "bi-person-lines-fill" },
    { id: "admins", label: t("admins"), icon: "bi-people" },
    { id: "linkRules", label: t("commitLogLinkRules"), icon: "bi-link-45deg" },
    { id: "gitwebUrlRules", label: t("gitwebUrlRules"), icon: "bi-git" },
    {
      id: "reviewFields",
      label: t("reviewFields"),
      icon: "bi-input-cursor-text",
    },
    { id: "crons", label: t("cronJobs"), icon: "bi-clock-history" },
  ];

  const renderActiveTab = () => {
    switch (activeTab) {
      case "domains":
        return globalSettings ? (
          <DomainsTab
            key={globalSettings.updatedAt}
            allowedDomains={globalSettings.allowedOAuthDomains}
            appName={globalSettings.appName}
            loadingSettings={loadingSettings}
            onReload={loadGlobalSettings}
          />
        ) : null;
      case "notifications":
        return <NotificationsTab />;
      case "users":
        return (
          <UsersTab
            reloadKey={usersReloadKey}
            onEditUser={(user) => setEditingUser(user)}
          />
        );
      case "admins":
        return <AdminsTab />;
      case "linkRules":
        return <LinkRulesTab />;
      case "gitwebUrlRules":
        return <GitwebUrlRulesTab />;
      case "reviewFields":
        return <ReviewFieldsTab />;
      case "crons":
        return globalSettings ? (
          <CronsTab
            key={globalSettings.updatedAt}
            settings={globalSettings}
            loadingSettings={loadingSettings}
            onReload={loadGlobalSettings}
          />
        ) : null;
    }
  };

  return (
    <div className="row g-4">
      <div className="col-12">
        <ul className="nav nav-tabs admin-tabs" role="tablist">
          {adminTabs.map((tab) => (
            <li className="nav-item" key={tab.id} role="presentation">
              <Link
                className={`nav-link d-inline-flex align-items-center gap-2 ${activeTab === tab.id ? "active" : ""}`}
                role="tab"
                aria-selected={activeTab === tab.id}
                to={`/admin?tab=${tab.id}`}
              >
                <i className={`bi ${tab.icon}`} aria-hidden="true" />
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {settingsError && (activeTab === "domains" || activeTab === "crons") ? (
        <div className="col-12">
          <div className="alert alert-danger mb-0">{settingsError}</div>
        </div>
      ) : null}

      {renderActiveTab()}

      {editingUser ? (
        <UserSettingsModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={() => setUsersReloadKey((key) => key + 1)}
        />
      ) : null}
    </div>
  );
}
