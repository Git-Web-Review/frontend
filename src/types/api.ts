export type UserRole = "USER" | "ADMIN";
export type UserLocale = "FR" | "EN";
export type ReviewStatus =
  | "PENDING"
  | "IN_REVIEW"
  | "REVIEWED"
  | "ACKED"
  | "CLOSED";
export type ReviewCommitStatus = "PENDING" | "IN_REVIEW" | "REVIEWED" | "ACKED";
export type ReviewLinkKind = "COMMIT" | "SUMMARY";

export type ApiErrorCode =
  | "MISSING_AUTH_HEADER"
  | "INVALID_TOKEN"
  | "EMAIL_DOMAIN_NOT_ALLOWED"
  | "ADMIN_REQUIRED"
  | "ROLE_FORBIDDEN"
  | "INVALID_CREDENTIALS"
  | "INTERNAL_AUTH_DISABLED"
  | "SERVICE_ACCOUNT_NOT_FOUND"
  | "SERVICE_ACCOUNT_DISABLED"
  | "SERVICE_ACCOUNT_EMAIL_TAKEN"
  | "SERVICE_ACCOUNT_CLIENT_ID_TAKEN"
  | "USER_NOT_FOUND"
  | "ADMIN_GRANT_NOT_FOUND"
  | "LAST_ADMIN_REMOVAL_FORBIDDEN"
  | "FIREBASE_USER_DELETION_FORBIDDEN"
  | "SELF_DELETION_FORBIDDEN"
  | "PROFILE_IMAGE_NOT_FOUND"
  | "INVALID_PROFILE_IMAGE"
  | "UNKNOWN_ERROR"
  | "INTERNAL_ERROR"
  | "PAYLOAD_TOO_LARGE";

export type ApiError = {
  code: ApiErrorCode;
  message: string;
};

export type NotificationCategory =
  | "reviewStarted"
  | "reviewPending"
  | "reviewDone"
  | "reviewAcked"
  | "reviewClosed"
  | "commentReceived";

export type NotificationMediumPreferences = Partial<
  Record<NotificationCategory, boolean>
>;

export type NotificationMedium = "mail" | "irc" | "webhook";

export type NotificationPreferences = Partial<
  Record<NotificationMedium, NotificationMediumPreferences>
>;

export type UserSettings = {
  userId: string;
  nickname: string | null;
  profileImageUrl: string | null;
  locale: UserLocale;
  mailNotificationsEnabled: boolean;
  ircNotificationsEnabled: boolean;
  ircNickname: string | null;
  webhookNotificationsEnabled: boolean;
  webhookUrl: string | null;
  notificationPreferences: NotificationPreferences | null;
};

export type UserProfileImage = {
  userId: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
};

export type CurrentUser = {
  id: string;
  firebaseUid: string | null;
  email: string;
  hostname: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
  settings: UserSettings | null;
  profileImage: UserProfileImage | null;
};

export type AdminGrant = {
  email: string;
  createdAt: string;
};

export type AdminRemoval = {
  email: string;
  removed: boolean;
};

export type ServiceAccount = {
  id: string;
  clientId: string;
  name: string;
  description: string | null;
  active: boolean;
  lastUsedAt: string | null;
  userId: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
};

/** The plaintext secret is only ever returned on creation and rotation. */
export type ServiceAccountWithSecret = ServiceAccount & {
  clientSecret: string;
};

export type ServiceAccountRemoval = {
  id: string;
  removed: boolean;
};

export type UserDeletionPreview = {
  userId: string;
  email: string;
  deletable: boolean;
  blockedBy: ApiErrorCode | null;
  isServiceAccount: boolean;
  ownedReviews: number;
  commentsOnOwnedReviews: number;
  foreignMessagesOnOwnedReviews: number;
  authoredMessages: number;
  reviewerAssignments: number;
  commitAcks: number;
  fileViews: number;
  notifications: number;
};

export type UserRemoval = {
  id: string;
  email: string;
  removed: boolean;
  deletedReviews: number;
};

export type AdminTextNotificationResponse = {
  deliveredCount: number;
};

export type GlobalSettings = {
  id: string;
  allowedOAuthDomains: string[];
  appName: string | null;
  notificationPurgeEnabled: boolean;
  notificationPurgeIntervalMinutes: number;
  notificationPurgeAfterDays: number;
  reviewAutoCloseEnabled: boolean;
  reviewAutoCloseIntervalMinutes: number;
  createdAt: string;
  updatedAt: string;
};

export type AppLogo = {
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
};

export type Branding = {
  appName: string | null;
  logo: AppLogo | null;
};

