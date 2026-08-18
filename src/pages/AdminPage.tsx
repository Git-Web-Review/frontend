import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ApiClientError, apiRequest } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { RefreshButton } from "../components/RefreshButton";
import { useI18n } from "../i18n/I18nProvider";
import type { TranslationKey } from "../i18n/translations";
import { useToast } from "../layout/ToastProvider";
import { formatDateTime } from "../utils/formatDate";
import type {
  AdminGrant,
  AdminRemoval,
  AdminTextNotificationResponse,
  CommitLogLinkRule,
  CommitLogLinkRuleDeletion,
  CurrentUser,
  GlobalSettings,
  NotificationCategory,
  NotificationPreferences,
  ReviewField,
  ReviewFieldDeletion,
  ReviewFieldType,
  UserLocale,
  UserSettings,
} from "../types/api";

const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  "reviewStarted",
  "reviewPending",
  "reviewDone",
  "reviewAcked",
  "reviewClosed",
  "commentReceived",
];

const NOTIFICATION_CATEGORY_LABELS: Record<
  NotificationCategory,
  TranslationKey
> = {
  reviewStarted: "notifCategoryReviewStarted",
  reviewPending: "notifCategoryReviewPending",
  reviewDone: "notifCategoryReviewDone",
  reviewAcked: "notifCategoryReviewAcked",
  reviewClosed: "notifCategoryReviewClosed",
  commentReceived: "notifCategoryCommentReceived",
};

type UserSettingsDraft = {
  nickname: string;
  hostname: string;
  locale: UserLocale;
  mailNotificationsEnabled: boolean;
  ircNotificationsEnabled: boolean;
  ircNickname: string;
  notificationPreferences: NotificationPreferences;
};

type LinkRuleDraft = {
  label: string;
  regex: string;
  linkTemplate: string;
  enabled: boolean;
};

type ReviewFieldDraft = {
  name: string;
  type: ReviewFieldType;
};

const reviewFieldTypes: ReviewFieldType[] = [
  "LINK",
  "IMAGE",
  "TEXT",
  "NUMBER",
];

const adminTabIds = [
  "domains",
  "notifications",
  "users",
  "admins",
  "linkRules",
  "reviewFields",
  "crons",
] as const;

type AdminTab = (typeof adminTabIds)[number];

type CronDraft = {
  notificationPurgeEnabled: boolean;
  notificationPurgeIntervalMinutes: string;
  notificationPurgeAfterDays: string;
  reviewAutoCloseEnabled: boolean;
  reviewAutoCloseIntervalMinutes: string;
};

const defaultCronDraft: CronDraft = {
  notificationPurgeEnabled: false,
  notificationPurgeIntervalMinutes: "60",
  notificationPurgeAfterDays: "30",
  reviewAutoCloseEnabled: false,
  reviewAutoCloseIntervalMinutes: "60",
};

const cronDraftFromSettings = (settings: GlobalSettings): CronDraft => ({
  notificationPurgeEnabled: settings.notificationPurgeEnabled,
  notificationPurgeIntervalMinutes: String(
    settings.notificationPurgeIntervalMinutes,
  ),
  notificationPurgeAfterDays: String(settings.notificationPurgeAfterDays),
  reviewAutoCloseEnabled: settings.reviewAutoCloseEnabled,
  reviewAutoCloseIntervalMinutes: String(
    settings.reviewAutoCloseIntervalMinutes,
  ),
});

const parseCronNumber = (value: string): number | null => {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
};

const isAdminTab = (value: string | null): value is AdminTab =>
  adminTabIds.includes(value as AdminTab);

