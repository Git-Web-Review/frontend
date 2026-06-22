export type UserRole = "USER" | "ADMIN";
export type UserLocale = "FR" | "EN";
export type ReviewStatus = "PENDING" | "IN_REVIEW" | "ACKED" | "CLOSED";

export type ApiErrorCode =
  | "MISSING_AUTH_HEADER"
  | "INVALID_TOKEN"
  | "EMAIL_DOMAIN_NOT_ALLOWED"
  | "ADMIN_REQUIRED"
  | "ROLE_FORBIDDEN"
  | "USER_NOT_FOUND"
  | "ADMIN_GRANT_NOT_FOUND"
  | "LAST_ADMIN_REMOVAL_FORBIDDEN"
  | "PROFILE_IMAGE_NOT_FOUND"
  | "INVALID_PROFILE_IMAGE"
  | "UNKNOWN_ERROR"
  | "INTERNAL_ERROR"
  | "PAYLOAD_TOO_LARGE";

export type ApiError = {
  code: ApiErrorCode;
  message: string;
};

export type UserSettings = {
  userId: string;
  nickname: string | null;
  profileImageUrl: string | null;
  locale: UserLocale;
  mailNotificationsEnabled: boolean;
  ircNotificationsEnabled: boolean;
  ircNickname: string | null;
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
  firebaseUid: string;
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

export type AdminTextNotificationResponse = {
  deliveredCount: number;
};

export type GlobalSettings = {
  id: string;
  allowedOAuthDomains: string[];
  createdAt: string;
  updatedAt: string;
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

export type NotificationItem = {
  id: string;
  type:
    | "TEXT"
    | "REVIEW_PENDING"
    | "REVIEW_STATUS_CHANGED"
    | "COMMENT_RECEIVED";
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
  hasProfileImage: boolean;
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

export type ReviewCommit = {
  id: string;
  reviewId: string;
  hash: string;
  title: string;
  signedOffByName: string;
  signedOffByEmail: string;
  fixesHash: string | null;
  fixesTitle: string | null;
  rawMessage: string;
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
  gitDiff: ReviewDiff;
};

export type ReviewPreview = {
  gitwebUrl: string;
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

export type ReviewDeletion = {
  id: string;
  deleted: boolean;
};

export type ReviewComment = {
  id: string;
  commentId: string;
  reviewId: string;
  commitHash: string | null;
  filePath: string | null;
  lineNumber: number;
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