export type CommitLogLinkRule = {
  id: string;
  label: string | null;
  regex: string;
  linkTemplate: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CommitLogLinkRuleDeletion = {
  id: string;
  deleted: boolean;
};

export type GitwebUrlRuleKind = "COMMIT" | "SUMMARY" | "AUTO";

export type GitwebUrlRule = {
  id: string;
  label: string | null;
  regex: string;
  remoteTemplate: string | null;
  linkKind: GitwebUrlRuleKind;
  priority: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type GitwebUrlRuleDeletion = {
  id: string;
  deleted: boolean;
};

export type ReviewFieldType = "LINK" | "IMAGE" | "TEXT" | "NUMBER";

export type ReviewField = {
  id: string;
  name: string;
  type: ReviewFieldType;
  createdAt: string;
  updatedAt: string;
};

export type ReviewFieldDeletion = {
  id: string;
  deleted: boolean;
};

export type ReviewFieldValue = {
  id: string;
  reviewId: string;
  fieldId: string;
  value: string;
  createdAt: string;
  updatedAt: string;
};

export type NotificationItem = {
  id: string;
  type:
    | "TEXT"
    | "REVIEW_PENDING"
    | "REVIEW_STATUS_CHANGED"
    | "COMMENT_RECEIVED"
    | "COMMIT_REVIEWED"
    | "REVIEW_NEW_VERSION";
  payload: unknown;
  seen: boolean;
  createdAt: string;
};

export type NotificationPage = {
  items: NotificationItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ReviewUserSummary = {
  id: string;
  email: string;
  hostname: string;
  nickname: string | null;
  mailNotificationsEnabled: boolean;
  ircNotificationsEnabled: boolean;
  webhookNotificationsEnabled: boolean;
  hasProfileImage: boolean;
  profileImageUrl: string | null;
};

export type ReviewerCandidatePage = {
  items: ReviewUserSummary[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ReviewReviewer = {
  id: string;
  reviewId: string;
  userId: string;
  requestedAt: string;
  acknowledgedAt: string | null;
  user: ReviewUserSummary;
};

export type ReviewCommitAck = {
  id: string;
  reviewCommitId: string;
  userId: string;
  acknowledgedAt: string;
  user: ReviewUserSummary;
};

export type ReviewFileView = {
  id: string;
  reviewCommitId: string;
  userId: string;
  filePath: string;
  createdAt: string;
};

export type FileViewedResponse = {
  commitId: string;
  filePath: string;
  viewed: boolean;
};

export type ReviewCommitChangeKind =
  | "NEW"
  | "UNCHANGED"
  | "REBASED"
  | "MODIFIED";

export type ReviewCommit = {
  id: string;
  reviewId: string;
  hash: string;
  title: string;
  status: ReviewCommitStatus;
  position: number;
  patchId: string | null;
  changeKind: ReviewCommitChangeKind | null;
  signedOffByName: string;
  signedOffByEmail: string;
  fixesHash: string | null;
  fixesTitle: string | null;
  rawMessage: string;
  gitDiff: ReviewDiff;
  acks: ReviewCommitAck[];
  fileViews: ReviewFileView[];
  createdAt: string;
};

export type ReviewDiffFile = {
  path: string;
  oldPath: string | null;
  status: string;
  additions: number;
  deletions: number;
  patch: string;
};

export type ReviewDiff = {
  files: ReviewDiffFile[];
};

export type ReviewItem = {
  id: string;
  gitwebUrl: string;
  title: string | null;
  description: string | null;
  status: ReviewStatus;
  version: number;
  ownerId: string;
  owner: ReviewUserSummary;
  sourceProject: string | null;
  sourceBranch: string | null;
  sourceCommit: string | null;
  gitwebTitle: string | null;
  gitwebLog: string | null;
  gitwebRawHtml: string | null;
  gitwebSnapshot: Record<string, unknown> | null;
  gitwebFetchedAt: string | null;
  gitwebFetchError: string | null;
  createdAt: string;
  updatedAt: string;
  commits: ReviewCommit[];
  reviewers: ReviewReviewer[];
  fieldValues: ReviewFieldValue[];
  gitDiff: ReviewDiff;
};

export type ReviewPreviewCommitOption = {
  hash: string;
  title: string;
  authorName: string;
  authorEmail: string;
  authoredAt: string | null;
};

export type ReviewPreview = {
  gitwebUrl: string;
  linkKind: ReviewLinkKind;
  commitOptions: ReviewPreviewCommitOption[];
  title: string | null;
  description: string | null;
  sourceProject: string | null;
  sourceBranch: string | null;
  sourceCommit: string | null;
  gitwebLog: string | null;
  gitwebFetchedAt: string | null;
  gitwebFetchError: string | null;
  reviewerEmails: string[];
  reviewerUsers: ReviewUserSummary[];
  gitDiff: ReviewDiff;
};

export type ReviewSyncCommitPreview = {
  hash: string;
  title: string;
  changeKind: ReviewCommitChangeKind;
  previousHash: string | null;
  previousTitle: string | null;
  authorName: string;
  authoredAt: string | null;
};

export type ReviewSyncPreview = {
  reviewId: string;
  version: number;
  sourceBranch: string | null;
  hasChanges: boolean;
  commits: ReviewSyncCommitPreview[];
  droppedCommits: { hash: string; title: string }[];
};

export type ReviewDeletion = {
  id: string;
  deleted: boolean;
};

export type ReviewCommentSide = "BEFORE" | "AFTER";

export type ReviewComment = {
  id: string;
  commentId: string;
  reviewId: string;
  commitHash: string | null;
  filePath: string | null;
  lineNumber: number | null;
  side: ReviewCommentSide;
  author: ReviewUserSummary;
  done: boolean;
  doneBy: ReviewUserSummary | null;
  doneAt: string | null;
  message: string;
  createdAt: string;
};

export type ReviewDashboardPage = {
  items: ReviewItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ReviewDashboard = {
  owned: ReviewDashboardPage;
  assigned: ReviewDashboardPage;
  done: ReviewDashboardPage;
};