export function AdminPage() {
  const [searchParams] = useSearchParams();
  const { idToken } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();
  const [users, setUsers] = useState<CurrentUser[]>([]);
  const [editingUser, setEditingUser] = useState<CurrentUser | null>(null);
  const [userSettingsDraft, setUserSettingsDraft] =
    useState<UserSettingsDraft | null>(null);
  const [savingUserSettings, setSavingUserSettings] = useState(false);
  const [admins, setAdmins] = useState<AdminGrant[]>([]);
  const [linkRules, setLinkRules] = useState<CommitLogLinkRule[]>([]);
  const [linkRuleDrafts, setLinkRuleDrafts] = useState<
    Record<string, LinkRuleDraft>
  >({});
  const [email, setEmail] = useState("");
  const [newLinkRule, setNewLinkRule] = useState<LinkRuleDraft>({
    label: "",
    regex: "",
    linkTemplate: "",
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
  const [reviewFields, setReviewFields] = useState<ReviewField[]>([]);
  const [reviewFieldDrafts, setReviewFieldDrafts] = useState<
    Record<string, ReviewFieldDraft>
  >({});
  const [newReviewField, setNewReviewField] = useState<ReviewFieldDraft>({
    name: "",
    type: "TEXT",
  });
  const [loadingReviewFields, setLoadingReviewFields] = useState(false);
  const [savingReviewField, setSavingReviewField] = useState(false);
  const [updatingReviewFieldId, setUpdatingReviewFieldId] = useState<
    string | null
  >(null);
  const [deletingReviewFieldId, setDeletingReviewFieldId] = useState<
    string | null
  >(null);
  const [notificationTitle, setNotificationTitle] = useState("");
  const [notificationMessage, setNotificationMessage] = useState("");
  const [allowedDomains, setAllowedDomains] = useState("");
  const [savedAllowedDomains, setSavedAllowedDomains] = useState<string[]>([]);
  const [cronDraft, setCronDraft] = useState<CronDraft>(defaultCronDraft);
  const [savedCronDraft, setSavedCronDraft] =
    useState<CronDraft>(defaultCronDraft);
  const [savingCron, setSavingCron] = useState(false);
  const [sendingNotification, setSendingNotification] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [removingEmail, setRemovingEmail] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const requestedTab = searchParams.get("tab");
  const activeTab: AdminTab = isAdminTab(requestedTab) ? requestedTab : "domains";

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

  const loadReviewFields = async () => {
    if (!idToken) {
      return;
    }

    setLoadingReviewFields(true);
    setErrorMessage("");
    try {
      const fields = await apiRequest<ReviewField[]>(
        "/v1/review-fields",
        idToken,
      );
      setReviewFields(fields);
      setReviewFieldDrafts(
        Object.fromEntries(
          fields.map((field) => [
            field.id,
            { name: field.name, type: field.type },
          ]),
        ),
      );
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setLoadingReviewFields(false);
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
      setCronDraft(cronDraftFromSettings(settings));
      setSavedCronDraft(cronDraftFromSettings(settings));
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
    void loadReviewFields();
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

  const reviewFieldDraftChanged = (
    field: ReviewField,
    draft: ReviewFieldDraft | undefined,
  ) => !!draft && (draft.name !== field.name || draft.type !== field.type);

  const updateReviewFieldDraft = (
    fieldId: string,
    nextDraft: Partial<ReviewFieldDraft>,
  ) => {
    setReviewFieldDrafts((current) => ({
      ...current,
      [fieldId]: { ...current[fieldId], ...nextDraft },
    }));
  };

  const createReviewField = async () => {
    if (!idToken || !newReviewField.name.trim()) {
      return;
    }

    setSavingReviewField(true);
    setErrorMessage("");
    try {
      await apiRequest<ReviewField>("/v1/review-fields", idToken, {
        method: "POST",
        body: JSON.stringify({
          name: newReviewField.name.trim(),
          type: newReviewField.type,
        }),
      });
      setNewReviewField({ name: "", type: "TEXT" });
      showToast(t("reviewFieldCreated"));
      await loadReviewFields();
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setSavingReviewField(false);
    }
  };

  const updateReviewField = async (fieldId: string) => {
    const draft = reviewFieldDrafts[fieldId];
    const field = reviewFields.find(
      (currentField) => currentField.id === fieldId,
    );
    if (
      !idToken ||
      !field ||
      !draft?.name.trim() ||
      !reviewFieldDraftChanged(field, draft)
    ) {
      return;
    }

    setUpdatingReviewFieldId(fieldId);
    setErrorMessage("");
    try {
      await apiRequest<ReviewField>(`/v1/review-fields/${fieldId}`, idToken, {
        method: "PATCH",
        body: JSON.stringify({
          name: draft.name.trim(),
          type: draft.type,
        }),
      });
      showToast(t("reviewFieldUpdated"));
      await loadReviewFields();
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setUpdatingReviewFieldId(null);
    }
  };

  const deleteReviewField = async (fieldId: string) => {
    if (!idToken) {
      return;
    }

    setDeletingReviewFieldId(fieldId);
    setErrorMessage("");
    try {
      await apiRequest<ReviewFieldDeletion>(
        `/v1/review-fields/${fieldId}`,
        idToken,
        { method: "DELETE" },
      );
      showToast(t("reviewFieldDeleted"));
      await loadReviewFields();
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setDeletingReviewFieldId(null);
    }
  };

  const reviewFieldTypeLabel = (type: ReviewFieldType) => {
    switch (type) {
      case "LINK":
        return t("fieldTypeLink");
      case "IMAGE":
        return t("fieldTypeImage");
      case "NUMBER":
        return t("fieldTypeNumber");
      default:
        return t("fieldTypeText");
    }
  };

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

  const hasCronChanges =
    JSON.stringify(cronDraft) !== JSON.stringify(savedCronDraft);

  const cronDraftValid =
    parseCronNumber(cronDraft.notificationPurgeIntervalMinutes) !== null &&
    parseCronNumber(cronDraft.notificationPurgeAfterDays) !== null &&
    parseCronNumber(cronDraft.reviewAutoCloseIntervalMinutes) !== null;

  const updateCronDraft = (nextDraft: Partial<CronDraft>) => {
    setCronDraft((current) => ({ ...current, ...nextDraft }));
  };

  const saveCronSettings = async () => {
    if (!idToken || !hasCronChanges || !cronDraftValid) {
      return;
    }

    setSavingCron(true);
    setErrorMessage("");
    try {
      const settings = await apiRequest<GlobalSettings>(
        "/v1/admin/settings",
        idToken,
        {
          method: "PATCH",
          body: JSON.stringify({
            notificationPurgeEnabled: cronDraft.notificationPurgeEnabled,
            notificationPurgeIntervalMinutes: parseCronNumber(
              cronDraft.notificationPurgeIntervalMinutes,
            ),
            notificationPurgeAfterDays: parseCronNumber(
              cronDraft.notificationPurgeAfterDays,
            ),
            reviewAutoCloseEnabled: cronDraft.reviewAutoCloseEnabled,
            reviewAutoCloseIntervalMinutes: parseCronNumber(
              cronDraft.reviewAutoCloseIntervalMinutes,
            ),
          }),
        },
      );
      setCronDraft(cronDraftFromSettings(settings));
      setSavedCronDraft(cronDraftFromSettings(settings));
      showToast(t("cronSettingsSaved"));
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setSavingCron(false);
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

  const openUserSettings = (user: CurrentUser) => {
    setEditingUser(user);
    setUserSettingsDraft({
      nickname: user.settings?.nickname ?? "",
      hostname: user.hostname,
      locale: user.settings?.locale ?? "EN",
      mailNotificationsEnabled:
        user.settings?.mailNotificationsEnabled ?? false,
      ircNotificationsEnabled: user.settings?.ircNotificationsEnabled ?? false,
      ircNickname: user.settings?.ircNickname ?? "",
      notificationPreferences: user.settings?.notificationPreferences ?? {},
    });
  };

  const closeUserSettings = () => {
    setEditingUser(null);
    setUserSettingsDraft(null);
  };

  const draftIrcNicknameRequired =
    !!userSettingsDraft &&
    userSettingsDraft.ircNotificationsEnabled &&
    !userSettingsDraft.ircNickname.trim();

  const draftCategoryEnabled = (
    medium: "mail" | "irc",
    category: NotificationCategory,
  ) => userSettingsDraft?.notificationPreferences[medium]?.[category] ?? true;

  const toggleDraftCategory = (
    medium: "mail" | "irc",
    category: NotificationCategory,
  ) =>
    setUserSettingsDraft((draft) =>
      draft
        ? {
            ...draft,
            notificationPreferences: {
              ...draft.notificationPreferences,
              [medium]: {
                ...draft.notificationPreferences[medium],
                [category]: !(
                  draft.notificationPreferences[medium]?.[category] ?? true
                ),
              },
            },
          }
        : draft,
    );

  const saveUserSettings = async () => {
    if (!idToken || !editingUser || !userSettingsDraft || draftIrcNicknameRequired) {
      return;
    }

    setSavingUserSettings(true);
    try {
      const hostname = userSettingsDraft.hostname.trim();
      await apiRequest<UserSettings>(
        `/v1/admin/users/${editingUser.id}/settings`,
        idToken,
        {
          method: "PATCH",
          body: JSON.stringify({
            nickname: userSettingsDraft.nickname.trim() || null,
            ...(hostname ? { hostname } : {}),
            locale: userSettingsDraft.locale,
            mailNotificationsEnabled:
              userSettingsDraft.mailNotificationsEnabled,
            ircNotificationsEnabled: userSettingsDraft.ircNotificationsEnabled,
            ircNickname: userSettingsDraft.ircNickname.trim() || null,
            notificationPreferences: userSettingsDraft.notificationPreferences,
          }),
        },
      );
      showToast(t("userSettingsSaved"));
      closeUserSettings();
      await loadUsers();
    } catch (error) {
      showToast(errorLabel(error));
    } finally {
      setSavingUserSettings(false);
    }
  };

  const adminTabs: { id: AdminTab; label: string; icon: string }[] = [
    { id: "domains", label: t("allowedDomains"), icon: "bi-shield-check" },
    { id: "notifications", label: t("sendTextNotification"), icon: "bi-send" },
    { id: "users", label: t("users"), icon: "bi-person-lines-fill" },
    { id: "admins", label: t("admins"), icon: "bi-people" },
    { id: "linkRules", label: t("commitLogLinkRules"), icon: "bi-link-45deg" },
    {
      id: "reviewFields",
      label: t("reviewFields"),
      icon: "bi-input-cursor-text",
    },
    { id: "crons", label: t("cronJobs"), icon: "bi-clock-history" },
  ];

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
            <RefreshButton
              disabled={!idToken}
              loading={loadingSettings}
              onClick={() => void loadGlobalSettings()}
            />
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
              placeholder="company.com"
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

      {activeTab === "crons" ? (
      <div className="col-12">
        <div className="card card-warning card-outline h-100">
          <div className="card-header d-flex flex-wrap align-items-center justify-content-between gap-3">
            <h3 className="card-title">{t("cronJobs")}</h3>
            <RefreshButton
              disabled={!idToken}
              loading={loadingSettings}
              onClick={() => void loadGlobalSettings()}
            />
          </div>
          <div className="card-body d-flex flex-column gap-4">
            <div>
              <div className="form-check form-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="cron-notification-purge-enabled"
                  checked={cronDraft.notificationPurgeEnabled}
                  onChange={(event) =>
                    updateCronDraft({
                      notificationPurgeEnabled: event.target.checked,
                    })
                  }
                />
                <label
                  className="form-check-label fw-semibold"
                  htmlFor="cron-notification-purge-enabled"
                >
                  {t("cronNotificationPurge")}
                </label>
              </div>
              <p className="text-secondary small mb-2">
                {t("cronNotificationPurgeHelp")}
              </p>
              {cronDraft.notificationPurgeEnabled ? (
                <div className="row g-3 ms-4">
                  <div className="col-12 col-sm-6 col-lg-3">
                    <label
                      className="form-label"
                      htmlFor="cron-notification-purge-interval"
                    >
                      {t("cronIntervalMinutes")}
                    </label>
                    <input
                      className={`form-control ${parseCronNumber(cronDraft.notificationPurgeIntervalMinutes) === null ? "is-invalid" : ""}`}
                      id="cron-notification-purge-interval"
                      type="number"
                      min={1}
                      value={cronDraft.notificationPurgeIntervalMinutes}
                      onChange={(event) =>
                        updateCronDraft({
                          notificationPurgeIntervalMinutes: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="col-12 col-sm-6 col-lg-3">
                    <label
                      className="form-label"
                      htmlFor="cron-notification-purge-days"
                    >
                      {t("cronRetentionDays")}
                    </label>
                    <input
                      className={`form-control ${parseCronNumber(cronDraft.notificationPurgeAfterDays) === null ? "is-invalid" : ""}`}
                      id="cron-notification-purge-days"
                      type="number"
                      min={1}
                      value={cronDraft.notificationPurgeAfterDays}
                      onChange={(event) =>
                        updateCronDraft({
                          notificationPurgeAfterDays: event.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              ) : null}
            </div>

            <div>
              <div className="form-check form-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="cron-review-auto-close-enabled"
                  checked={cronDraft.reviewAutoCloseEnabled}
                  onChange={(event) =>
                    updateCronDraft({
                      reviewAutoCloseEnabled: event.target.checked,
                    })
                  }
                />
                <label
                  className="form-check-label fw-semibold"
                  htmlFor="cron-review-auto-close-enabled"
                >
                  {t("cronReviewAutoClose")}
                </label>
              </div>
              <p className="text-secondary small mb-2">
                {t("cronReviewAutoCloseHelp")}
              </p>
              {cronDraft.reviewAutoCloseEnabled ? (
                <div className="row g-3 ms-4">
                  <div className="col-12 col-sm-6 col-lg-3">
                    <label
                      className="form-label"
                      htmlFor="cron-review-auto-close-interval"
                    >
                      {t("cronIntervalMinutes")}
                    </label>
                    <input
                      className={`form-control ${parseCronNumber(cronDraft.reviewAutoCloseIntervalMinutes) === null ? "is-invalid" : ""}`}
                      id="cron-review-auto-close-interval"
                      type="number"
                      min={1}
                      value={cronDraft.reviewAutoCloseIntervalMinutes}
                      onChange={(event) =>
                        updateCronDraft({
                          reviewAutoCloseIntervalMinutes: event.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              ) : null}
            </div>

            {idToken && hasCronChanges ? (
              <div>
                <button
                  className="btn btn-success d-inline-flex align-items-center gap-2"
                  type="button"
                  disabled={savingCron || !cronDraftValid}
                  onClick={() => void saveCronSettings()}
                >
                  {savingCron ? (
                    <span className="spinner-border spinner-border-sm" />
                  ) : (
                    <i className="bi bi-save" aria-hidden="true" />
                  )}
                  {t("save")}
                </button>
              </div>
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
          <div className="card-header d-flex flex-wrap align-items-center justify-content-between gap-3">
            <h3 className="card-title mb-0">{t("users")}</h3>
            <RefreshButton
              disabled={!idToken}
              loading={loadingUsers}
              onClick={() => void loadUsers()}
            />
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
                      <th className="text-end">{t("actions")}</th>
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
                          {formatDateTime(user.createdAt)}
                        </td>
                        <td className="text-end">
                          <button
                            className="btn btn-outline-secondary btn-sm"
                            title={t("editUserSettings")}
                            type="button"
                            onClick={() => openUserSettings(user)}
                          >
                            <i className="bi bi-pencil" aria-hidden="true" />
                          </button>
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
            <h3 className="card-title mb-0">{t("admins")}</h3>
            <div className="d-flex flex-wrap align-items-center gap-2">
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
              <RefreshButton
                disabled={!idToken}
                loading={loading}
                onClick={() => void loadAdmins()}
              />
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
                          {formatDateTime(admin.createdAt)}
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
          <div className="card-header d-flex flex-wrap align-items-center justify-content-between gap-3">
            <h3 className="card-title mb-0">{t("commitLogLinkRules")}</h3>
            <RefreshButton
              disabled={!idToken}
              loading={loadingLinkRules}
              onClick={() => void loadLinkRules()}
            />
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
                  placeholder="Label"
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
                  placeholder="Issue: (?<ISSUE_ID>\\d+)"
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
                  placeholder="https://tracker.example.test/issues/${ISSUE_ID}"
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

      {activeTab === "reviewFields" ? (
      <div className="col-12">
        <div className="card card-primary card-outline">
          <div className="card-header d-flex flex-wrap align-items-center justify-content-between gap-3">
            <h3 className="card-title mb-0">{t("reviewFields")}</h3>
            <RefreshButton
              disabled={!idToken}
              loading={loadingReviewFields}
              onClick={() => void loadReviewFields()}
            />
          </div>
          <div className="card-body">
            <p className="text-secondary small mb-3">
              {t("reviewFieldsHint")}
            </p>
            <div className="row g-2 align-items-end mb-3">
              <div className="col-lg-5">
                <label className="form-label" htmlFor="new-review-field-name">
                  {t("fieldName")}
                </label>
                <input
                  className="form-control"
                  id="new-review-field-name"
                  value={newReviewField.name}
                  onChange={(event) =>
                    setNewReviewField((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="col-lg-4">
                <label className="form-label" htmlFor="new-review-field-type">
                  {t("fieldType")}
                </label>
                <select
                  className="form-select"
                  id="new-review-field-type"
                  value={newReviewField.type}
                  onChange={(event) =>
                    setNewReviewField((current) => ({
                      ...current,
                      type: event.target.value as ReviewFieldType,
                    }))
                  }
                >
                  {reviewFieldTypes.map((type) => (
                    <option key={type} value={type}>
                      {reviewFieldTypeLabel(type)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-lg-3">
                <button
                  className="btn btn-primary d-inline-flex align-items-center gap-2"
                  type="button"
                  disabled={!newReviewField.name.trim() || savingReviewField}
                  onClick={() => void createReviewField()}
                >
                  {savingReviewField ? (
                    <span className="spinner-border spinner-border-sm" />
                  ) : (
                    <i className="bi bi-plus-lg" aria-hidden="true" />
                  )}
                  {t("add")}
                </button>
              </div>
            </div>

            {reviewFields.length ? (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th>{t("fieldName")}</th>
                      <th>{t("fieldType")}</th>
                      <th className="text-end">{t("actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewFields.map((field) => {
                      const draft = reviewFieldDrafts[field.id];
                      const hasFieldChanges = reviewFieldDraftChanged(
                        field,
                        draft,
                      );

                      return (
                        <tr key={field.id}>
                          <td className="link-rule-cell">
                            <input
                              className="form-control form-control-sm"
                              value={draft?.name ?? ""}
                              onChange={(event) =>
                                updateReviewFieldDraft(field.id, {
                                  name: event.target.value,
                                })
                              }
                            />
                          </td>
                          <td className="link-rule-cell">
                            <select
                              className="form-select form-select-sm"
                              value={draft?.type ?? field.type}
                              onChange={(event) =>
                                updateReviewFieldDraft(field.id, {
                                  type: event.target.value as ReviewFieldType,
                                })
                              }
                            >
                              {reviewFieldTypes.map((type) => (
                                <option key={type} value={type}>
                                  {reviewFieldTypeLabel(type)}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="text-end">
                            <div className="d-inline-flex flex-wrap justify-content-end gap-2">
                              {draft?.name.trim() && hasFieldChanges ? (
                                <button
                                  className="btn btn-outline-success btn-sm d-inline-flex align-items-center gap-2"
                                  type="button"
                                  disabled={updatingReviewFieldId === field.id}
                                  onClick={() => void updateReviewField(field.id)}
                                >
                                  {updatingReviewFieldId === field.id ? (
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
                                disabled={deletingReviewFieldId === field.id}
                                onClick={() => void deleteReviewField(field.id)}
                              >
                                {deletingReviewFieldId === field.id ? (
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
                {loadingReviewFields
                  ? t("loadingReviewFields")
                  : t("noReviewFields")}
              </div>
            )}
          </div>
        </div>
      </div>
      ) : null}

      {editingUser && userSettingsDraft ? (
        <>
          <div className="modal d-block" role="dialog" aria-modal="true">
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <div>
                    <h5 className="modal-title">{t("editUserSettings")}</h5>
                    <div className="small text-secondary text-break">
                      {editingUser.email}
                    </div>
                  </div>
                  <button
                    className="btn-close"
                    type="button"
                    aria-label="Close"
                    onClick={closeUserSettings}
                  />
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label" htmlFor="user-settings-nickname">
                      {t("nickname")}
                    </label>
                    <input
                      className="form-control"
                      id="user-settings-nickname"
                      type="text"
                      value={userSettingsDraft.nickname}
                      onChange={(event) =>
                        setUserSettingsDraft((draft) =>
                          draft
                            ? { ...draft, nickname: event.target.value }
                            : draft,
                        )
                      }
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="user-settings-hostname">
                      {t("hostname")}
                    </label>
                    <input
                      className="form-control"
                      id="user-settings-hostname"
                      type="text"
                      value={userSettingsDraft.hostname}
                      onChange={(event) =>
                        setUserSettingsDraft((draft) =>
                          draft
                            ? { ...draft, hostname: event.target.value }
                            : draft,
                        )
                      }
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="user-settings-locale">
                      {t("locale")}
                    </label>
                    <select
                      className="form-select"
                      id="user-settings-locale"
                      value={userSettingsDraft.locale}
                      onChange={(event) =>
                        setUserSettingsDraft((draft) =>
                          draft
                            ? {
                                ...draft,
                                locale: event.target.value as UserLocale,
                              }
                            : draft,
                        )
                      }
                    >
                      <option value="FR">FR</option>
                      <option value="EN">EN</option>
                    </select>
                  </div>
                  <div className="form-check form-switch mb-2">
                    <input
                      checked={userSettingsDraft.mailNotificationsEnabled}
                      className="form-check-input"
                      id="user-settings-mail-notifications"
                      role="switch"
                      type="checkbox"
                      onChange={(event) =>
                        setUserSettingsDraft((draft) =>
                          draft
                            ? {
                                ...draft,
                                mailNotificationsEnabled: event.target.checked,
                              }
                            : draft,
                        )
                      }
                    />
                    <label
                      className="form-check-label"
                      htmlFor="user-settings-mail-notifications"
                    >
                      {t("mailNotifications")}
                    </label>
                  </div>
                  {userSettingsDraft.mailNotificationsEnabled ? (
                    <div className="notification-preference-toggles ms-4 mb-3">
                      {NOTIFICATION_CATEGORIES.map((category) => (
                        <div
                          className="form-check form-switch"
                          key={`user-settings-mail-${category}`}
                        >
                          <input
                            checked={draftCategoryEnabled("mail", category)}
                            className="form-check-input"
                            id={`user-settings-mail-${category}`}
                            type="checkbox"
                            onChange={() =>
                              toggleDraftCategory("mail", category)
                            }
                          />
                          <label
                            className="form-check-label"
                            htmlFor={`user-settings-mail-${category}`}
                          >
                            {t(NOTIFICATION_CATEGORY_LABELS[category])}
                          </label>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="form-check form-switch mb-2">
                    <input
                      checked={userSettingsDraft.ircNotificationsEnabled}
                      className="form-check-input"
                      id="user-settings-irc-notifications"
                      role="switch"
                      type="checkbox"
                      onChange={(event) =>
                        setUserSettingsDraft((draft) =>
                          draft
                            ? {
                                ...draft,
                                ircNotificationsEnabled: event.target.checked,
                              }
                            : draft,
                        )
                      }
                    />
                    <label
                      className="form-check-label"
                      htmlFor="user-settings-irc-notifications"
                    >
                      {t("ircNotifications")}
                    </label>
                  </div>
                  {userSettingsDraft.ircNotificationsEnabled ? (
                    <>
                      <div className="mb-2">
                        <label
                          className="form-label"
                          htmlFor="user-settings-irc-nickname"
                        >
                          {t("ircNickname")}
                        </label>
                        <input
                          className={
                            draftIrcNicknameRequired
                              ? "form-control is-invalid"
                              : "form-control"
                          }
                          id="user-settings-irc-nickname"
                          type="text"
                          value={userSettingsDraft.ircNickname}
                          onChange={(event) =>
                            setUserSettingsDraft((draft) =>
                              draft
                                ? { ...draft, ircNickname: event.target.value }
                                : draft,
                            )
                          }
                        />
                        {draftIrcNicknameRequired ? (
                          <div className="invalid-feedback">
                            {t("ircNicknameRequired")}
                          </div>
                        ) : null}
                      </div>
                      <div className="notification-preference-toggles ms-4 mb-0">
                        {NOTIFICATION_CATEGORIES.map((category) => (
                          <div
                            className="form-check form-switch"
                            key={`user-settings-irc-${category}`}
                          >
                            <input
                              checked={draftCategoryEnabled("irc", category)}
                              className="form-check-input"
                              id={`user-settings-irc-${category}`}
                              type="checkbox"
                              onChange={() =>
                                toggleDraftCategory("irc", category)
                              }
                            />
                            <label
                              className="form-check-label"
                              htmlFor={`user-settings-irc-${category}`}
                            >
                              {t(NOTIFICATION_CATEGORY_LABELS[category])}
                            </label>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
                <div className="modal-footer">
                  <button
                    className="btn btn-outline-secondary"
                    type="button"
                    onClick={closeUserSettings}
                  >
                    {t("cancel")}
                  </button>
                  <button
                    className="btn btn-primary d-inline-flex align-items-center gap-2"
                    type="button"
                    disabled={savingUserSettings || draftIrcNicknameRequired}
                    onClick={() => void saveUserSettings()}
                  >
                    {savingUserSettings ? (
                      <span className="spinner-border spinner-border-sm" />
                    ) : (
                      <i className="bi bi-check-lg" aria-hidden="true" />
                    )}
                    {t("save")}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop show" />
        </>
      ) : null}
    </div>
  );
}
