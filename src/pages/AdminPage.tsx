import { useEffect, useState } from "react";
import { ApiClientError, apiRequest } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { useI18n } from "../i18n/I18nProvider";
import { useToast } from "../layout/ToastProvider";
import type {
  AdminGrant,
  AdminRemoval,
  AdminTextNotificationResponse,
  CommitLogLinkRule,
  CommitLogLinkRuleDeletion,
  CurrentUser,
  GlobalSettings,
} from "../types/api";

type LinkRuleDraft = {
  label: string;
  regex: string;
  linkTemplate: string;
  enabled: boolean;
};

type AdminTab = "domains" | "notifications" | "users" | "admins" | "linkRules";

export function AdminPage() {
  const { idToken } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();
  const [users, setUsers] = useState<CurrentUser[]>([]);
  const [admins, setAdmins] = useState<AdminGrant[]>([]);
  const [linkRules, setLinkRules] = useState<CommitLogLinkRule[]>([]);
  const [linkRuleDrafts, setLinkRuleDrafts] = useState<
    Record<string, LinkRuleDraft>
  >({});
  const [email, setEmail] = useState("");
  const [newLinkRule, setNewLinkRule] = useState<LinkRuleDraft>({
    label: "Issue tracker example",
    regex: "Issue: (?<ISSUE_ID>\\d+)",
    linkTemplate: "https://tracker.example.test/issues/${ISSUE_ID}",
    enabled: true,
  });
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingLinkRules, setLoadingLinkRules] = useState(false);
  const [savingLinkRule, setSavingLinkRule] = useState(false);
  const [updatingLinkRuleId, setUpdatingLinkRuleId] = useState<string | null>(
    null,
  );
  const [deletingLinkRuleId, setDeletingLinkRuleId] = useState<string | null>(
    null,
  );
  const [notificationTitle, setNotificationTitle] = useState("");
  const [notificationMessage, setNotificationMessage] = useState("");
  const [allowedDomains, setAllowedDomains] = useState("");
  const [savedAllowedDomains, setSavedAllowedDomains] = useState<string[]>([]);
  const [sendingNotification, setSendingNotification] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [removingEmail, setRemovingEmail] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeTab, setActiveTab] = useState<AdminTab>("domains");

  const errorLabel = (error: unknown) => {
    if (error instanceof ApiClientError) {
      return t(error.apiError.code);
    }

    return error instanceof Error ? error.message : t("backendError");
  };

  const loadAdmins = async () => {
    if (!idToken) {
      return;
    }

    setLoading(true);
    setErrorMessage("");
    try {
      setAdmins(await apiRequest<AdminGrant[]>("/v1/admin/admins", idToken));
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    if (!idToken) {
      return;
    }

    setLoadingUsers(true);
    setErrorMessage("");
    try {
      setUsers(await apiRequest<CurrentUser[]>("/v1/admin/users", idToken));
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setLoadingUsers(false);
    }
  };

  const draftsFromRules = (rules: CommitLogLinkRule[]) =>
    Object.fromEntries(
      rules.map((rule) => [
        rule.id,
        {
          label: rule.label ?? "",
          regex: rule.regex,
          linkTemplate: rule.linkTemplate,
          enabled: rule.enabled,
        },
      ]),
    );

  const loadLinkRules = async () => {
    if (!idToken) {
      return;
    }

    setLoadingLinkRules(true);
    setErrorMessage("");
    try {
      const rules = await apiRequest<CommitLogLinkRule[]>(
        "/v1/commit-log-link-rules",
        idToken,
      );
      setLinkRules(rules);
      setLinkRuleDrafts(draftsFromRules(rules));
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setLoadingLinkRules(false);
    }
  };

  const loadGlobalSettings = async () => {
    if (!idToken) {
      return;
    }

    setLoadingSettings(true);
    setErrorMessage("");
    try {
      const settings = await apiRequest<GlobalSettings>(
        "/v1/admin/settings",
        idToken,
      );
      setAllowedDomains(settings.allowedOAuthDomains.join("\n"));
      setSavedAllowedDomains(settings.allowedOAuthDomains);
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setLoadingSettings(false);
    }
  };

  useEffect(() => {
    void loadUsers();
    void loadAdmins();
    void loadLinkRules();
    void loadGlobalSettings();
  }, [idToken]);

  const normalizedAllowedDomains = () => [
    ...new Set(
      allowedDomains
        .split(/[\s,;]+/)
        .map((domain) => domain.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];

  const normalizedAllowedDomainsKey = (domains: string[]) => domains.join("\n");

  const hasAllowedDomainChanges =
    normalizedAllowedDomainsKey(normalizedAllowedDomains()) !==
    normalizedAllowedDomainsKey(savedAllowedDomains);

  const linkRuleDraftChanged = (
    rule: CommitLogLinkRule,
    draft: LinkRuleDraft | undefined,
  ) =>
    !!draft &&
    (draft.label !== (rule.label ?? "") ||
      draft.regex !== rule.regex ||
      draft.linkTemplate !== rule.linkTemplate ||
      draft.enabled !== rule.enabled);

  const addAdmin = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!idToken || !normalizedEmail) {
      return;
    }

    setSaving(true);
    setErrorMessage("");
    try {
      await apiRequest<AdminGrant>("/v1/admin/admins", idToken, {
        method: "POST",
        body: JSON.stringify({ email: normalizedEmail }),
      });
      setEmail("");
      showToast(t("adminAdded"));
      await loadAdmins();
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setSaving(false);
    }
  };

  const removeAdmin = async (adminEmail: string) => {
    if (!idToken) {
      return;
    }

    setRemovingEmail(adminEmail);
    setErrorMessage("");
    try {
      await apiRequest<AdminRemoval>(
        `/v1/admin/admins/${encodeURIComponent(adminEmail)}`,
        idToken,
        { method: "DELETE" },
      );
      showToast(t("adminRemoved"));
      await loadAdmins();
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setRemovingEmail(null);
    }
  };

  const sendTextNotification = async () => {
    const text = notificationMessage.trim();
    if (!idToken || !text) {
      return;
    }

    setSendingNotification(true);
    setErrorMessage("");
    try {
      const response = await apiRequest<AdminTextNotificationResponse>(
        "/v1/admin/notifications/text",
        idToken,
        {
          method: "POST",
          body: JSON.stringify({
            title: notificationTitle.trim() || null,
            message: text,
          }),
        },
      );
      setNotificationTitle("");
      setNotificationMessage("");
      showToast(
        t("textNotificationSent").replace(
          "{count}",
          response.deliveredCount.toString(),
        ),
      );
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setSendingNotification(false);
    }
  };

  const saveGlobalSettings = async () => {
    if (!idToken || !hasAllowedDomainChanges) {
      return;
    }

    const allowedOAuthDomains = normalizedAllowedDomains();
    setSavingSettings(true);
    setErrorMessage("");
    try {
      const settings = await apiRequest<GlobalSettings>(
        "/v1/admin/settings",
        idToken,
        {
          method: "PATCH",
          body: JSON.stringify({ allowedOAuthDomains }),
        },
      );
      setAllowedDomains(settings.allowedOAuthDomains.join("\n"));
      setSavedAllowedDomains(settings.allowedOAuthDomains);
      showToast(t("allowedDomainsSaved"));
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setSavingSettings(false);
    }
  };

  const updateLinkRuleDraft = (
    ruleId: string,
    nextDraft: Partial<LinkRuleDraft>,
  ) => {
    setLinkRuleDrafts((current) => ({
      ...current,
      [ruleId]: { ...current[ruleId], ...nextDraft },
    }));
  };

  const createLinkRule = async () => {
    if (!idToken || !newLinkRule.regex.trim() || !newLinkRule.linkTemplate.trim()) {
      return;
    }

    setSavingLinkRule(true);
    setErrorMessage("");
    try {
      await apiRequest<CommitLogLinkRule>("/v1/commit-log-link-rules", idToken, {
        method: "POST",
        body: JSON.stringify({
          label: newLinkRule.label.trim() || null,
          regex: newLinkRule.regex.trim(),
          linkTemplate: newLinkRule.linkTemplate.trim(),
          enabled: newLinkRule.enabled,
        }),
      });
      setNewLinkRule({
        label: "",
        regex: "",
        linkTemplate: "",
        enabled: true,
      });
      showToast(t("commitLogLinkRuleCreated"));
      await loadLinkRules();
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setSavingLinkRule(false);
    }
  };

  const updateLinkRule = async (ruleId: string) => {
    const draft = linkRuleDrafts[ruleId];
    const rule = linkRules.find((currentRule) => currentRule.id === ruleId);
    if (
      !idToken ||
      !rule ||
      !draft?.regex.trim() ||
      !draft.linkTemplate.trim() ||
      !linkRuleDraftChanged(rule, draft)
    ) {
      return;
    }

    setUpdatingLinkRuleId(ruleId);
    setErrorMessage("");
    try {
      await apiRequest<CommitLogLinkRule>(
        `/v1/commit-log-link-rules/${ruleId}`,
        idToken,
        {
          method: "PATCH",
          body: JSON.stringify({
            label: draft.label.trim() || null,
            regex: draft.regex.trim(),
            linkTemplate: draft.linkTemplate.trim(),
            enabled: draft.enabled,
          }),
        },
      );
      showToast(t("commitLogLinkRuleUpdated"));
      await loadLinkRules();
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setUpdatingLinkRuleId(null);
    }
  };

  const deleteLinkRule = async (ruleId: string) => {
    if (!idToken) {
      return;
    }

    setDeletingLinkRuleId(ruleId);
    setErrorMessage("");
    try {
      await apiRequest<CommitLogLinkRuleDeletion>(
        `/v1/commit-log-link-rules/${ruleId}`,
        idToken,
        { method: "DELETE" },
      );
      showToast(t("commitLogLinkRuleDeleted"));
      await loadLinkRules();
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setDeletingLinkRuleId(null);
    }
  };

  const adminTabs: { id: AdminTab; label: string; icon: string }[] = [
    { id: "domains", label: t("allowedDomains"), icon: "bi-shield-check" },
    { id: "notifications", label: t("sendTextNotification"), icon: "bi-send" },
    { id: "users", label: t("users"), icon: "bi-person-lines-fill" },
    { id: "admins", label: t("admins"), icon: "bi-people" },
    { id: "linkRules", label: t("commitLogLinkRules"), icon: "bi-link-45deg" },
  ];

  return (
    <div className="row g-4">
      <div className="col-12">
        <ul className="nav nav-tabs admin-tabs" role="tablist">
          {adminTabs.map((tab) => (
            <li className="nav-item" key={tab.id} role="presentation">
              <button
                className={`nav-link d-inline-flex align-items-center gap-2 ${activeTab === tab.id ? "active" : ""}`}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
              >
                <i className={`bi ${tab.icon}`} aria-hidden="true" />
                {tab.label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {errorMessage ? (
        <div className="col-12">
          <div className="alert alert-danger mb-0">{errorMessage}</div>
        </div>
      ) : null}

      {activeTab === "domains" ? (
      <div className="col-12">
        <div className="card card-success card-outline h-100">
          <div className="card-header d-flex flex-wrap align-items-center justify-content-between gap-3">
            <h3 className="card-title">{t("allowedDomains")}</h3>
            <button
              className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-2"
              type="button"
              disabled={loadingSettings || !idToken}
              onClick={() => void loadGlobalSettings()}
            >
              {loadingSettings ? (
                <span className="spinner-border spinner-border-sm" />
              ) : (
                <i className="bi bi-arrow-clockwise" aria-hidden="true" />
              )}
              {t("refresh")}
            </button>
          </div>
          <div className="card-body">
            <label className="form-label" htmlFor="allowed-domains">
              {t("allowedDomainsList")}
            </label>
            <textarea
              className="form-control font-monospace"
              id="allowed-domains"
              rows={5}
              value={allowedDomains}
              onChange={(event) => setAllowedDomains(event.target.value)}
              placeholder="6wind.com"
            />
            <p className="text-secondary small mt-2 mb-3">
              {t("allowedDomainsHelp")}
            </p>
            {idToken && hasAllowedDomainChanges ? (
              <button
                className="btn btn-success d-inline-flex align-items-center gap-2"
                type="button"
                disabled={savingSettings}
                onClick={() => void saveGlobalSettings()}
              >
                {savingSettings ? (
                  <span className="spinner-border spinner-border-sm" />
                ) : (
                  <i className="bi bi-save" aria-hidden="true" />
                )}
                {t("save")}
              </button>
            ) : null}
          </div>
        </div>
      </div>
      ) : null}

      {activeTab === "notifications" ? (
      <div className="col-12">
        <div className="card card-info card-outline">
          <div className="card-header">
            <h3 className="card-title">{t("sendTextNotification")}</h3>
          </div>
          <div className="card-body">
            <div className="mb-3">
              <label className="form-label" htmlFor="notification-title">
                {t("notificationTitle")}
              </label>
              <input
                className="form-control"
                id="notification-title"
                value={notificationTitle}
                onChange={(event) => setNotificationTitle(event.target.value)}
              />
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="notification-message">
                {t("notificationMessage")}
              </label>
              <textarea
                className="form-control"
                id="notification-message"
                rows={5}
                value={notificationMessage}
                onChange={(event) => setNotificationMessage(event.target.value)}
              />
            </div>
            <button
              className="btn btn-info d-inline-flex align-items-center gap-2"
              type="button"
              disabled={!notificationMessage.trim() || sendingNotification}
              onClick={() => void sendTextNotification()}
            >
              {sendingNotification ? (
                <span className="spinner-border spinner-border-sm" />
              ) : (
                <i className="bi bi-send" aria-hidden="true" />
              )}
              {t("sendNotification")}
            </button>
          </div>
        </div>
      </div>
      ) : null}

      {activeTab === "users" ? (
      <div className="col-12">
        <div className="card h-100">
          <div className="card-header d-flex flex-wrap align-items-center gap-1">
            <h3 className="card-title mb-0">{t("users")}</h3>
            <button
              aria-label={t("refresh")}
              className="btn btn-link btn-sm text-secondary text-decoration-none p-1 lh-1"
              title={t("refresh")}
              type="button"
              disabled={loadingUsers || !idToken}
              onClick={() => void loadUsers()}
            >
              {loadingUsers ? (
                <span className="spinner-border spinner-border-sm" />
              ) : (
                <i className="bi bi-arrow-clockwise" aria-hidden="true" />
              )}
            </button>
          </div>
          <div className="card-body p-0">
            {users.length ? (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th>{t("email")}</th>
                      <th>{t("nickname")}</th>
                      <th>{t("hostname")}</th>
                      <th>{t("role")}</th>
                      <th>{t("mailNotifications")}</th>
                      <th>{t("ircNotifications")}</th>
                      <th>{t("createdAt")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td className="fw-semibold text-break">{user.email}</td>
                        <td>{user.settings?.nickname || t("notAvailable")}</td>
                        <td className="text-break">{user.hostname}</td>
                        <td>
                          <span
                            className={`badge ${user.role === "ADMIN" ? "text-bg-warning" : "text-bg-secondary"}`}
                          >
                            {user.role}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`badge ${user.settings?.mailNotificationsEnabled ? "text-bg-success" : "text-bg-secondary"}`}
                          >
                            {user.settings?.mailNotificationsEnabled
                              ? t("yes")
                              : t("no")}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`badge ${user.settings?.ircNotificationsEnabled ? "text-bg-success" : "text-bg-secondary"}`}
                          >
                            {user.settings?.ircNotificationsEnabled
                              ? t("yes")
                              : t("no")}
                          </span>
                        </td>
                        <td className="text-secondary">
                          {new Date(user.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                {loadingUsers ? t("loadingUsers") : t("noUsers")}
              </div>
            )}
          </div>
        </div>
      </div>
      ) : null}

      {activeTab === "admins" ? (
      <div className="col-12">
        <div className="card h-100">
          <div className="card-header d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div className="d-inline-flex align-items-center gap-1">
              <h3 className="card-title mb-0">{t("admins")}</h3>
              <button
                aria-label={t("refresh")}
                className="btn btn-link btn-sm text-secondary text-decoration-none p-1 lh-1"
                title={t("refresh")}
                type="button"
                disabled={loading || !idToken}
                onClick={() => void loadAdmins()}
              >
                {loading ? (
                  <span className="spinner-border spinner-border-sm" />
                ) : (
                  <i className="bi bi-arrow-clockwise" aria-hidden="true" />
                )}
              </button>
            </div>
            <div className="d-flex flex-wrap align-items-center gap-2 ms-lg-auto">
              <div className="input-group input-group-sm admin-add-input">
                <span className="input-group-text">
                  <i className="bi bi-envelope" aria-hidden="true" />
                </span>
                <input
                  className="form-control"
                  id="admin-email"
                  placeholder={t("adminEmail")}
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void addAdmin();
                    }
                  }}
                />
                <button
                  className="btn btn-warning d-inline-flex align-items-center gap-2"
                  type="button"
                  disabled={!email.trim() || saving || !idToken}
                  onClick={() => void addAdmin()}
                >
                  {saving ? (
                    <span className="spinner-border spinner-border-sm" />
                  ) : (
                    <i className="bi bi-person-plus" aria-hidden="true" />
                  )}
                  {t("addAdmin")}
                </button>
              </div>
            </div>
          </div>
          <div className="card-body p-0">
            {admins.length ? (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th>{t("adminEmail")}</th>
                      <th>{t("createdAt")}</th>
                      <th className="text-end">{t("actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admins.map((admin) => (
                      <tr key={admin.email}>
                        <td className="fw-semibold text-break">
                          {admin.email}
                        </td>
                        <td className="text-secondary">
                          {new Date(admin.createdAt).toLocaleString()}
                        </td>
                        <td className="text-end">
                          <button
                            className="btn btn-outline-danger btn-sm d-inline-flex align-items-center gap-2"
                            type="button"
                            disabled={removingEmail === admin.email}
                            onClick={() => void removeAdmin(admin.email)}
                          >
                            {removingEmail === admin.email ? (
                              <span className="spinner-border spinner-border-sm" />
                            ) : (
                              <i className="bi bi-trash" aria-hidden="true" />
                            )}
                            {t("remove")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                {loading ? t("loadingAdmins") : t("noAdmins")}
              </div>
            )}
          </div>
        </div>
      </div>
      ) : null}

      {activeTab === "linkRules" ? (
      <div className="col-12">
        <div className="card card-primary card-outline">
          <div className="card-header d-flex flex-wrap align-items-center gap-1">
            <h3 className="card-title mb-0">{t("commitLogLinkRules")}</h3>
            <button
              aria-label={t("refresh")}
              className="btn btn-link btn-sm text-secondary text-decoration-none p-1 lh-1"
              title={t("refresh")}
              type="button"
              disabled={loadingLinkRules || !idToken}
              onClick={() => void loadLinkRules()}
            >
              {loadingLinkRules ? (
                <span className="spinner-border spinner-border-sm" />
              ) : (
                <i className="bi bi-arrow-clockwise" aria-hidden="true" />
              )}
            </button>
          </div>
          <div className="card-body">
            <p className="text-secondary small mb-3">
              {t("commitLogLinkRuleVariables")}
            </p>
            <div className="row g-2 align-items-end mb-3">
              <div className="col-lg-2">
                <label className="form-label" htmlFor="new-link-rule-label">
                  {t("ruleLabel")}
                </label>
                <input
                  className="form-control"
                  id="new-link-rule-label"
                  value={newLinkRule.label}
                  onChange={(event) =>
                    setNewLinkRule((current) => ({
                      ...current,
                      label: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="col-lg-4">
                <label className="form-label" htmlFor="new-link-rule-regex">
                  {t("ruleRegex")}
                </label>
                <input
                  className="form-control font-monospace"
                  id="new-link-rule-regex"
                  value={newLinkRule.regex}
                  onChange={(event) =>
                    setNewLinkRule((current) => ({
                      ...current,
                      regex: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="col-lg-4">
                <label className="form-label" htmlFor="new-link-rule-template">
                  {t("ruleLinkTemplate")}
                </label>
                <input
                  className="form-control font-monospace"
                  id="new-link-rule-template"
                  value={newLinkRule.linkTemplate}
                  onChange={(event) =>
                    setNewLinkRule((current) => ({
                      ...current,
                      linkTemplate: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="col-lg-2 d-flex flex-wrap align-items-center gap-2">
                <div className="form-check mb-0">
                  <input
                    className="form-check-input"
                    id="new-link-rule-enabled"
                    type="checkbox"
                    checked={newLinkRule.enabled}
                    onChange={(event) =>
                      setNewLinkRule((current) => ({
                        ...current,
                        enabled: event.target.checked,
                      }))
                    }
                  />
                  <label
                    className="form-check-label"
                    htmlFor="new-link-rule-enabled"
                  >
                    {t("enabled")}
                  </label>
                </div>
                <button
                  className="btn btn-primary d-inline-flex align-items-center gap-2"
                  type="button"
                  disabled={
                    !newLinkRule.regex.trim() ||
                    !newLinkRule.linkTemplate.trim() ||
                    savingLinkRule
                  }
                  onClick={() => void createLinkRule()}
                >
                  {savingLinkRule ? (
                    <span className="spinner-border spinner-border-sm" />
                  ) : (
                    <i className="bi bi-plus-lg" aria-hidden="true" />
                  )}
                  {t("add")}
                </button>
              </div>
            </div>

            {linkRules.length ? (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th>{t("ruleLabel")}</th>
                      <th>{t("ruleRegex")}</th>
                      <th>{t("ruleLinkTemplate")}</th>
                      <th>{t("enabled")}</th>
                      <th className="text-end">{t("actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkRules.map((rule) => {
                      const draft = linkRuleDrafts[rule.id];
                      const hasLinkRuleChanges = linkRuleDraftChanged(rule, draft);

                      return (
                        <tr key={rule.id}>
                          <td className="link-rule-cell">
                            <input
                              className="form-control form-control-sm"
                              value={draft?.label ?? ""}
                              onChange={(event) =>
                                updateLinkRuleDraft(rule.id, {
                                  label: event.target.value,
                                })
                              }
                            />
                          </td>
                          <td className="link-rule-cell">
                            <input
                              className="form-control form-control-sm font-monospace"
                              value={draft?.regex ?? ""}
                              onChange={(event) =>
                                updateLinkRuleDraft(rule.id, {
                                  regex: event.target.value,
                                })
                              }
                            />
                          </td>
                          <td className="link-rule-cell">
                            <input
                              className="form-control form-control-sm font-monospace"
                              value={draft?.linkTemplate ?? ""}
                              onChange={(event) =>
                                updateLinkRuleDraft(rule.id, {
                                  linkTemplate: event.target.value,
                                })
                              }
                            />
                          </td>
                          <td>
                            <input
                              className="form-check-input"
                              type="checkbox"
                              checked={draft?.enabled ?? false}
                              onChange={(event) =>
                                updateLinkRuleDraft(rule.id, {
                                  enabled: event.target.checked,
                                })
                              }
                            />
                          </td>
                          <td className="text-end">
                            <div className="d-inline-flex flex-wrap justify-content-end gap-2">
                              {draft?.regex.trim() &&
                              draft.linkTemplate.trim() &&
                              hasLinkRuleChanges ? (
                                <button
                                  className="btn btn-outline-success btn-sm d-inline-flex align-items-center gap-2"
                                  type="button"
                                  disabled={updatingLinkRuleId === rule.id}
                                  onClick={() => void updateLinkRule(rule.id)}
                                >
                                  {updatingLinkRuleId === rule.id ? (
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
                                disabled={deletingLinkRuleId === rule.id}
                                onClick={() => void deleteLinkRule(rule.id)}
                              >
                                {deletingLinkRuleId === rule.id ? (
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
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state border rounded">
                {loadingLinkRules ? t("loadingLinkRules") : t("noLinkRules")}
              </div>
            )}
          </div>
        </div>
      </div>
      ) : null}
    </div>
  );
}
